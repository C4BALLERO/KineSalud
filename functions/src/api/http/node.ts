import type { IncomingMessage, ServerResponse } from 'node:http';
import { logger } from 'firebase-functions/v2';
import { adminAuth, db } from '../../core/firebase';
import { firestoreRemindersGateway } from '../../domain/reminders/firestoreRemindersGateway';
import { processDueReminders } from '../../domain/reminders/remindersService';
import { STAFF_CHANNELS } from '../../notifications/channels';
import { afterCommand, beforeCommand } from './effects';
import { COMMANDS } from './registry';
import { handleRequest, type ServerDeps } from './server';

const MAX_BODY = 1_000_000;

const deps: ServerDeps = {
  commands: COMMANDS,
  verifyIdToken: async (token) => {
    const decoded = await adminAuth.verifyIdToken(token);
    return { uid: decoded.uid, token: decoded as unknown as Record<string, unknown> };
  },
  before: beforeCommand as ServerDeps['before'],
  after: afterCommand as ServerDeps['after'],
  cron: {
    secret: process.env.CRON_SECRET,
    run: () => processDueReminders(firestoreRemindersGateway, STAFF_CHANNELS),
  },
  allowedOrigins: (process.env.CORS_ORIGINS ?? '').split(',').filter(Boolean),
  // Una lectura liviana confirma que las credenciales de Firestore funcionan.
  health: async () => {
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        db.doc('settings/clinic').get(),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('timeout')), 8000);
        }),
      ]);
      return true;
    } catch (err) {
      logger.error('Health check: Firestore no responde', err);
      return false;
    } finally {
      clearTimeout(timer);
    }
  },
};

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('Cuerpo demasiado grande'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      try {
        resolve(text ? JSON.parse(text) : null);
      } catch {
        resolve(null);
      }
    });
    req.on('error', reject);
  });
}

/** Ruta del comando: de `?cmd=` (reescritura de Vercel) o del path `/api/<comando>`. */
function routeOf(url: string): string {
  const parsed = new URL(url, 'http://localhost');
  const fromQuery = parsed.searchParams.get('cmd');
  if (fromQuery) return fromQuery;
  return parsed.pathname.replace(/^\/api\/?/, '').replace(/\/$/, '');
}

/** Manejador estándar de Node (Vercel, servidor local). */
export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const headers: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    headers[key.toLowerCase()] = Array.isArray(value) ? value[0] : value;
  }
  let body: unknown = null;
  try {
    body = req.method === 'POST' ? await readBody(req) : null;
  } catch {
    res.writeHead(413, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error: { status: 'INVALID_ARGUMENT', message: 'Solicitud demasiado grande.' },
      }),
    );
    return;
  }
  const out = await handleRequest(
    { method: req.method ?? 'GET', route: routeOf(req.url ?? '/'), headers, body },
    deps,
  );
  res.writeHead(out.status, out.headers);
  res.end(out.body === null ? '' : JSON.stringify(out.body));
}
