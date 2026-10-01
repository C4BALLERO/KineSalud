import { callable } from '../../core/callable';
import { firestoreSettingsGateway as gateway } from '../../domain/settings/firestoreSettingsGateway';
import {
  deleteService as deleteServiceCommand,
  saveRoom as saveRoomCommand,
  saveService as saveServiceCommand,
  setRoomActive as setRoomActiveCommand,
  setServiceActive as setServiceActiveCommand,
  setServiceProfessionals as setServiceProfessionalsCommand,
  updateClinicSettings,
} from '../../domain/settings/settingsService';

/**
 * Configuración del consultorio (solo ADMINISTRADOR). Nombres publicados:
 * settings-updateClinic, settings-saveRoom, settings-setRoomActive,
 * settings-saveService, settings-setServiceActive, settings-deleteService,
 * settings-setServiceProfessionals.
 */
export const updateClinic = callable((actor, data) => updateClinicSettings(gateway, actor, data));
export const saveRoom = callable((actor, data) => saveRoomCommand(gateway, actor, data));
export const setRoomActive = callable((actor, data) => setRoomActiveCommand(gateway, actor, data));
export const saveService = callable((actor, data) => saveServiceCommand(gateway, actor, data));
export const setServiceActive = callable((actor, data) =>
  setServiceActiveCommand(gateway, actor, data),
);
export const deleteService = callable((actor, data) => deleteServiceCommand(gateway, actor, data));
export const setServiceProfessionals = callable((actor, data) =>
  setServiceProfessionalsCommand(gateway, actor, data),
);
