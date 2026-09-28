import { zodResolver } from '@hookform/resolvers/zod';
import {
  ROOM_KIND_LABELS,
  ROOM_KINDS,
  roomInputSchema,
  TREATMENT_CATEGORIES,
  TREATMENT_CATEGORY_LABELS,
  type RoomInput,
} from '@kinesalud/shared';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { CheckboxGroup } from '@/components/ui/CheckboxGroup';
import { Dialog } from '@/components/ui/Dialog';
import { FormField } from '@/components/ui/FormField';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Input, Select } from '@/components/ui/Input';
import { useToast } from '@/components/ui/toast-context';
import { toAppError } from '@/lib/errors';
import { useSaveRoom, type RoomItem } from '../api/catalog';

interface RoomDialogProps {
  room: RoomItem | null;
  onClose: () => void;
}

/** Crear o editar un espacio (camilla, cabina, gimnasio). */
export function RoomDialog({ room, onClose }: RoomDialogProps) {
  const toast = useToast();
  const saveRoom = useSaveRoom();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<RoomInput>({
    resolver: zodResolver(roomInputSchema),
    mode: 'onTouched',
    defaultValues: {
      roomId: room?.id ?? null,
      name: room?.name ?? '',
      kind: room?.kind ?? 'CAMILLA',
      allowedCategories: room?.allowedCategories ?? [],
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await saveRoom.mutateAsync(values);
      toast.success(room ? 'Espacio actualizado' : 'Espacio creado');
      onClose();
    } catch (err) {
      const appError = toAppError(err);
      if (appError.field === 'name') setError('name', { message: appError.message });
      else setServerError(appError.message);
    }
  });

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && !isSubmitting && onClose()}
      title={room ? 'Editar espacio' : 'Nuevo espacio'}
      description="Cada espacio atiende a un cliente a la vez."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="room-form"
            loading={isSubmitting}
            disabled={!!room && !isDirty}
          >
            {room ? 'Guardar cambios' : 'Crear espacio'}
          </Button>
        </>
      }
    >
      <form
        id="room-form"
        noValidate
        onSubmit={(e) => void onSubmit(e)}
        className="flex flex-col gap-4 pb-2"
      >
        {serverError && <InlineAlert tone="danger" title={serverError} />}
        <FormField label="Nombre" required hint="P. ej. Camilla 3." error={errors.name?.message}>
          {(p) => <Input {...p} {...register('name')} autoComplete="off" />}
        </FormField>
        <FormField label="Tipo de espacio" required error={errors.kind?.message}>
          {(p) => (
            <Select {...p} {...register('kind')}>
              {ROOM_KINDS.map((k) => (
                <option key={k} value={k}>
                  {ROOM_KIND_LABELS[k]}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <Controller
          control={control}
          name="allowedCategories"
          render={({ field }) => (
            <CheckboxGroup
              label="Áreas que pueden usarlo"
              required
              error={errors.allowedCategories?.message}
            >
              <div className="flex flex-wrap gap-x-6 gap-y-3">
                {TREATMENT_CATEGORIES.map((c) => (
                  <Checkbox
                    key={c}
                    label={TREATMENT_CATEGORY_LABELS[c]}
                    checked={field.value.includes(c)}
                    onCheckedChange={(on) =>
                      field.onChange(on ? [...field.value, c] : field.value.filter((v) => v !== c))
                    }
                  />
                ))}
              </div>
            </CheckboxGroup>
          )}
        />
      </form>
    </Dialog>
  );
}
