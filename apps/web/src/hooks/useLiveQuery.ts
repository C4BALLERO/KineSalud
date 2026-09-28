import {
  onSnapshot,
  type DocumentData,
  type Query,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
} from 'firebase/firestore';
import { useCallback, useEffect, useEffectEvent, useState } from 'react';
import { toAppError, type AppError } from '@/lib/errors';

export type LiveQueryState<T> =
  | { status: 'loading'; data?: undefined; error?: undefined }
  | { status: 'success'; data: T[]; error?: undefined }
  | { status: 'error'; data?: undefined; error: AppError };

const LOADING = { status: 'loading' } as const;

/**
 * Suscripción en tiempo real a una consulta de Firestore con estados
 * explícitos (carga, éxito, error) y reintento.
 *
 * @param key identifica la consulta; al cambiar se re-suscribe. `null` desactiva.
 * @param build construye la consulta (se evalúa solo cuando cambia `key`).
 * @param map convierte cada documento al modelo de la UI.
 */
export function useLiveQuery<T>(
  key: string | null,
  build: () => Query<DocumentData>,
  map: (doc: QueryDocumentSnapshot<DocumentData>) => T,
): LiveQueryState<T> & { retry: () => void } {
  const [attempt, setAttempt] = useState(0);
  // El resultado se guarda junto con la suscripción que lo produjo; si la clave
  // cambió, el estado derivado vuelve a "loading" sin actualizar estado en el efecto.
  const [result, setResult] = useState<{ token: string; state: LiveQueryState<T> } | null>(null);
  const token = key === null ? null : `${key}#${attempt}`;

  const buildQuery = useEffectEvent(() => build());
  const mapDocs = useEffectEvent((snap: QuerySnapshot<DocumentData>) =>
    snap.docs.map((d) => map(d)),
  );

  useEffect(() => {
    if (token === null) return;
    return onSnapshot(
      buildQuery(),
      (snap) => setResult({ token, state: { status: 'success', data: mapDocs(snap) } }),
      (err) => setResult({ token, state: { status: 'error', error: toAppError(err) } }),
    );
  }, [token]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const state = result && result.token === token ? result.state : LOADING;
  return { ...state, retry };
}
