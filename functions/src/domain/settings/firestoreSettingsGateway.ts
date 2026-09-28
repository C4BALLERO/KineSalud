import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../../core/firebase';
import type {
  ProfessionalSchedule,
  SettingsGateway,
  StoredRoom,
  StoredService,
} from './settingsGateway';

/** Crea (id null) o reemplaza un documento de catálogo y devuelve su id. */
async function saveDoc(collection: string, id: string | null, doc: object): Promise<string> {
  const ref = id ? db.collection(collection).doc(id) : db.collection(collection).doc();
  await ref.set(
    {
      ...doc,
      updatedAt: FieldValue.serverTimestamp(),
      ...(id ? {} : { createdAt: FieldValue.serverTimestamp() }),
    },
    { merge: true },
  );
  return ref.id;
}

/** Implementación con el Admin SDK. Los catálogos son pequeños: se leen completos. */
export const firestoreSettingsGateway: SettingsGateway = {
  async saveClinic(doc) {
    await db
      .collection('settings')
      .doc('clinic')
      .set({ ...doc, updatedAt: FieldValue.serverTimestamp() });
  },

  async listProfessionals() {
    const snap = await db.collection('professionals').get();
    return snap.docs.map((d): ProfessionalSchedule => ({
      id: d.id,
      displayName: d.get('displayName'),
      active: d.get('active'),
      weeklySchedule: d.get('weeklySchedule') ?? {},
      serviceIds: d.get('serviceIds') ?? [],
      categories: d.get('categories') ?? [],
    }));
  },

  async listRooms() {
    const snap = await db.collection('rooms').get();
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StoredRoom, 'id'>) }));
  },

  saveRoom: (id, doc) => saveDoc('rooms', id, doc),

  async listServices() {
    const snap = await db.collection('services').get();
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StoredService, 'id'>) }));
  },

  saveService: (id, doc) => saveDoc('services', id, doc),

  async audit(entry) {
    await db.collection('auditLogs').add({ ...entry, at: FieldValue.serverTimestamp() });
  },
};
