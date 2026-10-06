import { callable } from '../../core/callable';
import { firestoreStaffGateway as staff } from '../../domain/staff/firestoreStaffGateway';
import {
  addException as addExceptionCommand,
  createProfessional,
  linkAccount as linkAccountCommand,
  removeException as removeExceptionCommand,
  setMyServices as setMyServicesCommand,
  setProfessionalActive,
  setSchedule as setScheduleCommand,
  updateProfessional,
} from '../../domain/staff/staffService';
import { firestoreUsersGateway } from '../../domain/users/firestoreUsersGateway';

/**
 * Personal (solo ADMINISTRADOR, salvo staff-setMyServices, que usa el propio
 * profesional). Nombres publicados: staff-create, staff-update, staff-setActive,
 * staff-setSchedule, staff-addException, staff-removeException, staff-linkAccount,
 * staff-setMyServices.
 */
export const create = callable((actor, data) => createProfessional(staff, actor, data));
export const update = callable((actor, data) => updateProfessional(staff, actor, data));
export const setActive = callable((actor, data) => setProfessionalActive(staff, actor, data));
export const setSchedule = callable((actor, data) => setScheduleCommand(staff, actor, data));
export const addException = callable((actor, data) => addExceptionCommand(staff, actor, data));
export const removeException = callable((actor, data) =>
  removeExceptionCommand(staff, actor, data),
);
export const setMyServices = callable((actor, data) => setMyServicesCommand(staff, actor, data));
export const linkAccount = callable((actor, data) =>
  linkAccountCommand(staff, firestoreUsersGateway, actor, data),
);
