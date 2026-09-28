// Datos de demostración para Firebase Emulator Suite.
// Uso: con los emuladores en marcha (npm run emulators), ejecutar `npm run seed`.
// SOLO funciona contra los emuladores: nunca toca un proyecto real.
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { buildDemoData } from './seed-data.mjs';

process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
const PROJECT_ID = 'demo-kinesalud';
// Evita que el Admin SDK busque credenciales de Google Cloud en la red.
process.env.GCLOUD_PROJECT ??= PROJECT_ID;
process.env.METADATA_SERVER_DETECTION ??= 'none';

/** Contraseña compartida de las cuentas de demostración (solo emuladores). */
export const DEMO_PASSWORD = 'KineDemo2026';

const USERS = [
  {
    uid: 'demo-admin',
    email: 'admin@kinesalud.test',
    displayName: 'Ana Gutiérrez',
    role: 'ADMINISTRADOR',
    professionalId: 'prof-ana', // La administradora también atiende.
  },
  {
    uid: 'demo-recepcion',
    email: 'recepcion@kinesalud.test',
    displayName: 'Lucía Mendoza',
    role: 'RECEPCIONISTA',
    professionalId: null,
  },
  {
    uid: 'demo-fisio',
    email: 'dperez@kinesalud.test',
    displayName: 'Diego Pérez',
    role: 'PROFESIONAL',
    professionalId: 'prof-diego',
  },
  {
    uid: 'demo-estetica',
    email: 'cvargas@kinesalud.test',
    displayName: 'Carla Vargas',
    role: 'PROFESIONAL',
    professionalId: 'prof-carla',
  },
];

async function ensureEmulatorsRunning() {
  const hosts = [process.env.FIREBASE_AUTH_EMULATOR_HOST, process.env.FIRESTORE_EMULATOR_HOST];
  for (const host of hosts) {
    try {
      await fetch(`http://${host}/`);
    } catch {
      console.error(
        `No se pudo conectar con el emulador en ${host}. Inicia primero: npm run emulators`,
      );
      process.exit(1);
    }
  }
}

async function main() {
  await ensureEmulatorsRunning();
  initializeApp({ projectId: PROJECT_ID });
  const auth = getAuth();
  const db = getFirestore();

  for (const u of USERS) {
    try {
      await auth.getUser(u.uid);
      // Sin tocar la contraseña: cambiarla cerraría las sesiones abiertas.
      await auth.updateUser(u.uid, { email: u.email, displayName: u.displayName, disabled: false });
    } catch {
      await auth.createUser({
        uid: u.uid,
        email: u.email,
        displayName: u.displayName,
        password: DEMO_PASSWORD,
      });
    }
    const claims = { role: u.role, active: true, professionalId: u.professionalId, cv: 1 };
    await auth.setCustomUserClaims(u.uid, claims);
    await db.doc(`users/${u.uid}`).set({
      displayName: u.displayName,
      email: u.email,
      role: u.role,
      active: true,
      professionalId: u.professionalId,
      claimsVersion: 1,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      lastLoginAt: null,
    });
    console.log(`✓ ${u.role.padEnd(13)} ${u.email}`);
  }

  await seedOperationalData(db);

  console.log(
    `\nCuentas de demostración listas. Contraseña: la constante DEMO_PASSWORD de scripts/seed.mjs`,
  );
}

/** Catálogos, clientes, tratamientos y citas. Se reemplazan en cada ejecución. */
async function seedOperationalData(db) {
  const data = buildDemoData();
  const collections = {
    settings: data.settings,
    rooms: data.rooms,
    services: data.services,
    professionals: data.professionals,
    professionalExceptions: data.professionalExceptions,
    clients: data.clients,
    clientCiIndex: data.clientCiIndex,
    treatments: data.treatments,
    appointments: data.appointments,
  };

  for (const [name, docs] of Object.entries(collections)) {
    await db.recursiveDelete(db.collection(name));
    const entries = Object.entries(docs);
    for (let i = 0; i < entries.length; i += 400) {
      const batch = db.batch();
      for (const [id, doc] of entries.slice(i, i + 400))
        batch.set(db.collection(name).doc(id), doc);
      await batch.commit();
    }
    console.log(`✓ ${name.padEnd(13)} ${entries.length}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
