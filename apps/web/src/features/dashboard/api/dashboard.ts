import type { AppointmentDoc, DateKey, ProfessionalDoc, TreatmentDoc } from '@kinesalud/shared';
import { useQuery } from '@tanstack/react-query';
import {
  collection,
  getCountFromServer,
  orderBy,
  query,
  where,
  type QueryConstraint,
  type Timestamp,
} from 'firebase/firestore';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { db } from '@/lib/firebase';
import type { AppointmentItem, TreatmentItem } from '../model';

/**
 * Alcance de las consultas: `null` = todo el consultorio (administración y
 * recepción); un id = solo los registros de ese profesional. Las Security
 * Rules exigen que el profesional filtre por su propia ficha.
 */
export type Scope = string | null;

const byProfessional = (scope: Scope): QueryConstraint[] =>
  scope ? [where('professionalId', '==', scope)] : [];

/** Citas entre dos fechas (incluidas), en tiempo real. */
export function useAppointmentsBetween(scope: Scope, from: DateKey, to: DateKey) {
  return useLiveQuery(
    `appointments|${scope ?? 'all'}|${from}|${to}`,
    () =>
      query(
        collection(db, 'appointments'),
        ...byProfessional(scope),
        where('date', '>=', from),
        where('date', '<=', to),
        orderBy('date'),
      ),
    (d): AppointmentItem => {
      const a = d.data() as AppointmentDoc<Timestamp>;
      return {
        id: d.id,
        date: a.date,
        startAt: a.startAt.toDate(),
        endAt: a.endAt.toDate(),
        status: a.status,
        clientName: a.clientName,
        professionalId: a.professionalId,
        professionalName: a.professionalName,
        serviceName: a.serviceName,
        category: a.category,
        roomName: a.roomName,
        sessionNumber: a.sessionNumber,
      };
    },
  );
}

export function useActiveTreatments(scope: Scope) {
  return useLiveQuery(
    `treatments|active|${scope ?? 'all'}`,
    () =>
      query(
        collection(db, 'treatments'),
        ...byProfessional(scope),
        where('status', '==', 'ACTIVO'),
      ),
    (d): TreatmentItem => {
      const t = d.data() as TreatmentDoc<Timestamp>;
      return {
        id: d.id,
        clientName: t.clientName,
        professionalName: t.professionalName,
        serviceName: t.serviceName,
        category: t.category,
        plannedSessions: t.plannedSessions,
        completedSessions: t.completedSessions,
      };
    },
  );
}

export function useProfessionals(enabled: boolean) {
  return useLiveQuery(
    enabled ? 'professionals' : null,
    () => query(collection(db, 'professionals')),
    (d) => ({ id: d.id, ...(d.data() as ProfessionalDoc) }),
  );
}

/** Clientes activos (conteo en el servidor, sin descargar documentos). */
export function useActiveClientsCount(scope: Scope) {
  return useQuery({
    queryKey: ['clients', 'active-count', scope ?? 'all'],
    queryFn: async () => {
      const constraints: QueryConstraint[] = [where('status', '==', 'ACTIVO')];
      if (scope) constraints.unshift(where('assignedProfessionalIds', 'array-contains', scope));
      const snap = await getCountFromServer(query(collection(db, 'clients'), ...constraints));
      return snap.data().count;
    },
  });
}
