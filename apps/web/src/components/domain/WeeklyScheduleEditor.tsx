import {
  formatRanges,
  WEEKDAY_LABELS,
  WEEKDAYS,
  type TimeRange,
  type WeeklySchedule,
  type Weekday,
} from '@kinesalud/shared';
import { CircleAlert, CopyCheck, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { cn } from '@/utils/cn';
import type { EditableWeek } from './scheduleEditorModel';

interface WeeklyScheduleEditorProps {
  value: EditableWeek;
  onChange: (week: EditableWeek) => void;
  errors?: Partial<Record<Weekday, string>>;
  /** Horario de referencia (el del consultorio): se muestra como guía y limita los días. */
  reference?: WeeklySchedule;
  /** Paso de los selectores de hora, en minutos. */
  stepMinutes?: number;
  /** Tramo con el que se habilita un día sin referencia. */
  defaultRange?: TimeRange;
  disabled?: boolean;
}

const WORKDAYS: Weekday[] = ['tue', 'wed', 'thu', 'fri'];

/**
 * Editor de horario semanal: un renglón por día con sus tramos. Se usa para
 * el horario de atención del consultorio y para el de cada profesional.
 */
export function WeeklyScheduleEditor({
  value,
  onChange,
  errors = {},
  reference,
  stepMinutes = 15,
  defaultRange = { start: '08:00', end: '12:00' },
  disabled = false,
}: WeeklyScheduleEditorProps) {
  const setDay = (day: Weekday, ranges: TimeRange[]) => onChange({ ...value, [day]: ranges });
  const clinicClosed = (day: Weekday) => !!reference && !(reference[day]?.length ?? 0);

  const toggleDay = (day: Weekday, on: boolean) => {
    if (!on) return setDay(day, []);
    const base = reference?.[day]?.length ? reference[day]! : [defaultRange];
    setDay(
      day,
      base.map((r) => ({ ...r })),
    );
  };

  const updateRange = (day: Weekday, index: number, patch: Partial<TimeRange>) =>
    setDay(
      day,
      value[day].map((r, i) => (i === index ? { ...r, ...patch } : r)),
    );

  const addRange = (day: Weekday) => {
    const last = value[day].at(-1);
    // Sugerencia: una hora después del último tramo.
    const [h, m] = (last?.end ?? '14:00').split(':').map(Number);
    const start = `${String(Math.min(h! + 1, 22)).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    const end = `${String(Math.min(h! + 4, 23)).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    setDay(day, [...value[day], { start, end }]);
  };

  const copyMonday = () => {
    const next = { ...value };
    for (const day of WORKDAYS) {
      if (!clinicClosed(day)) next[day] = value.mon.map((r) => ({ ...r }));
    }
    onChange(next);
  };

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
        <p className="text-body-sm text-fg-muted">
          Marca los días de atención y ajusta sus horarios. Puedes agregar hasta 4 tramos por día.
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={copyMonday}
          disabled={disabled || value.mon.length === 0}
        >
          <CopyCheck aria-hidden="true" />
          Copiar el lunes de martes a viernes
        </Button>
      </div>

      <ul className="divide-y divide-border rounded-md border border-border">
        {WEEKDAYS.map((day) => {
          const label = WEEKDAY_LABELS[day];
          const ranges = value[day];
          const on = ranges.length > 0;
          const closed = clinicClosed(day);
          const error = errors[day];
          const errorId = `schedule-${day}-error`;
          return (
            <li
              key={day}
              className={cn(
                'grid grid-cols-1 gap-3 px-4 py-3 md:grid-cols-[10rem_minmax(0,1fr)] md:items-start',
                error && 'bg-danger-subtle/40',
              )}
            >
              <div className="flex flex-col gap-0.5 md:pt-2.5">
                <Checkbox
                  label={<span className="font-medium">{label}</span>}
                  checked={on}
                  disabled={disabled || (closed && !on)}
                  onCheckedChange={(checked) => toggleDay(day, checked)}
                />
                {reference && (
                  <span className="pl-8 text-caption text-fg-subtle">
                    {closed
                      ? 'Consultorio cerrado'
                      : `Consultorio: ${formatRanges(reference[day])}`}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-2">
                {!on ? (
                  <p className="text-body-sm text-fg-subtle md:pt-2.5">No atiende</p>
                ) : (
                  <>
                    {ranges.map((range, i) => (
                      <div key={i} className="flex flex-wrap items-center gap-2">
                        <Input
                          type="time"
                          step={stepMinutes * 60}
                          value={range.start}
                          disabled={disabled}
                          onChange={(e) => updateRange(day, i, { start: e.target.value })}
                          aria-label={`${label}, tramo ${i + 1}: desde`}
                          aria-invalid={error ? true : undefined}
                          aria-describedby={error ? errorId : undefined}
                          className="tabular w-32"
                        />
                        <span aria-hidden="true" className="text-fg-subtle">
                          –
                        </span>
                        <Input
                          type="time"
                          step={stepMinutes * 60}
                          value={range.end}
                          disabled={disabled}
                          onChange={(e) => updateRange(day, i, { end: e.target.value })}
                          aria-label={`${label}, tramo ${i + 1}: hasta`}
                          aria-invalid={error ? true : undefined}
                          aria-describedby={error ? errorId : undefined}
                          className="tabular w-32"
                        />
                        <IconButton
                          label={`Quitar tramo ${i + 1} del ${label.toLowerCase()}`}
                          icon={<Trash2 />}
                          disabled={disabled}
                          onClick={() =>
                            setDay(
                              day,
                              ranges.filter((_, j) => j !== i),
                            )
                          }
                        />
                      </div>
                    ))}
                    {ranges.length < 4 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-fit"
                        disabled={disabled}
                        onClick={() => addRange(day)}
                      >
                        <Plus aria-hidden="true" />
                        Agregar tramo
                      </Button>
                    )}
                  </>
                )}
                {error && (
                  <p id={errorId} className="flex items-start gap-1.5 text-caption text-danger">
                    <CircleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
                    {error}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
