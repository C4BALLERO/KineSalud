import { callable } from '../../core/callable';
import { firestoreUsersGateway } from '../../domain/users/firestoreUsersGateway';
import { createUser, setUserActive, updateUser } from '../../domain/users/usersService';

/** Gestión de usuarios (solo ADMINISTRADOR). Nombres publicados: users-create, users-update, users-setActive. */
export const create = callable((actor, data) => createUser(firestoreUsersGateway, actor, data));
export const update = callable((actor, data) => updateUser(firestoreUsersGateway, actor, data));
export const setActive = callable((actor, data) =>
  setUserActive(firestoreUsersGateway, actor, data),
);
