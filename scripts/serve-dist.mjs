// Sirve la web compilada (apps/web/dist) con las mismas cabeceras de seguridad que
// Firebase Hosting (firebase.json → hosting.headers), para probar la CSP en local.
//
// Uso:
//   VITE_USE_EMULATORS=true npm run build -w @kinesalud/web -- --mode emulators
//   node scripts/serve-dist.mjs --emulators     # http://localhost:4173
//
// --emulators agrega a `connect-src` los puertos locales de Firebase Emulator Suite,
// que la política de producción no permite.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'apps/web/dist');
const port = Number(process.env.PORT ?? 4173);
const emulators = process.argv.includes('--emulators');

const hosting = JSON.parse(readFileSync(join(root, 'firebase.json'), 'utf8')).hosting;
const headers = Object.fromEntries(
  hosting.headers.find((h) => h.source === '**').headers.map((h) => [h.key, h.value]),
);
if (emulators) {
  headers['Content-Security-Policy'] = headers['Content-Security-Policy']
    .replace('connect-src', 'connect-src http://127.0.0.1:* ws://127.0.0.1:*')
    .replace('; upgrade-insecure-requests', '');
  delete headers['Strict-Transport-Security'];
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
};

createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname));
  let file = join(dist, path);
  if (!file.startsWith(dist) || !existsSync(file) || statSync(file).isDirectory()) {
    file = join(dist, 'index.html'); // SPA
  }
  res.writeHead(200, {
    ...headers,
    'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
  });
  res.end(readFileSync(file));
}).listen(port, () => {
  console.log(`Web compilada en http://localhost:${port}${emulators ? ' (emuladores)' : ''}`);
});
