import { callable } from '../../core/callable';
import { firestoreClientsGateway } from '../../domain/clients/firestoreClientsGateway';
import { createClient, setClientStatus, updateClient } from '../../domain/clients/clientsService';

/**
 * Gestión de clientes (ADMINISTRADOR y RECEPCIONISTA).
 * Nombres publicados: clients-create, clients-update, clients-setStatus.
 */
export const create = callable((actor, data) => createClient(firestoreClientsGateway, actor, data));
export const update = callable((actor, data) => updateClient(firestoreClientsGateway, actor, data));
export const setStatus = callable((actor, data) =>
  setClientStatus(firestoreClientsGateway, actor, data),
);
