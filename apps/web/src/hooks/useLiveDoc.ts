import { onSnapshot, type DocumentReference, type DocumentSnapshot } from 'firebase/firestore';
import { useCallback, useEffect, useEffectEvent, useState } from 'react';
import { toAppError, type AppError } from '@/lib/errors';

export type LiveDocState<T> =
  | { status: 'loading'; data?: undefined; error?: undefined }
  | { status: 'not-found'; data?: undefined; error?: undefined }
  | { status: 'success'; data: T; error?: undefined }
  | { status: 'error'; data?: undefined; error: AppError };

const LOADING = { status: 'loading' } as const;

/** Suscripción en tiempo real a un documento, con estado "no encontrado" explícito. */
export function useLiveDoc<T>(
  key: string | null,
  build: () => DocumentReference,
  map: (snap: DocumentSnapshot) => T,
): LiveDocState<T> & { retry: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ token: string; state: LiveDocState<T> } | null>(null);
  const token = key === null ? null : `${key}#${attempt}`;

  const buildRef = useEffectEvent(() => build());
  const mapSnap = useEffectEvent((snap: DocumentSnapshot) => map(snap));

  useEffect(() => {
    if (token === null) return;
    return onSnapshot(
      buildRef(),
      (snap) =>
        setResult({
          token,
          state: snap.exists()
            ? { status: 'success', data: mapSnap(snap) }
            : { status: 'not-found' },
        }),
      (err) => setResult({ token, state: { status: 'error', error: toAppError(err) } }),
    );
  }, [token]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const state = result && result.token === token ? result.state : LOADING;
  return { ...state, retry };
}
