// Datos de demostración para Firebase Emulator Suite.
// Uso: con los emuladores en marcha (npm run emulators), ejecutar `npm run seed`.
// SOLO funciona contra los emuladores: nunca toca un proyecto real.
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
const PROJECT_ID = 'demo-kinesalud';
// Evita que el Admin SDK busque credenciales de Google Cloud en la red.
process.env.GCLOUD_PROJECT ??= PROJECT_ID;

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
      await auth.updateUser(u.uid, {
        email: u.email,
        displayName: u.displayName,
        password: DEMO_PASSWORD,
        disabled: false,
      });
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

  console.log(
    `\nCuentas de demostración listas. Contraseña: la constante DEMO_PASSWORD de scripts/seed.mjs`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
