import {
  CLINIC_TIMEZONE,
  clinicSettingsInputSchema,
  daysOutsideHours,
  deleteServiceInputSchema,
  normalizeSearchText,
  roomInputSchema,
  serviceInputSchema,
  setCatalogActiveInputSchema,
  setServiceProfessionalsInputSchema,
  TREATMENT_CATEGORY_LABELS,
  type SaveCatalogResult,
  type UpdateClinicResult,
} from '@kinesalud/shared';
import type { Actor } from '../../core/actor';
import { DomainError } from '../../core/errors';
import { parseInput, requirePermission } from '../../core/guards';
import { auditActor } from '../audit';
import type { SettingsGateway } from './settingsGateway';

/** Nombres únicos sin distinguir mayúsculas ni tildes ("Camilla 1" = "camilla 1"). */
function assertUniqueName(
  items: { id: string; name: string }[],
  name: string,
  selfId: string | null,
  message: string,
): void {
  const key = normalizeSearchText(name);
  if (items.some((i) => i.id !== selfId && normalizeSearchText(i.name) === key)) {
    throw new DomainError('already-exists', message, { field: 'name' });
  }
}

export async function updateClinicSettings(
  gateway: SettingsGateway,
  actor: Actor,
  data: unknown,
): Promise<UpdateClinicResult> {
  requirePermission(actor, 'settings.manage');
  const input = parseInput(clinicSettingsInputSchema, data);
  await gateway.saveClinic({ ...input, timezone: CLINIC_TIMEZONE });

  // No se bloquea el cambio: se avisa qué horarios de profesionales quedaron fuera.
  const professionals = await gateway.listProfessionals();
  const professionalsOutside = professionals
    .filter((p) => p.active && daysOutsideHours(p.weeklySchedule, input.openingHours).length > 0)
    .map((p) => p.displayName);

  await gateway.audit({
    actor: auditActor(actor),
    action: 'settings.clinic.update',
    entity: 'settings',
    entityId: 'clinic',
  });
  return { professionalsOutside };
}

export async function saveRoom(
  gateway: SettingsGateway,
  actor: Actor,
  data: unknown,
): Promise<SaveCatalogResult> {
  requirePermission(actor, 'settings.manage');
  const { roomId, ...input } = parseInput(roomInputSchema, data);
  const rooms = await gateway.listRooms();
  const current = roomId ? rooms.find((r) => r.id === roomId) : null;
  if (roomId && !current) throw new DomainError('not-found', 'El espacio no existe.');
  assertUniqueName(rooms, input.name, roomId, 'Ya existe un espacio con ese nombre.');

  const id = await gateway.saveRoom(roomId, {
    ...input,
    capacity: 1,
    active: current?.active ?? true,
  });
  await gateway.audit({
    actor: auditActor(actor),
    action: roomId ? 'room.update' : 'room.create',
    entity: 'rooms',
    entityId: id,
  });
  return { id };
}

export async function setRoomActive(
  gateway: SettingsGateway,
  actor: Actor,
  data: unknown,
): Promise<void> {
  requirePermission(actor, 'settings.manage');
  const { id, active } = parseInput(setCatalogActiveInputSchema, data);
  const current = (await gateway.listRooms()).find((r) => r.id === id);
  if (!current) throw new DomainError('not-found', 'El espacio no existe.');
  if (current.active === active) return;

  const { id: _id, ...doc } = current;
  await gateway.saveRoom(id, { ...doc, active });
  await gateway.audit({
    actor: auditActor(actor),
    action: active ? 'room.activate' : 'room.deactivate',
    entity: 'rooms',
    entityId: id,
  });
}

export async function saveService(
  gateway: SettingsGateway,
  actor: Actor,
  data: unknown,
): Promise<SaveCatalogResult> {
  requirePermission(actor, 'settings.manage');
  const { serviceId, ...input } = parseInput(serviceInputSchema, data);
  const services = await gateway.listServices();
  const current = serviceId ? services.find((s) => s.id === serviceId) : null;
  if (serviceId && !current) throw new DomainError('not-found', 'El servicio no existe.');
  assertUniqueName(services, input.name, serviceId, 'Ya existe un servicio con ese nombre.');

  // Cambiar el área dejaría el servicio asignado a profesionales que no la atienden.
  if (current && current.category !== input.category) {
    const blocking = (await gateway.listProfessionals())
      .filter((p) => p.serviceIds.includes(current.id) && !p.categories.includes(input.category))
      .map((p) => p.displayName);
    if (blocking.length > 0) {
      throw new DomainError(
        'failed-precondition',
        `No se puede cambiar el área: lo ofrece ${blocking.join(', ')}, que no atiende ${TREATMENT_CATEGORY_LABELS[input.category].toLowerCase()}. Quita primero el servicio de su ficha.`,
        { field: 'category' },
      );
    }
  }

  const id = await gateway.saveService(serviceId, { ...input, active: current?.active ?? true });
  await gateway.audit({
    actor: auditActor(actor),
    action: serviceId ? 'service.update' : 'service.create',
    entity: 'services',
    entityId: id,
  });
  return { id };
}

