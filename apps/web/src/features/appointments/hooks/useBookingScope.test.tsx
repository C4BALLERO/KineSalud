import type { Role } from '@kinesalud/shared';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { TestSessionProvider } from '@/test/TestSessionProvider';
import { TEST_USERS } from '@/test/testUsers';
import { useBookingScope } from './useBookingScope';

function scopeFor(role: Role, professionalId?: string | null) {
  const session =
    professionalId === undefined ? TEST_USERS[role] : { ...TEST_USERS[role], professionalId };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <TestSessionProvider asRole={role} value={{ session }}>
      {children}
    </TestSessionProvider>
  );
  return renderHook(() => useBookingScope(), { wrapper }).result.current;
}

describe('quién agenda citas', () => {
  it('recepción y administración agendan en todo el consultorio', () => {
    expect(scopeFor('RECEPCIONISTA')).toEqual({ canBook: true, ownAgenda: null });
    // El administrador que también atiende sigue agendando para todos.
    expect(scopeFor('ADMINISTRADOR')).toEqual({ canBook: true, ownAgenda: null });
  });

  it('el profesional agenda solo en su propia agenda', () => {
    expect(scopeFor('PROFESIONAL')).toEqual({ canBook: true, ownAgenda: 'prof-diego' });
  });

  it('sin ficha vinculada, el profesional no puede agendar', () => {
    expect(scopeFor('PROFESIONAL', null)).toEqual({ canBook: false, ownAgenda: null });
  });
});
