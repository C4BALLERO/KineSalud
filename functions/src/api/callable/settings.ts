import { callable } from '../../core/callable';
import { firestoreSettingsGateway as gateway } from '../../domain/settings/firestoreSettingsGateway';
import {
  saveRoom as saveRoomCommand,
  saveService as saveServiceCommand,
  setRoomActive as setRoomActiveCommand,
  setServiceActive as setServiceActiveCommand,
  updateClinicSettings,
} from '../../domain/settings/settingsService';

/**
 * Configuración del consultorio (solo ADMINISTRADOR). Nombres publicados:
 * settings-updateClinic, settings-saveRoom, settings-setRoomActive,
 * settings-saveService, settings-setServiceActive.
 */
export const updateClinic = callable((actor, data) => updateClinicSettings(gateway, actor, data));
export const saveRoom = callable((actor, data) => saveRoomCommand(gateway, actor, data));
export const setRoomActive = callable((actor, data) => setRoomActiveCommand(gateway, actor, data));
export const saveService = callable((actor, data) => saveServiceCommand(gateway, actor, data));
export const setServiceActive = callable((actor, data) =>
  setServiceActiveCommand(gateway, actor, data),
);
