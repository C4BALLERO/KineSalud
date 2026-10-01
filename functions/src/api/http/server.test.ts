import { describe, expect, it, vi } from 'vitest';
import { DomainError } from '../../core/errors';
import { handleRequest, type ServerDeps } from './server';

const claims = { role: 'RECEPCIONISTA', active: true, professionalId: null, cv: 1 };

function deps(over: Partial<ServerDeps> = {}): ServerDeps {
  return {
    commands: {
      'echo-run': async (actor, data) => ({ uid: actor.uid, data }),
      'fail-domain': async () => {
        throw new DomainError('failed-precondition', 'La caja está cerrada.', { reason: 'x' });
      },
      'fail-bug': async () => {
        throw new Error('detalle interno');
      },
    },
    verifyIdToken: async (token) => {
      if (token !== 'ok') throw new Error('token inválido');
      return { uid: 'u-recep', token: claims };
    },
    ...over,
  };
}

const post = (route: string, body: unknown, headers: Record<string, string> = {}) => ({
  method: 'POST',
  route,
  headers: { authorization: 'Bearer ok', ...headers },
  body,
});

describe('protocolo callable sobre HTTP', () => {
  it('ejecuta el comando con el actor del token y responde { result }', async () => {
    const res = await handleRequest(post('echo-run', { data: { a: 1 } }), deps());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ result: { uid: 'u-recep', data: { a: 1 } } });
  });

  it('sin token o con un token inválido responde UNAUTHENTICATED', async () => {
    for (const headers of [{ authorization: '' }, { authorization: 'Bearer malo' }]) {
      const res = await handleRequest(post('echo-run', { data: null }, headers), deps());
      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({ error: { status: 'UNAUTHENTICATED' } });
    }
  });

  it('una cuenta desactivada no ejecuta comandos', async () => {
    const res = await handleRequest(
      post('echo-run', { data: null }),
      deps({ verifyIdToken: async () => ({ uid: 'u', token: { ...claims, active: false } }) }),
    );
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: { status: 'PERMISSION_DENIED' } });
  });

  it('los errores de dominio conservan mensaje y detalles; los inesperados no filtran nada', async () => {
    const domain = await handleRequest(post('fail-domain', { data: null }), deps());
    expect(domain.status).toBe(400);
    expect(domain.body).toEqual({
      error: {
        status: 'FAILED_PRECONDITION',
        message: 'La caja está cerrada.',
        details: { reason: 'x' },
      },
    });
    const bug = await handleRequest(post('fail-bug', { data: null }), deps());
    expect(bug.status).toBe(500);
    expect(JSON.stringify(bug.body)).not.toContain('detalle interno');
  });

  it('comando desconocido y método distinto de POST', async () => {
    expect((await handleRequest(post('no-existe', { data: null }), deps())).status).toBe(404);
    expect((await handleRequest({ ...post('echo-run', null), method: 'GET' }, deps())).status).toBe(
      405,
    );
  });

  it('ejecuta los efectos posteriores (reemplazo de los triggers) con el resultado', async () => {
    const before = vi.fn(async () => ({ previousDate: '2026-09-28' }));
    const after = vi.fn(async () => undefined);
    await handleRequest(post('echo-run', { data: { a: 1 } }), deps({ before, after }));
    expect(before).toHaveBeenCalledWith('echo-run', { a: 1 });
    expect(after).toHaveBeenCalledWith(
      'echo-run',
      { a: 1 },
      { uid: 'u-recep', data: { a: 1 } },
      { previousDate: '2026-09-28' },
    );
  });

  it('el cron exige su secreto', async () => {
    const run = vi.fn(async () => ({ queued: 2 }));
    const d = deps({ cron: { secret: 's3cr3t', run } });
    expect(
      (await handleRequest(post('cron/reminders', null, { authorization: 'Bearer x' }), d)).status,
    ).toBe(401);
    const ok = await handleRequest(
      post('cron/reminders', null, { authorization: 'Bearer s3cr3t' }),
      d,
    );
    expect(ok.body).toEqual({ result: { queued: 2 } });
    const noSecret = deps({ cron: { secret: undefined, run } });
    expect(
      (await handleRequest(post('cron/reminders', null, { authorization: 'Bearer ' }), noSecret))
        .status,
    ).toBe(401);
  });

  it('CORS solo para los orígenes permitidos', async () => {
    const d = deps({ allowedOrigins: ['http://localhost:5173'] });
    const pre = await handleRequest(
      {
        method: 'OPTIONS',
        route: 'echo-run',
        headers: { origin: 'http://localhost:5173' },
        body: null,
      },
      d,
    );
    expect(pre.status).toBe(204);
    expect(pre.headers['Access-Control-Allow-Origin']).toBe('http://localhost:5173');
    const other = await handleRequest(
      post('echo-run', { data: null }, { origin: 'https://otro.com' }),
      d,
    );
    expect(other.headers['Access-Control-Allow-Origin']).toBeUndefined();
  });
});
