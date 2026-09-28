import { QueryClient } from '@tanstack/react-query';

/**
 * TanStack Query gestiona los comandos (useMutation) y las lecturas puntuales.
 * Las lecturas en tiempo real usan useLiveQuery (suscripciones de Firestore).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 60_000 },
    mutations: { retry: 0 },
  },
});
