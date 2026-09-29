import { callable } from '../../core/callable';
import { firestoreTreatmentsGateway } from '../../domain/treatments/firestoreTreatmentsGateway';
import {
  changeTreatmentStatus,
  createTreatment,
  updateTreatment,
} from '../../domain/treatments/treatmentsService';

/** Tratamientos. Nombres publicados: treatments-create, treatments-update, treatments-changeStatus. */
export const create = callable((actor, data) =>
  createTreatment(firestoreTreatmentsGateway, actor, data),
);
export const update = callable((actor, data) =>
  updateTreatment(firestoreTreatmentsGateway, actor, data),
);
export const changeStatus = callable((actor, data) =>
  changeTreatmentStatus(firestoreTreatmentsGateway, actor, data),
);
