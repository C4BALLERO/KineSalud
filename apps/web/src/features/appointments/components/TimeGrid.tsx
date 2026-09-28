import { clinicMinutesOf, minutesToTime, timeToMinutes, type TimeRange } from '@kinesalud/shared';
import type { MouseEvent, ReactNode } from 'react';
import { cn } from '@/utils/cn';
import type { AgendaAppointment } from '../api/appointments';
import { assignLanes, HOUR_HEIGHT, minutesToPx, type GridBounds } from '../model';
import { AppointmentBlock } from './AppointmentBlock';

export interface GridColumn {
  key: string;
  header: ReactNode;
  /** Tramos disponibles (fondo blanco); el resto se muestra sombreado. */
  available: TimeRange[];
  /** Motivo si la columna entera no está disponible ("Vacaciones", "No atiende"). */
  unavailableLabel?: string | null;
  appointments: AgendaAppointment[];
  /** Clic en un hueco disponible: minuto del día alineado a la grilla. */
  onEmptyClick?: (minute: number) => void;
}

interface TimeGridProps {
  columns: GridColumn[];
  bounds: GridBounds;
  slotMinutes: number;
  onOpen: (id: string) => void;
  selectedId?: string | null;
  /** Minuto actual si la grilla muestra el día de hoy (línea "ahora"). */
  nowMinute?: number | null;
  compact?: boolean;
  showProfessional?: boolean;
  /** Ancho mínimo de columna: con muchas columnas la grilla se desplaza en horizontal. */
  minColumnWidth?: number;
}

/**
 * Grilla horaria con columnas (profesionales en la vista día, días en la vista
 * semana). Es una representación visual: cada cita es un botón con su
 * descripción completa, y las acciones también están en la lista y el detalle.
 */
export function TimeGrid({
  columns,
  bounds,
  slotMinutes,
  onOpen,
  selectedId,
  nowMinute,
  compact,
  showProfessional,
  minColumnWidth = 176,
}: TimeGridProps) {
  const height = minutesToPx(bounds.end - bounds.start);
  const hours: number[] = [];
  for (let m = bounds.start; m <= bounds.end; m += 60) hours.push(m);
  const showNow = nowMinute != null && nowMinute >= bounds.start && nowMinute <= bounds.end;

  const handleEmpty = (column: GridColumn) => (e: MouseEvent<HTMLDivElement>) => {
    if (!column.onEmptyClick || e.target !== e.currentTarget) return;
    // Posición relativa a la columna (el tramo es un hijo posicionado dentro de ella).
    const columnEl = e.currentTarget.parentElement ?? e.currentTarget;
    const y = e.clientY - columnEl.getBoundingClientRect().top;
    const raw = bounds.start + (y / HOUR_HEIGHT) * 60;
    const minute = Math.floor(raw / slotMinutes) * slotMinutes;
    const inside = column.available.some(
      (r) => minute >= timeToMinutes(r.start) && minute < timeToMinutes(r.end),
    );
    if (inside) column.onEmptyClick(minute);
  };

  return (
    <div className="overflow-x-auto">
      <div
        className="grid"
        style={{
          gridTemplateColumns: `3.5rem repeat(${columns.length}, minmax(${minColumnWidth}px, 1fr))`,
        }}
      >
        {/* Encabezados */}
        <div className="sticky top-0 left-0 z-30 border-b border-border bg-surface" />
        {columns.map((c) => (
          <div
            key={c.key}
            className="sticky top-0 z-20 border-b border-l border-border bg-surface px-2 py-2"
          >
            {c.header}
          </div>
        ))}

        {/* Eje de horas */}
        <div className="sticky left-0 z-10 bg-surface" style={{ height }} aria-hidden="true">
          {hours.map((m) => (
            <span
              key={m}
              className="tabular absolute right-2 -translate-y-1/2 text-caption text-fg-subtle"
              style={{ top: minutesToPx(m - bounds.start) }}
            >
              {m < bounds.end ? minutesToTime(m) : ''}
            </span>
          ))}
        </div>

        {columns.map((c) => {
          const lanes = assignLanes(c.appointments);
          return (
            <div
              key={c.key}
              className="relative border-l border-border bg-surface-muted"
              style={{
                height,
                // Línea cada hora (sólida) y cada media hora (tenue).
                backgroundImage: `repeating-linear-gradient(to bottom, var(--color-border) 0 1px, transparent 1px ${HOUR_HEIGHT / 2}px, var(--color-border-subtle, var(--color-border)) ${HOUR_HEIGHT / 2}px ${HOUR_HEIGHT / 2 + 1}px, transparent ${HOUR_HEIGHT / 2 + 1}px ${HOUR_HEIGHT}px)`,
              }}
            >
              {c.available.map((r) => (
                <div
                  key={r.start}
                  aria-hidden="true"
                  onClick={handleEmpty(c)}
                  className={cn(
                    'absolute inset-x-0 bg-surface/85',
                    c.onEmptyClick && 'cursor-copy hover:bg-primary-subtle/40',
                  )}
                  style={{
                    top: minutesToPx(timeToMinutes(r.start) - bounds.start),
                    height: minutesToPx(timeToMinutes(r.end) - timeToMinutes(r.start)),
                  }}
                />
              ))}
              {c.unavailableLabel && c.available.length === 0 && (
                <p className="absolute inset-x-2 top-3 rounded-sm bg-surface px-2 py-1 text-center text-caption text-fg-muted">
                  {c.unavailableLabel}
                </p>
              )}

              {lanes.map(({ item, lane, lanes: total }) => {
                const start = clinicMinutesOf(item.startAt);
                const end = clinicMinutesOf(item.endAt);
                const widthPct = 100 / total;
                return (
                  <AppointmentBlock
                    key={item.id}
                    appointment={item}
                    onOpen={onOpen}
                    compact={compact}
                    showProfessional={showProfessional}
                    selected={item.id === selectedId}
                    style={{
                      top: minutesToPx(start - bounds.start) + 1,
                      height: Math.max(minutesToPx(end - start) - 2, 22),
                      left: `calc(${lane * widthPct}% + 2px)`,
                      width: `calc(${widthPct}% - 4px)`,
                    }}
                  />
                );
              })}

              {showNow && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-danger"
                  style={{ top: minutesToPx(nowMinute - bounds.start) }}
                >
                  <span className="absolute -top-1.5 -left-1 size-2.5 rounded-full bg-danger" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
