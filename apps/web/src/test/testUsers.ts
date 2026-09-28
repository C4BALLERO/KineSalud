import type { Role } from '@kinesalud/shared';
import type { Session } from '@/features/auth/session';

export const TEST_USERS: Record<Role, Session> = {
  ADMINISTRADOR: {
    uid: 'u-admin',
    displayName: 'Ana Gutiérrez',
    email: 'admin@kinesalud.test',
    role: 'ADMINISTRADOR',
    professionalId: 'prof-ana',
  },
  RECEPCIONISTA: {
    uid: 'u-recep',
    displayName: 'Lucía Mendoza',
    email: 'recepcion@kinesalud.test',
    role: 'RECEPCIONISTA',
    professionalId: null,
  },
  PROFESIONAL: {
    uid: 'u-prof',
    displayName: 'Diego Pérez',
    email: 'dperez@kinesalud.test',
    role: 'PROFESIONAL',
    professionalId: 'prof-diego',
  },
};
