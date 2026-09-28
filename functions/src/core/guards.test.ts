import { describe, expect, it } from 'vitest';
import { actorFromAuth, requirePermission } from './guards';

describe('actorFromAuth', () => {
  it('rechaza solicitudes sin autenticación', () => {
    expect(() => actorFromAuth(undefined)).toThrow(
      expect.objectContaining({ code: 'unauthenticated' }),
    );
  });

  it('rechaza cuentas sin rol', () => {
    expect(() => actorFromAuth({ uid: 'u1', token: {} })).toThrow(
      expect.objectContaining({ code: 'permission-denied' }),
    );
  });

  it('rechaza cuentas desactivadas', () => {
    expect(() =>
      actorFromAuth({ uid: 'u1', token: { role: 'PROFESIONAL', active: false } }),
    ).toThrow('Tu cuenta está desactivada.');
  });

  it('construye el actor a partir de los claims', () => {
    expect(
      actorFromAuth({
        uid: 'u1',
        token: { role: 'PROFESIONAL', active: true, professionalId: 'p1' },
      }),
    ).toEqual({
      type: 'USER',
      uid: 'u1',
      role: 'PROFESIONAL',
      professionalId: 'p1',
      name: null,
      channel: 'web',
    });
  });
});

describe('requirePermission', () => {
  it('permite y deniega según la matriz de permisos', () => {
    const recep = actorFromAuth({ uid: 'r', token: { role: 'RECEPCIONISTA', active: true } });
    expect(() => requirePermission(recep, 'clients.write')).not.toThrow();
    expect(() => requirePermission(recep, 'clinical.read')).toThrow(
      expect.objectContaining({ code: 'permission-denied' }),
    );
  });
});
