// Crea la primera cuenta de ADMINISTRADOR en un proyecto real de Firebase.
//
// Uso (una sola vez, después del primer despliegue; ver docs/despliegue.md):
//   gcloud auth application-default login
//   gcloud auth application-default set-quota-project <proyecto>
//   npm run bootstrap:admin -- --project <proyecto> --email <correo> --name "<Nombre Apellido>"
//
// En el despliegue gratuito, sin gcloud, con la clave de la cuenta de servicio:
//   npm run bootstrap:admin -- --credentials "<ruta .json>" --app-url https://<dominio> //     --email <correo> --name "<Nombre Apellido>"
//
// - La cuenta se crea SIN contraseña: la persona define la suya con
//   "¿Olvidaste tu contraseña?" en la pantalla de ingreso.
// - Si falta, crea `settings/clinic` con un horario inicial editable desde Configuración.
// - Se niega a correr si ya hay un administrador activo: el resto de las cuentas
//   se crean desde la pantalla Usuarios.
// - No carga datos de demostración.
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const { values } = parseArgs({
  options: {
    project: { type: 'string' },
    email: { type: 'string' },
    name: { type: 'string' },
    credentials: { type: 'string' },
    'app-url': { type: 'string' },
  },
});

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  fail(
    'Este script es para un proyecto real. Quita FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST.',
  );
}

const firebaserc = JSON.parse(readFileSync(new URL('../.firebaserc', import.meta.url), 'utf8'));
const projectId = values.project ?? firebaserc.projects?.prod;
if (!projectId || projectId.startsWith('demo-')) {
  fail('Indica el proyecto real con --project (o el alias "prod" en .firebaserc).');
}

const email = values.email?.trim().toLowerCase();
const displayName = values.name?.trim().replace(/\s+/g, ' ');
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  fail('Indica un correo válido con --email.');
if (!displayName || displayName.length < 3) fail('Indica el nombre completo con --name.');

const DEFAULT_CLINIC = {
  name: 'Kinesalud y Vida',
  timezone: 'America/La_Paz',
  slotMinutes: 15,
  reminderLeadHours: 24,
  openingHours: {
    mon: [
      { start: '08:00', end: '13:00' },
      { start: '14:30', end: '19:00' },
    ],
    tue: [
      { start: '08:00', end: '13:00' },
      { start: '14:30', end: '19:00' },
    ],
    wed: [
      { start: '08:00', end: '13:00' },
      { start: '14:30', end: '19:00' },
    ],
    thu: [
      { start: '08:00', end: '13:00' },
      { start: '14:30', end: '19:00' },
    ],
    fri: [
      { start: '08:00', end: '13:00' },
      { start: '14:30', end: '19:00' },
    ],
    sat: [{ start: '08:00', end: '13:00' }],
  },
};

async function main() {
  if (values.credentials) {
    const key = JSON.parse(readFileSync(values.credentials, 'utf8'));
    if (key.project_id !== projectId) {
      fail(`La clave es del proyecto "${key.project_id}", no de "${projectId}".`);
    }
    initializeApp({ credential: cert(key), projectId });
  } else {
    initializeApp({ projectId });
  }
  const auth = getAuth();
  const db = getFirestore();

  const admins = await db
    .collection('users')
    .where('role', '==', 'ADMINISTRADOR')
    .where('active', '==', true)
    .limit(1)
    .get();
  if (!admins.empty) {
    fail('Ya existe un administrador activo. Crea las demás cuentas desde la pantalla Usuarios.');
  }

  let uid;
  try {
    uid = (await auth.getUserByEmail(email)).uid;
    await auth.updateUser(uid, { displayName, disabled: false });
    console.log(`· La cuenta ${email} ya existía en Authentication; se usará esa.`);
  } catch (err) {
    if (err?.code !== 'auth/user-not-found') throw err;
    uid = (await auth.createUser({ email, displayName, emailVerified: false })).uid;
    console.log(`✓ Cuenta creada en Authentication: ${email}`);
  }

  const claimsVersion = 1;
  await auth.setCustomUserClaims(uid, {
    role: 'ADMINISTRADOR',
    active: true,
    professionalId: null,
    cv: claimsVersion,
  });
  await db.doc(`users/${uid}`).set({
    displayName,
    email,
    role: 'ADMINISTRADOR',
    active: true,
    professionalId: null,
    claimsVersion,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    lastLoginAt: null,
  });
  await db.collection('auditLogs').add({
    actor: { type: 'SYSTEM', uid: null, role: null, channel: 'CLI' },
    action: 'user.bootstrapAdmin',
    entity: 'users',
    entityId: uid,
    at: FieldValue.serverTimestamp(),
    meta: { email },
  });
  console.log('✓ Rol ADMINISTRADOR asignado');

  const clinicRef = db.doc('settings/clinic');
  if (!(await clinicRef.get()).exists) {
    await clinicRef.set(DEFAULT_CLINIC);
    console.log('✓ Configuración inicial del consultorio creada (editable en Configuración)');
  }

  const appUrl = (values['app-url'] ?? `https://${projectId}.web.app`).replace(/\/$/, '');
  console.log(
    `\nListo. Abre ${appUrl}/recuperar-contrasena, ingresa ${email} ` +
      'y define la contraseña con el enlace que llegará por correo.',
  );
}

main().catch((err) => {
  const hint = /quota project|Could not load the default credentials|invalid_grant/i.test(
    String(err?.message),
  )
    ? '\n  Ejecuta: gcloud auth application-default login && gcloud auth application-default set-quota-project ' +
      projectId
    : '';
  fail(`${err?.message ?? err}${hint}`);
});
