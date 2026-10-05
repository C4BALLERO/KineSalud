import { logger } from 'firebase-functions/v2';
import type { CommandHandler } from '../../core/callable';
import { DomainError } from '../../core/errors';
import { actorFromAuth, type TokenLike } from '../../core/guards';

/**
 * Adaptador HTTP para el despliegue gratuito. Habla el mismo protocolo que las
 * funciones "callable" de Firebase, así la web usa el SDK sin cambios
 * (`httpsCallableFromURL`):
 *   POST /api/<comando>  { "data": … }  con  Authorization: Bearer <ID token>
 *   200 → { "result": … }
 *   error → { "error": { "status": "INVALID_ARGUMENT", "message": …, "details": … } }
 * Independiente del proveedor: Vercel, un servidor local o el futuro chatbot.
 */

export interface HttpRequestLike {
  method: string;
  /** Nombre del comando ("appointments-create") o "cron/reminders". */
  route: string;
  headers: Record<string, string | undefined>;
  body: unknown;
}

export interface HttpResponseLike {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

export interface ServerDeps {
  commands: Record<string, CommandHandler>;
  verifyIdToken(token: string): Promise<TokenLike>;
  before?(command: string, data: never): Promise<unknown>;
  after?(command: string, data: never, result: never, snapshot: never): Promise<void>;
  /** Tarea periódica protegida por secreto (p. ej. un cron externo gratuito). */
  cron?: { secret: string | undefined; run(): Promise<unknown> };
  /** Orígenes permitidos para CORS (solo hace falta si la web está en otro dominio). */
  allowedOrigins?: string[];
  /** Comprobación pública del servidor (GET /api/health): no devuelve datos. */
  health?(): Promise<boolean>;
  /**
   * App Check obligatorio (APPCHECK_ENFORCE=true): valida el encabezado
   * X-Firebase-AppCheck que el SDK web agrega a cada comando.
   */
  verifyAppCheck?(token: string | undefined): Promise<boolean>;
}

const STATUS: Record<string, [number, string]> = {
  'invalid-argument': [400, 'INVALID_ARGUMENT'],
  'failed-precondition': [400, 'FAILED_PRECONDITION'],
  unauthenticated: [401, 'UNAUTHENTICATED'],
  'permission-denied': [403, 'PERMISSION_DENIED'],
  'not-found': [404, 'NOT_FOUND'],
  'already-exists': [409, 'ALREADY_EXISTS'],
};

function json(status: number, body: unknown, headers: Record<string, string>): HttpResponseLike {
  return { status, headers: { ...headers, 'Content-Type': 'application/json' }, body };
}

function errorResponse(err: unknown, headers: Record<string, string>): HttpResponseLike {
  if (err instanceof DomainError) {
    const [status, code] = STATUS[err.code] ?? [500, 'INTERNAL'];
    return json(
      status,
      { error: { status: code, message: err.message, details: err.details } },
      headers,
    );
  }
  logger.error('Error inesperado en el adaptador HTTP', err);
  return json(
    500,
    { error: { status: 'INTERNAL', message: 'Ocurrió un error inesperado. Inténtalo de nuevo.' } },
    headers,
  );
}

function corsHeaders(origin: string | undefined, allowed: string[]): Record<string, string> {
  if (!origin || !allowed.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, X-Firebase-AppCheck, Firebase-Instance-ID-Token',
    'Access-Control-Max-Age': '3600',
    Vary: 'Origin',
  };
}

export async function handleRequest(
  req: HttpRequestLike,
  deps: ServerDeps,
): Promise<HttpResponseLike> {
  const cors = corsHeaders(req.headers.origin, deps.allowedOrigins ?? []);
  if (req.method === 'OPTIONS') return { status: 204, headers: cors, body: null };
  if (req.route === 'health' && req.method === 'GET') {
    const ok = deps.health ? await deps.health().catch(() => false) : true;
    return json(ok ? 200 : 503, { status: ok ? 'ok' : 'error' }, cors);
  }
  if (req.method !== 'POST') {
    return json(405, { error: { status: 'INVALID_ARGUMENT', message: 'Usa POST.' } }, cors);
  }
  const bearer = /^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1];

  // Tarea periódica: no usa sesión de usuario sino un secreto compartido.
  if (req.route === 'cron/reminders') {
    if (!deps.cron?.secret || bearer !== deps.cron.secret) {
      return json(
        401,
        { error: { status: 'UNAUTHENTICATED', message: 'Secreto inválido.' } },
        cors,
      );
    }
    try {
      return json(200, { result: await deps.cron.run() }, cors);
    } catch (err) {
      return errorResponse(err, cors);
    }
  }

  const command = deps.commands[req.route];
  if (!command) {
    return json(404, { error: { status: 'NOT_FOUND', message: 'Comando desconocido.' } }, cors);
  }

  if (deps.verifyAppCheck && !(await deps.verifyAppCheck(req.headers['x-firebase-appcheck']))) {
    return json(
      401,
      {
        error: {
          status: 'UNAUTHENTICATED',
          message: 'No se pudo verificar la aplicación. Recarga la página.',
        },
      },
      cors,
    );
  }

  try {
    let auth: TokenLike | undefined;
    if (bearer) {
      try {
        auth = await deps.verifyIdToken(bearer);
      } catch {
        auth = undefined;
      }
    }
    const actor = actorFromAuth(auth);
    const data = (req.body as { data?: unknown } | null)?.data ?? null;
    const snapshot = deps.before ? await deps.before(req.route, data as never) : undefined;
    const result = await command(actor, data);
    if (deps.after) await deps.after(req.route, data as never, result as never, snapshot as never);
    return json(200, { result: result ?? null }, cors);
  } catch (err) {
    return errorResponse(err, cors);
  }
}
