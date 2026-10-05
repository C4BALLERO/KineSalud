/**
 * Presentación de la auditoría (`auditLogs`): qué acción, en qué módulo.
 * Las acciones son códigos estables que escribe el servidor; una acción nueva
 * sin etiqueta se muestra con su código, nunca se oculta.
 */

export const AUDIT_MODULES = {
  citas: 'Citas',
  caja: 'Caja y cobros',
  clientes: 'Clientes',
  clinica: 'Información clínica',
  tratamientos: 'Tratamientos',
  personal: 'Personal',
  configuracion: 'Servicios y configuración',
  recordatorios: 'Recordatorios',
  usuarios: 'Usuarios',
  reportes: 'Reportes',
  otros: 'Otros',
} as const;
export type AuditModule = keyof typeof AUDIT_MODULES;

const MODULE_BY_PREFIX: Record<string, AuditModule> = {
  appointment: 'citas',
  cash: 'caja',
  payment: 'caja',
  client: 'clientes',
  clinical: 'clinica',
  treatment: 'tratamientos',
  professional: 'personal',
  service: 'configuracion',
  room: 'configuracion',
  settings: 'configuracion',
  reminder: 'recordatorios',
  user: 'usuarios',
  reports: 'reportes',
};

const ACTION_LABELS: Record<string, string> = {
  'appointment.create': 'Agendó una cita',
  'appointment.reschedule': 'Reprogramó una cita',
  'appointment.confirmar': 'Confirmó una cita',
  'appointment.cancelar': 'Canceló una cita',
  'appointment.atender': 'Marcó una cita como atendida',
  'appointment.no_asistio': 'Marcó una inasistencia',
  'appointment.correct': 'Corrigió el estado de una cita',
  'cash.open': 'Abrió la caja',
  'cash.close': 'Cerró la caja',
  'payment.create': 'Registró un cobro',
  'payment.void': 'Anuló un cobro',
  'client.create': 'Registró un cliente',
  'client.update': 'Editó un cliente',
  'clinical.read': 'Consultó información clínica',
  'clinical.record.save': 'Guardó antecedentes o alertas clínicas',
  'clinical.plan.save': 'Guardó un plan clínico',
  'clinical.session.record': 'Registró una sesión',
  'clinical.session.update': 'Editó la nota de una sesión',
  'treatment.create': 'Creó un tratamiento',
  'treatment.update': 'Editó un tratamiento',
  'treatment.finalizar': 'Finalizó un tratamiento',
  'treatment.suspender': 'Suspendió un tratamiento',
  'treatment.reactivar': 'Reactivó un tratamiento',
  'professional.create': 'Creó una ficha de profesional',
  'professional.update': 'Editó una ficha de profesional',
  'professional.activate': 'Activó a un profesional',
  'professional.deactivate': 'Desactivó a un profesional',
  'professional.schedule': 'Cambió un horario semanal',
  'professional.exception.add': 'Registró una ausencia',
  'professional.exception.remove': 'Quitó una ausencia',
  'professional.linkAccount': 'Vinculó una cuenta a un profesional',
  'professional.unlinkAccount': 'Desvinculó la cuenta de un profesional',
  'service.create': 'Creó un servicio',
  'service.update': 'Editó un servicio',
  'service.activate': 'Activó un servicio',
  'service.deactivate': 'Desactivó un servicio',
  'service.delete': 'Eliminó un servicio',
  'service.setProfessionals': 'Asignó profesionales a un servicio',
  'room.create': 'Creó un espacio',
  'room.update': 'Editó un espacio',
  'settings.clinic.update': 'Cambió la configuración del consultorio',
  'reminder.confirmado': 'Gestionó un recordatorio: confirmado',
  'reminder.sin_respuesta': 'Gestionó un recordatorio: sin respuesta',
  'reminder.cancelado': 'Gestionó un recordatorio: cancelado',
  'user.create': 'Creó un usuario',
  'user.update': 'Editó un usuario',
  'user.activate': 'Reactivó un usuario',
  'user.deactivate': 'Desactivó un usuario',
  'user.bootstrapAdmin': 'Creó el primer administrador',
  'reports.rebuild': 'Recalculó los reportes',
};

export function auditModuleOf(action: string): AuditModule {
  return MODULE_BY_PREFIX[action.split('.')[0] ?? ''] ?? 'otros';
}

export function auditActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

/** Acceso a datos clínicos: se resalta en la lista. */
export function isClinicalAccess(action: string): boolean {
  return auditModuleOf(action) === 'clinica';
}

/**
 * Detalle breve del campo `meta`: solo valores simples (texto, número, sí/no),
 * para no volcar estructuras en la lista.
 */
export function auditMetaSummary(meta: Record<string, unknown> | undefined, max = 4): string {
  if (!meta) return '';
  const parts: string[] = [];
  for (const [key, value] of Object.entries(meta)) {
    if (parts.length >= max) break;
    if (typeof value === 'string' && value) parts.push(`${key}: ${truncate(value, 40)}`);
    else if (typeof value === 'number' || typeof value === 'boolean') {
      parts.push(`${key}: ${typeof value === 'boolean' ? (value ? 'sí' : 'no') : value}`);
    }
  }
  return parts.join(' · ');
}

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
