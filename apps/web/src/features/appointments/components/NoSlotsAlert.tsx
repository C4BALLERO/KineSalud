import { NO_SLOTS_REASONS, type NoSlotsReason } from '@kinesalud/shared';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { usePermission } from '@/hooks/usePermission';

const linkClass = 'font-medium text-primary underline underline-offset-2 hover:text-primary-hover';

/**
 * "No hay horarios libres" con el motivo concreto y, para quien puede corregirlo,
 * el enlace a la pantalla donde se resuelve.
 */
export function NoSlotsAlert({
  reason,
  professionalChosen,
}: {
  reason: NoSlotsReason;
  professionalChosen: boolean;
}) {
  const canSettings = usePermission('settings.manage');
  const canStaff = usePermission('staff.manage');

  const to = (href: string, label: string, allowed: boolean) =>
    allowed ? (
      <Link to={href} className={linkClass}>
        {label}
      </Link>
    ) : (
      label
    );

  const hints: Record<NoSlotsReason, ReactNode> = {
    SERVICE_INACTIVE: <>Actívalo en {to('/servicios', 'Servicios', canSettings)}.</>,
    NO_PROFESSIONAL: professionalChosen ? (
      <>Elige «Cualquiera disponible» u otro profesional.</>
    ) : (
      <>
        Asígnalo en {to('/servicios', 'Servicios', canSettings)} (botón «Profesionales» del
        servicio) o en la ficha del profesional, en {to('/personal', 'Personal', canStaff)}.
      </>
    ),
    NO_ROOM: (
      <>
        En {to('/configuracion?tab=espacios', 'Configuración → Espacios', canSettings)} crea o
        activa un espacio cuyo tipo esté en «Dónde puede realizarse» del servicio y que tenga esta
        área en «Áreas que pueden usarlo».
      </>
    ),
    CLINIC_CLOSED: (
      <>
        Prueba otra fecha. El horario de atención se edita en{' '}
        {to('/configuracion', 'Configuración', canSettings)}.
      </>
    ),
    NOBODY_WORKS: (
      <>
        Prueba otra fecha, o revisa el horario semanal y las ausencias en{' '}
        {to('/personal', 'Personal', canStaff)}.
      </>
    ),
    FULLY_BOOKED: <>Prueba otra fecha{professionalChosen ? ' u otro profesional' : ''}.</>,
  };

  const title =
    reason === 'NOBODY_WORKS' && professionalChosen
      ? 'El profesional elegido no atiende ese día.'
      : NO_SLOTS_REASONS[reason];

  return (
    <InlineAlert tone="info" title={`No hay horarios libres: ${lowerFirst(title)}`}>
      {hints[reason]}
    </InlineAlert>
  );
}

function lowerFirst(text: string) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}
