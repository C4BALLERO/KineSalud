import {
  normalizeSearchText,
  searchTermFor,
  type AppointmentDoc,
  type ClientDoc,
  type ClientInput,
  type ClientStatus,
  type CreateClientResult,
  type SetClientStatusInput,
  type TreatmentDoc,
  type UpdateClientInput,
} from '@kinesalud/shared';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type Timestamp,
} from 'firebase/firestore';
import { useLiveDoc } from '@/hooks/useLiveDoc';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { callFunction } from '@/lib/callable';
import { toAppError } from '@/lib/errors';
import { db } from '@/lib/firebase';

/* ---------- Modelo de la UI ---------- */

export interface ClientListItem {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  ci: string;
  ciExt: ClientDoc['ciExt'];
  phone: string;
  email: string | null;
  status: ClientStatus;
  activeTreatments: number;
  createdAt: Date | null;
  lastNameLower: string;
}

export interface ClientDetail extends ClientListItem {
  birthDate: string | null;
  address: string | null;
  adminNotes: string | null;
  noShowCount: number;
  updatedAt: Date | null;
}

function toDetail(id: string, c: ClientDoc<Timestamp>): ClientDetail {
  return {
    id,
    firstName: c.firstName,
    lastName: c.lastName,
    fullName: `${c.firstName} ${c.lastName}`,
    ci: c.ci,
    ciExt: c.ciExt,
    phone: c.phone,
    email: c.email,
    status: c.status,
    activeTreatments: c.stats?.activeTreatments ?? 0,
    createdAt: c.createdAt?.toDate() ?? null,
    lastNameLower: c.lastNameLower ?? '',
    birthDate: c.birthDate,
    address: c.address,
    adminNotes: c.adminNotes,
    noShowCount: c.stats?.noShowCount ?? 0,
    updatedAt: c.updatedAt?.toDate() ?? null,
  };
}

/** Coincidencia local del resto de palabras de la búsqueda (Firestore filtra solo por la primera). */
export function matchesAllTerms(client: ClientListItem, search: string): boolean {
  const haystack = normalizeSearchText(
    `${client.firstName} ${client.lastName} ${client.ci} ${client.phone}`,
  );
  return normalizeSearchText(search)
    .split(' ')
    .filter(Boolean)
    .every((word) => haystack.includes(word.replace(/-/g, '')));
}

export type ClientStatusFilter = ClientStatus | 'TODOS';
export type ClientSort = 'apellido' | 'recientes';

export interface ClientListFilters {
  search: string;
  status: ClientStatusFilter;
  sort: ClientSort;
}

const PAGE_SIZE = 20;

/**
 * Listado paginado para administración y recepción. La búsqueda usa
 * `searchKeywords` (primera palabra) y el orden se resuelve en el servidor.
 */
export function useClientsList(filters: ClientListFilters, enabled = true) {
  return useInfiniteQuery({
    queryKey: ['clients', 'list', filters],
    enabled,
    initialPageParam: null as QueryDocumentSnapshot | null,
    queryFn: async ({ pageParam }) => {
      const constraints: QueryConstraint[] = [];
      const term = searchTermFor(filters.search);
      if (term) constraints.push(where('searchKeywords', 'array-contains', term));
      if (filters.status !== 'TODOS') constraints.push(where('status', '==', filters.status));
      constraints.push(
        filters.sort === 'recientes' ? orderBy('createdAt', 'desc') : orderBy('lastNameLower'),
      );
      if (pageParam) constraints.push(startAfter(pageParam));
      constraints.push(limit(PAGE_SIZE));
      try {
        const snap = await getDocs(query(collection(db, 'clients'), ...constraints));
        return {
          items: snap.docs.map((d) => toDetail(d.id, d.data() as ClientDoc<Timestamp>)),
          last: snap.docs.length === PAGE_SIZE ? snap.docs[snap.docs.length - 1]! : null,
        };
      } catch (err) {
        throw toAppError(err);
      }
    },
    getNextPageParam: (page) => page.last,
  });
}

/** "Mis pacientes": los clientes asignados al profesional (pocos: se filtran en el dispositivo). */
export function useMyPatients(professionalId: string | null) {
  return useLiveQuery(
    professionalId ? `patients|${professionalId}` : null,
    () =>
      query(
        collection(db, 'clients'),
        where('assignedProfessionalIds', 'array-contains', professionalId),
      ),
    (d) => toDetail(d.id, d.data() as ClientDoc<Timestamp>),
  );
}

export function useClient(clientId: string | undefined) {
  return useLiveDoc(
    clientId ? `client|${clientId}` : null,
    () => doc(db, 'clients', clientId!),
    (snap) => toDetail(snap.id, snap.data() as ClientDoc<Timestamp>),
  );
}

/* ---------- Historial del cliente ---------- */

export interface ClientAppointment {
  id: string;
  date: string;
  startAt: Date;
  endAt: Date;
  status: AppointmentDoc['status'];
  clientName: string;
  professionalName: string;
  serviceName: string;
  category: AppointmentDoc['category'];
  roomName: string;
  sessionNumber: number | null;
}

/** Citas del cliente; el profesional solo ve las que atiende él (Security Rules). */
export function useClientAppointments(clientId: string | undefined, professionalId: string | null) {
  return useLiveQuery(
    clientId ? `client-appointments|${clientId}|${professionalId ?? 'all'}` : null,
    () =>
      query(
        collection(db, 'appointments'),
        where('clientId', '==', clientId),
        ...(professionalId ? [where('professionalId', '==', professionalId)] : []),
        orderBy('startAt', 'desc'),
      ),
    (d): ClientAppointment => {
      const a = d.data() as AppointmentDoc<Timestamp>;
      return {
        id: d.id,
        date: a.date,
        startAt: a.startAt.toDate(),
        endAt: a.endAt.toDate(),
        status: a.status,
        clientName: a.clientName,
        professionalName: a.professionalName,
        serviceName: a.serviceName,
        category: a.category,
        roomName: a.roomName,
        sessionNumber: a.sessionNumber,
      };
    },
  );
}

export interface ClientTreatment {
  id: string;
  serviceName: string;
  category: TreatmentDoc['category'];
  professionalName: string;
  startDate: string;
  plannedSessions: number;
  completedSessions: number;
  status: TreatmentDoc['status'];
}

export function useClientTreatments(clientId: string | undefined, professionalId: string | null) {
  return useLiveQuery(
    clientId ? `client-treatments|${clientId}|${professionalId ?? 'all'}` : null,
    () =>
      query(
        collection(db, 'treatments'),
        where('clientId', '==', clientId),
        ...(professionalId ? [where('professionalId', '==', professionalId)] : []),
        orderBy('startDate', 'desc'),
      ),
    (d): ClientTreatment => {
      const t = d.data() as TreatmentDoc<Timestamp>;
      return {
        id: d.id,
        serviceName: t.serviceName,
        category: t.category,
        professionalName: t.professionalName,
        startDate: t.startDate,
        plannedSessions: t.plannedSessions,
        completedSessions: t.completedSessions,
        status: t.status,
      };
    },
  );
}

/* ---------- Comandos ---------- */

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ClientInput) =>
      callFunction<ClientInput, CreateClientResult>('clients-create', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateClientInput) =>
      callFunction<UpdateClientInput>('clients-update', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  });
}

export function useSetClientStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SetClientStatusInput) =>
      callFunction<SetClientStatusInput>('clients-setStatus', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  });
}
