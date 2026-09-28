import { callable } from '../../core/callable';
import {
  changeAppointmentStatus,
  correctAppointmentStatus,
  createAppointment,
  rescheduleAppointment,
} from '../../domain/appointments/appointmentsService';
import { firestoreAppointmentsGateway as gateway } from '../../domain/appointments/firestoreAppointmentsGateway';

/**
 * Citas. Nombres publicados: appointments-create, appointments-reschedule,
 * appointments-changeStatus, appointments-correctStatus.
 */
export const create = callable((actor, data) => createAppointment(gateway, actor, data));
export const reschedule = callable((actor, data) => rescheduleAppointment(gateway, actor, data));
export const changeStatus = callable((actor, data) =>
  changeAppointmentStatus(gateway, actor, data),
);
export const correctStatus = callable((actor, data) =>
  correctAppointmentStatus(gateway, actor, data),
);
