// Guarda la clave de la cuenta de servicio de Firebase como variable secreta de
// Vercel (FIREBASE_SERVICE_ACCOUNT, entorno Production) sin mostrarla en pantalla.
//
// Uso (una vez, con el proyecto ya vinculado con `vercel link`):
//   npm run vercel:clave -- "<ruta al .json descargado de la consola de Firebase>"
//
// - Comprueba que el archivo sea una clave de cuenta de servicio del proyecto "prod"
//   de .firebaserc antes de enviarla.
// - La envía por la entrada estándar (no queda en el historial ni en la lista de procesos).
// - Después hay que volver a publicar (npm run deploy:gratis) para que el servidor la use.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

const path = process.argv[2];
if (!path) fail('Indica la ruta del archivo .json: npm run vercel:clave -- "C:\\ruta\\clave.json"');

let key;
try {
  key = JSON.parse(readFileSync(path, 'utf8'));
} catch {
  fail(`No se pudo leer ${path} como JSON.`);
}
if (key?.type !== 'service_account' || !key.private_key || !key.client_email) {
  fail('El archivo no es una clave de cuenta de servicio de Firebase.');
}
const firebaserc = JSON.parse(readFileSync(new URL('../.firebaserc', import.meta.url), 'utf8'));
const projectId = firebaserc.projects?.prod;
if (key.project_id !== projectId) {
  fail(`La clave es del proyecto "${key.project_id}", no de "${projectId}".`);
}

const result = spawnSync(
  'npx',
  [
    '--yes',
    'vercel@62',
    'env',
    'add',
    'FIREBASE_SERVICE_ACCOUNT',
    'production',
    '--sensitive',
    '--force',
  ],
  { input: JSON.stringify(key), stdio: ['pipe', 'inherit', 'inherit'], shell: true },
);
if (result.status !== 0) fail('Vercel no aceptó la variable (¿hiciste `vercel link`?).');

console.log(
  '\n✓ Clave guardada en Vercel como FIREBASE_SERVICE_ACCOUNT (Production, secreta).' +
    '\n  Borra el archivo descargado si ya no lo necesitas y publica de nuevo: npm run deploy:gratis',
);