export async function setServiceActive(
  gateway: SettingsGateway,
  actor: Actor,
  data: unknown,
): Promise<void> {
  requirePermission(actor, 'settings.manage');
  const { id, active } = parseInput(setCatalogActiveInputSchema, data);
  const current = (await gateway.listServices()).find((s) => s.id === id);
  if (!current) throw new DomainError('not-found', 'El servicio no existe.');
  if (current.active === active) return;

  const { id: _id, ...doc } = current;
  await gateway.saveService(id, { ...doc, active });
  await gateway.audit({
    actor: auditActor(actor),
    action: active ? 'service.activate' : 'service.deactivate',
    entity: 'services',
    entityId: id,
  });
}

/**
 * Elimina un servicio que nunca se usó. Con citas o tratamientos registrados
 * no se borra (se perdería el historial): se ofrece desactivarlo.
 */
export async function deleteService(
  gateway: SettingsGateway,
  actor: Actor,
  data: unknown,
): Promise<void> {
  requirePermission(actor, 'settings.manage');
  const { id } = parseInput(deleteServiceInputSchema, data);
  const current = (await gateway.listServices()).find((s) => s.id === id);
  if (!current) throw new DomainError('not-found', 'El servicio no existe.');

  const usage = await gateway.countServiceUsage(id);
  if (usage.appointments > 0 || usage.treatments > 0) {
    const parts = [
      usage.appointments > 0 &&
        `${usage.appointments} ${usage.appointments === 1 ? 'cita' : 'citas'}`,
      usage.treatments > 0 &&
        `${usage.treatments} ${usage.treatments === 1 ? 'tratamiento' : 'tratamientos'}`,
    ].filter(Boolean);
    throw new DomainError(
      'failed-precondition',
      `No se puede eliminar «${current.name}»: tiene ${parts.join(' y ')} en el historial. Desactívalo para que no se pueda agendar.`,
      { usage },
    );
  }

  // Quien lo ofrecía deja de tenerlo en su ficha.
  const offering = (await gateway.listProfessionals()).filter((p) => p.serviceIds.includes(id));
  if (offering.length > 0) {
    await gateway.saveProfessionalServices(
      offering.map((p) => ({ id: p.id, serviceIds: p.serviceIds.filter((s) => s !== id) })),
    );
  }
  await gateway.deleteService(id);
  await gateway.audit({
    actor: auditActor(actor),
    action: 'service.delete',
    entity: 'services',
    entityId: id,
    meta: { name: current.name },
  });
}

/**
 * Define qué profesionales realizan un servicio. Cada uno debe atender el
 * área del servicio (fisioterapia, rehabilitación o estética).
 */
export async function setServiceProfessionals(
  gateway: SettingsGateway,
  actor: Actor,
  data: unknown,
): Promise<void> {
  requirePermission(actor, 'settings.manage');
  const { serviceId, professionalIds } = parseInput(setServiceProfessionalsInputSchema, data);
  const service = (await gateway.listServices()).find((s) => s.id === serviceId);
  if (!service) throw new DomainError('not-found', 'El servicio no existe.');

  const professionals = await gateway.listProfessionals();
  const unknown = professionalIds.filter((id) => !professionals.some((p) => p.id === id));
  if (unknown.length > 0) throw new DomainError('not-found', 'Algún profesional ya no existe.');
  const wrongArea = professionals
    .filter((p) => professionalIds.includes(p.id) && !p.categories.includes(service.category))
    .map((p) => p.displayName);
  if (wrongArea.length > 0) {
    throw new DomainError(
      'failed-precondition',
      `${wrongArea.join(', ')} no ${wrongArea.length === 1 ? 'atiende' : 'atienden'} ${TREATMENT_CATEGORY_LABELS[service.category].toLowerCase()}. Agrega el área en su ficha primero.`,
      { field: 'professionalIds' },
    );
  }

  const updates = professionals
    .map((p) => {
      const has = p.serviceIds.includes(serviceId);
      const wants = professionalIds.includes(p.id);
      if (has === wants) return null;
      return {
        id: p.id,
        serviceIds: wants
          ? [...p.serviceIds, serviceId]
          : p.serviceIds.filter((s) => s !== serviceId),
      };
    })
    .filter((u): u is { id: string; serviceIds: string[] } => u !== null);
  if (updates.length === 0) return;

  await gateway.saveProfessionalServices(updates);
  await gateway.audit({
    actor: auditActor(actor),
    action: 'service.setProfessionals',
    entity: 'services',
    entityId: serviceId,
    meta: { professionalIds },
  });
}
