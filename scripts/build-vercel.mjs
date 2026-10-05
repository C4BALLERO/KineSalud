// Compila el despliegue gratuito para Vercel con la Build Output API
// (https://vercel.com/docs/build-output-api/v3):
//   .vercel/output/static            → la web (apps/web/dist)
//   .vercel/output/functions/api.func → el servidor de comandos en un solo archivo
//   .vercel/output/config.json       → rutas: /api/* a la función; el resto, a la SPA
//
// Uso: npm run deploy:gratis                   (compila aquí y publica con `vercel deploy --prebuilt`)
//      node scripts/build-vercel.mjs --api-only  (solo el bundle del servidor)
//
// La configuración pública de la web sale de apps/web/.env.production.local, igual que
// en el despliegue con Blaze: Vite la incorpora al compilar y no hace falta cargarla en Vercel.
import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = `${root}.vercel/output`;
const apiOnly = process.argv.includes('--api-only');
const local = process.argv.includes('--local');

/** Empaqueta el servidor con todas sus dependencias (firebase-admin incluido). */
export async function bundleServer(entry, outfile) {
  await build({
    entryPoints: [`${root}functions/src/api/http/${entry}`],
    outfile,
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    sourcemap: false,
    minify: false,
    legalComments: 'none',
    logLevel: 'warning',
    // Exportación por defecto como módulo CommonJS plano (lo que espera Vercel).
    footer: {
      js: 'if (module.exports && module.exports.default) module.exports = module.exports.default;',
    },
  });
}

// Servidor local para desarrollo (npm run api:local): mismo código, otro punto de entrada.
if (local) {
  await bundleServer('local.ts', `${root}.api-local/server.cjs`);
  console.log('✓ Servidor local en .api-local/server.cjs');
  process.exit(0);
}

rmSync(out, { recursive: true, force: true });

if (!apiOnly) {
  const hasWebConfig =
    process.env.VITE_FIREBASE_PROJECT_ID || existsSync(`${root}apps/web/.env.production.local`);
  if (!hasWebConfig) {
    console.error(
      '✗ Falta la configuración de Firebase de la web: crea apps/web/.env.production.local ' +
        '(ver docs/variables-entorno.md).',
    );
    process.exit(1);
  }
  console.log('› Compilando la web…');
  if (!process.env.VITE_API_URL) process.env.VITE_API_URL = '/api';
  process.env.VITE_USE_EMULATORS = 'false';
  execSync('npm run build -w @kinesalud/web', { stdio: 'inherit', cwd: root, env: process.env });
  cpSync(`${root}apps/web/dist`, `${out}/static`, { recursive: true });
}

console.log('› Empaquetando el servidor…');
const fn = `${out}/functions/api.func`;
mkdirSync(fn, { recursive: true });
await bundleServer('node.ts', `${fn}/index.js`);
// El bundle es CommonJS: se declara aquí para que no herede "type": "module" de la raíz.
writeFileSync(`${fn}/package.json`, JSON.stringify({ type: 'commonjs' }));
writeFileSync(
  `${fn}/.vc-config.json`,
  JSON.stringify(
    {
      runtime: 'nodejs22.x',
      handler: 'index.js',
      launcherType: 'Nodejs',
      shouldAddHelpers: false,
      maxDuration: 30,
      // São Paulo: la región más cercana a Bolivia y a Firestore (southamerica-east1).
      regions: ['gru1'],
    },
    null,
    2,
  ),
);

// Mismas cabeceras de seguridad (CSP, HSTS…) que Firebase Hosting: una sola fuente.
const hosting = JSON.parse(readFileSync(`${root}firebase.json`, 'utf8')).hosting;
const security = Object.fromEntries(
  hosting.headers.find((h) => h.source === '**').headers.map((h) => [h.key, h.value]),
);
writeFileSync(
  `${out}/config.json`,
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: '^/api/(.*)$', dest: '/api?cmd=$1', headers: security },
        {
          src: '^/assets/(.*)$',
          headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
          continue: true,
        },
        { src: '^/(.*)$', headers: security, continue: true },
        { handle: 'filesystem' },
        { src: '^/(.*)$', dest: '/index.html' },
      ],
    },
    null,
    2,
  ),
);
console.log('✓ Salida lista en .vercel/output');
