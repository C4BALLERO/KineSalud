import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { useSession } from '../session';
import { idleState, latestActivity, type IdleState } from './idleModel';

const ACTIVITY_KEY = 'kinesalud:last-activity';
/** Marca para que la pantalla de ingreso explique por qué se cerró la sesión. */
export const IDLE_SIGNOUT_FLAG = 'kinesalud:idle-signout';
const EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'mousemove'] as const;

function readShared(): string | null {
  try {
    return localStorage.getItem(ACTIVITY_KEY);
  } catch {
    return null;
  }
}

function writeShared(value: number) {
  try {
    localStorage.setItem(ACTIVITY_KEY, String(value));
  } catch {
    // Sin almacenamiento (modo privado estricto): cada pestaña cuenta por su cuenta.
  }
}

/**
 * Cierra la sesión tras 30 minutos sin actividad en ninguna pestaña, con un
 * aviso de un minuto para seguir conectado.
 */
export function IdleSignOut() {
  const { signOut } = useSession();
  // Se inicializa al montar (touch); Date.now() no puede llamarse durante el render.
  const lastLocal = useRef(0);
  const lastWrite = useRef(0);
  const [state, setState] = useState<IdleState>({ kind: 'active' });

  useEffect(() => {
    const touch = () => {
      const now = Date.now();
      lastLocal.current = now;
      // Escribir como máximo cada 10 s: mousemove dispara muchas veces por segundo.
      if (now - lastWrite.current > 10_000) {
        lastWrite.current = now;
        writeShared(now);
      }
    };
    touch();
    for (const e of EVENTS) window.addEventListener(e, touch, { passive: true });

    const timer = window.setInterval(() => {
      const next = idleState(latestActivity(lastLocal.current, readShared()), Date.now());
      setState((prev) =>
        prev.kind === next.kind &&
        (next.kind !== 'warning' ||
          (prev.kind === 'warning' && prev.secondsLeft === next.secondsLeft))
          ? prev
          : next,
      );
    }, 1000);

    return () => {
      for (const e of EVENTS) window.removeEventListener(e, touch);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (state.kind !== 'expired') return;
    try {
      sessionStorage.setItem(IDLE_SIGNOUT_FLAG, '1');
    } catch {
      // Solo se pierde el mensaje explicativo en la pantalla de ingreso.
    }
    void signOut();
  }, [state.kind, signOut]);

  const stay = () => {
    const now = Date.now();
    lastLocal.current = now;
    lastWrite.current = now;
    writeShared(now);
    setState({ kind: 'active' });
  };

  return (
    <Dialog
      open={state.kind === 'warning'}
      onOpenChange={(open) => !open && stay()}
      title="¿Sigues ahí?"
      description="Por seguridad, la sesión se cierra tras 30 minutos sin actividad."
      size="sm"
      footer={<Button onClick={stay}>Seguir conectado</Button>}
    >
      <p className="text-body text-fg" aria-live="polite">
        Se cerrará en {state.kind === 'warning' ? state.secondsLeft : 0} s.
      </p>
    </Dialog>
  );
}
