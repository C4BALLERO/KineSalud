import { createServer } from 'node:http';
import handler from './node';

/**
 * Servidor local del despliegue gratuito, para probar contra los emuladores
 * (Auth y Firestore) sin el emulador de Functions:
 *   npm run api:local
 * La web debe apuntar a él con VITE_API_URL=http://localhost:3001/api.
 */
const port = Number(process.env.PORT ?? 3001);
createServer((req, res) => void handler(req, res)).listen(port, () => {
  console.log(`API local en http://localhost:${port}/api`);
});
