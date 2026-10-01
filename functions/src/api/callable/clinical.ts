import { callable } from '../../core/callable';
import { firestoreClinicalGateway as gateway } from '../../domain/clinical/firestoreClinicalGateway';
import {
  getClientClinical,
  getSessionNote,
  getTreatmentClinical,
  recordSession as recordSessionCommand,
  saveClinicalRecord,
  saveTreatmentPlan,
  updateSessionNote,
} from '../../domain/clinical/clinicalService';

/**
 * Información clínica: solo administración y el profesional asignado; cada
 * acceso queda auditado. Nombres publicados: clinical-getClient,
 * clinical-getTreatment, clinical-getSession, clinical-saveRecord,
 * clinical-savePlan, clinical-recordSession, clinical-updateSession.
 */
export const getClient = callable((actor, data) => getClientClinical(gateway, actor, data));
export const getTreatment = callable((actor, data) => getTreatmentClinical(gateway, actor, data));
export const getSession = callable((actor, data) => getSessionNote(gateway, actor, data));
export const saveRecord = callable((actor, data) => saveClinicalRecord(gateway, actor, data));
export const savePlan = callable((actor, data) => saveTreatmentPlan(gateway, actor, data));
export const recordSession = callable((actor, data) => recordSessionCommand(gateway, actor, data));
export const updateSession = callable((actor, data) => updateSessionNote(gateway, actor, data));
