import type { StatusCounts } from '@kinesalud/shared';

/**
 * Grupos de estado para los gráficos de citas. PENDIENTE y CONFIRMADA se suman
 * como "por atender": en un gráfico importa si la cita se resolvió o no.
 * El color va siempre con leyenda y en el tooltip (nunca solo).
 */
export const STATUS_GROUPS = [
  {
    key: 'attended',
    label: 'Atendidas',
    className: 'bg-success',
    of: (c: StatusCounts) => c.ATENDIDA,
  },
  {
    key: 'open',
    label: 'Por atender',
    className: 'bg-info',
    of: (c: StatusCounts) => c.PENDIENTE + c.CONFIRMADA,
  },
  {
    key: 'noShow',
    label: 'No asistió',
    className: 'bg-danger',
    of: (c: StatusCounts) => c.NO_ASISTIO,
  },
  {
    key: 'cancelled',
    label: 'Canceladas',
    className: 'bg-border-strong',
    of: (c: StatusCounts) => c.CANCELADA,
  },
] as const;

export function statusSegments(c: StatusCounts) {
  return STATUS_GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    className: g.className,
    value: g.of(c),
  }));
}
