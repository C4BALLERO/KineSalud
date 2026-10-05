import { describe, expect, it } from 'vitest';
import { DomainError } from './errors';
import { assertSessionActive } from './sessions';

const at = (iso: string) => Date.parse(iso) / 1000;

describe('assertSessionActive', () => {
  it('acepta un token emitido después de la última revocación', async () => {
    await expect(
      assertSessionActive({ auth_time: at('2026-10-05T12:00:00Z') }, async () => ({
        disabled: false,
        tokensValidAfterTime: 'Mon, 05 Oct 2026 11:00:00 GMT',
      })),
    ).resolves.toBeUndefined();
  });

  it('rechaza un token anterior a la revocación de sesiones', async () => {
    const err = await assertSessionActive({ auth_time: at('2026-10-05T10:00:00Z') }, async () => ({
      disabled: false,
      tokensValidAfterTime: 'Mon, 05 Oct 2026 11:00:00 GMT',
    })).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DomainError);
    expect(err).toMatchObject({ code: 'unauthenticated' });
  });

  it('rechaza una cuenta deshabilitada aunque el token sea reciente', async () => {
    await expect(
      assertSessionActive({ auth_time: at('2026-10-05T12:00:00Z') }, async () => ({
        disabled: true,
      })),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });
});
