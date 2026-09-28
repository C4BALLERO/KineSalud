import { APPOINTMENT_STATUSES, TREATMENT_CATEGORIES } from '@kinesalud/shared';
import {
  CalendarCheck,
  CalendarPlus,
  HeartPulse,
  MoreHorizontal,
  Pencil,
  Trash2,
  UserPlus,
  Users,
  UserX,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Logo, LogoSymbol } from '@/components/brand/Logo';
import { CategoryTag } from '@/components/domain/CategoryTag';
import { AppointmentStatusBadge } from '@/components/domain/StatusBadge';
import {
  EmptyState,
  ErrorState,
  NoPermissionState,
  NoResultsState,
} from '@/components/feedback/States';
import { PageHeader } from '@/components/layout/PageHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Checkbox, Switch } from '@/components/ui/Checkbox';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Dialog } from '@/components/ui/Dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { FormField } from '@/components/ui/FormField';
import { IconButton } from '@/components/ui/IconButton';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { KeyValueList } from '@/components/ui/KeyValueList';
import { Panel } from '@/components/ui/Panel';
import { SessionProgress } from '@/components/ui/Progress';
import { SearchInput } from '@/components/ui/SearchInput';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Sheet } from '@/components/ui/Sheet';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { Stat } from '@/components/ui/StatCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/toast-context';

/* ---------- Datos de los tokens (documentación viva) ---------- */

const COLOR_GROUPS: {
  title: string;
  tokens: { name: string; className: string; note: string }[];
}[] = [
  {
    title: 'Marca',
    tokens: [
      { name: 'primary', className: 'bg-primary', note: '#28727A · 5.6:1' },
      { name: 'primary-hover', className: 'bg-primary-hover', note: '#1E585C' },
      { name: 'primary-subtle', className: 'bg-primary-subtle', note: '#EEF7F7' },
      { name: 'secondary', className: 'bg-secondary', note: '#3A775C · 5.3:1' },
      { name: 'secondary-subtle', className: 'bg-secondary-subtle', note: '#EFF7F2' },
      { name: 'brand-teal', className: 'bg-brand-teal', note: '#55A8AD · solo logo' },
      { name: 'brand-sage', className: 'bg-brand-sage', note: '#84C3A6 · solo logo' },
    ],
  },
  {
    title: 'Superficies y texto',
    tokens: [
      { name: 'canvas', className: 'bg-canvas', note: 'Fondo de la app' },
      { name: 'surface', className: 'bg-surface', note: 'Paneles' },
      { name: 'surface-muted', className: 'bg-surface-muted', note: 'Hover, encabezados' },
      { name: 'fg', className: 'bg-fg', note: 'Texto · 16.6:1' },
      { name: 'fg-muted', className: 'bg-fg-muted', note: 'Secundario · 6.6:1' },
      { name: 'fg-subtle', className: 'bg-fg-subtle', note: 'Metadatos · 5.1:1' },
    ],
  },
  {
    title: 'Bordes',
    tokens: [
      { name: 'border', className: 'bg-border', note: 'Divisores' },
      { name: 'border-strong', className: 'bg-border-strong', note: 'Énfasis' },
      { name: 'border-control', className: 'bg-border-control', note: 'Controles · 3.4:1' },
    ],
  },
  {
    title: 'Semánticos',
    tokens: [
      { name: 'success', className: 'bg-success', note: 'Atendida, guardado' },
      { name: 'warning', className: 'bg-warning', note: 'Pendiente, alerta' },
      { name: 'danger', className: 'bg-danger', note: 'Error, no asistió' },
      { name: 'info', className: 'bg-info', note: 'Confirmada, aviso' },
    ],
  },
  {
    title: 'Categorías de tratamiento',
    tokens: [
      { name: 'cat-fisioterapia', className: 'bg-cat-fisioterapia', note: '5.9:1' },
      { name: 'cat-rehabilitacion', className: 'bg-cat-rehabilitacion', note: '5.0:1' },
      { name: 'cat-estetica', className: 'bg-cat-estetica', note: '6.0:1' },
    ],
  },
];

const TYPE_SCALE = [
  { token: 'text-display', sample: 'Buenos días, Ana', spec: '30/36 · 600' },
  { token: 'text-h1', sample: 'Perfil del cliente', spec: '24/32 · 600' },
  { token: 'text-h2', sample: 'Agenda de hoy', spec: '18/28 · 600' },
  { token: 'text-h3', sample: 'Datos de contacto', spec: '16/24 · 600' },
  {
    token: 'text-body',
    sample: 'La paciente refiere mejoría en la flexión lumbar.',
    spec: '15/24 · 400',
  },
  { token: 'text-body-sm', sample: 'Lic. Pérez · Camilla 2 · 09:00 – 09:45', spec: '14/20 · 400' },
  { token: 'text-caption', sample: 'Registrado el 27 de septiembre de 2026', spec: '13/18 · 400' },
  { token: 'text-overline', sample: 'OPERACIÓN', spec: '12/16 · 600 · mayúsculas' },
];

/* ---------- Estructura ---------- */

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 border-t border-border pt-8">
      <div>
        <h2 id={id} className="text-h2 text-fg">
          {title}
        </h2>
        {description && <p className="text-body-sm text-fg-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-6">
      <span className="w-32 shrink-0 text-caption text-fg-subtle">{label}</span>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

export function ComponentCatalogPage() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'dia' | 'semana'>('dia');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const fakeConfirm = () => {
    setConfirmLoading(true);
    window.setTimeout(() => {
      setConfirmLoading(false);
      setConfirmOpen(false);
      toast.success('Cita cancelada', 'Se notificó a recepción para reprogramar.');
    }, 900);
  };

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title="Design System"
        description="Catálogo vivo de tokens y componentes de Kinesalud y Vida. Solo visible en desarrollo."
      />

      <Section id="marca" title="Identidad">
        <Panel>
          <div className="flex flex-wrap items-center gap-8">
            <Logo variant="brand" size="lg" />
            <Logo size="lg" />
            <Logo />
            <Logo size="sm" />
            <div className="flex items-end gap-4">
              <LogoSymbol className="size-16" />
              <LogoSymbol className="size-8" />
              <LogoSymbol className="size-4" />
            </div>
          </div>
        </Panel>
      </Section>

      <Section
        id="color"
        title="Color"
        description="Todos los colores provienen de tokens. Relación de contraste medida sobre blanco."
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {COLOR_GROUPS.map((group) => (
            <Panel key={group.title} title={group.title}>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {group.tokens.map((t) => (
                  <li key={t.name} className="flex flex-col gap-1.5">
                    <span
                      aria-hidden="true"
                      className={`h-12 rounded-md ring-1 ring-border ring-inset ${t.className}`}
                    />
                    <span className="font-mono text-caption text-fg">{t.name}</span>
                    <span className="text-caption text-fg-subtle">{t.note}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          ))}
        </div>
      </Section>

      <Section
        id="tipografia"
        title="Tipografía"
        description="Plus Jakarta Sans Variable · cifras tabulares en horas y datos."
      >
        <Panel flush>
          <ul className="divide-y divide-border">
            {TYPE_SCALE.map((t) => (
              <li
                key={t.token}
                className="flex flex-col gap-1 px-5 py-4 md:flex-row md:items-baseline md:gap-6"
              >
                <span className="w-36 shrink-0 font-mono text-caption text-fg-subtle">
                  {t.token}
                </span>
                <span
                  className={`${t.token} min-w-0 flex-1 text-fg ${t.token === 'text-overline' ? 'uppercase' : ''}`}
                >
                  {t.sample}
                </span>
                <span className="text-caption text-fg-subtle">{t.spec}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </Section>

      <Section
        id="botones"
        title="Botones"
        description="Altura mínima de 44 px en pantallas táctiles."
      >
        <Panel>
          <div className="flex flex-col gap-5">
            <Row label="Variantes">
              <Button icon={<CalendarPlus aria-hidden="true" />}>Nueva cita</Button>
              <Button variant="secondary" icon={<Pencil aria-hidden="true" />}>
                Editar
              </Button>
              <Button variant="ghost">Cancelar</Button>
              <Button variant="danger" icon={<Trash2 aria-hidden="true" />}>
                Eliminar
              </Button>
            </Row>
            <Row label="Tamaños">
              <Button size="sm">Pequeño</Button>
              <Button size="md">Mediano</Button>
              <Button size="lg">Grande</Button>
            </Row>
            <Row label="Estados">
              <Button loading>Guardando…</Button>
              <Button disabled>Deshabilitado</Button>
              <Button variant="secondary" disabled>
                Deshabilitado
              </Button>
            </Row>
            <Row label="Solo icono">
              <IconButton label="Editar cliente" icon={<Pencil />} />
              <IconButton label="Más acciones" icon={<MoreHorizontal />} variant="secondary" />
            </Row>
          </div>
        </Panel>
      </Section>

      <Section
        id="formularios"
        title="Formularios"
        description="Label visible siempre; ayuda y error asociados al campo."
      >
        <Panel>
          <div className="grid max-w-3xl gap-5 md:grid-cols-2">
            <FormField label="Nombres" required hint="Como figura en el carnet de identidad.">
              {(p) => <Input {...p} placeholder="Ej.: Carla Andrea" />}
            </FormField>
            <FormField
              label="Cédula de identidad"
              required
              error="Ya existe un cliente registrado con este CI."
            >
              {(p) => <Input {...p} defaultValue="1234567" inputMode="numeric" />}
            </FormField>
            <FormField label="Tipo de tratamiento" required>
              {(p) => (
                <Select {...p} defaultValue="">
                  <option value="" disabled>
                    Selecciona una opción
                  </option>
                  <option>Fisioterapia</option>
                  <option>Rehabilitación</option>
                  <option>Estética</option>
                </Select>
              )}
            </FormField>
            <FormField label="Correo electrónico" optional>
              {(p) => <Input {...p} type="email" disabled defaultValue="carla@correo.com" />}
            </FormField>
            <FormField label="Observaciones" optional className="md:col-span-2">
              {(p) => (
                <Textarea {...p} placeholder="Notas administrativas visibles para recepción" />
              )}
            </FormField>
            <div className="flex flex-col gap-4 md:col-span-2">
              <Checkbox
                label="Enviar recordatorio 24 h antes"
                description="Recepción recibirá la tarea de confirmar."
                defaultChecked
              />
              <Switch
                label="Profesional activo"
                description="Los profesionales inactivos no aparecen al agendar."
                defaultChecked
              />
            </div>
            <div className="md:col-span-2">
              <SearchInput
                label="Buscar clientes"
                value={search}
                onChange={setSearch}
                placeholder="Nombre, CI o teléfono"
              />
            </div>
          </div>
        </Panel>
      </Section>

      <Section
        id="datos"
        title="Estados y datos del dominio"
        description="El estado nunca depende solo del color: siempre icono + texto."
      >
        <Panel>
          <div className="flex flex-col gap-5">
            <Row label="Estados de cita">
              {APPOINTMENT_STATUSES.map((s) => (
                <AppointmentStatusBadge key={s} status={s} />
              ))}
            </Row>
            <Row label="Categorías">
              {TREATMENT_CATEGORIES.map((c) => (
                <CategoryTag key={c} category={c} />
              ))}
            </Row>
            <Row label="Badges">
              <Badge tone="primary">Activo</Badge>
              <Badge>Inactivo</Badge>
              <Badge tone="danger" icon={<UserX aria-hidden="true" />}>
                3 inasistencias
              </Badge>
            </Row>
            <Row label="Avatar">
              <Avatar name="Carla Rojas" size="sm" />
              <Avatar name="Diego Pérez" />
              <Avatar name="María Torrez" size="lg" />
            </Row>
          </div>
        </Panel>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Panel title="Progreso del tratamiento">
            <div className="flex flex-col gap-6">
              <SessionProgress completed={4} planned={10} />
              <SessionProgress completed={2} planned={6} compact />
            </div>
          </Panel>
          <Panel title="Indicadores">
            <div className="grid gap-5 sm:grid-cols-3">
              <Stat label="Clientes activos" value={214} icon={<Users />} />
              <Stat label="Tratamientos" value={37} hint="activos" icon={<HeartPulse />} />
              <Stat label="Profesionales hoy" value="4/5" icon={<CalendarCheck />} />
            </div>
          </Panel>
        </div>
        <Panel title="Ficha" description="Lista de datos etiqueta / valor">
          <KeyValueList
            items={[
              { label: 'Cédula de identidad', value: '1234567 CB' },
              { label: 'Teléfono', value: '+591 712 34567' },
              { label: 'Fecha de nacimiento', value: '14/03/1992 (34 años)' },
              { label: 'Dirección', value: null },
            ]}
          />
        </Panel>
      </Section>

      <Section id="navegacion" title="Navegación interna">
        <Panel>
          <div className="flex flex-col gap-6">
            <SegmentedControl
              label="Vista de la agenda"
              value={view}
              onChange={setView}
              options={[
                { value: 'dia', label: 'Día' },
                { value: 'semana', label: 'Semana' },
              ]}
            />
            <Tabs defaultValue="resumen">
              <TabsList label="Secciones del cliente">
                <TabsTrigger value="resumen">Resumen</TabsTrigger>
                <TabsTrigger value="citas" count={12}>
                  Citas
                </TabsTrigger>
                <TabsTrigger value="tratamientos" count={2}>
                  Tratamientos
                </TabsTrigger>
                <TabsTrigger value="clinica">Historia clínica</TabsTrigger>
              </TabsList>
              <TabsContent value="resumen">
                <p className="text-body-sm text-fg-muted">Contenido de la pestaña Resumen.</p>
              </TabsContent>
              <TabsContent value="citas">
                <p className="text-body-sm text-fg-muted">Historial de citas.</p>
              </TabsContent>
              <TabsContent value="tratamientos">
                <p className="text-body-sm text-fg-muted">Tratamientos del cliente.</p>
              </TabsContent>
              <TabsContent value="clinica">
                <NoPermissionState
                  size="compact"
                  title="Información clínica restringida"
                  description="Solo el profesional asignado y la administración pueden verla."
                />
              </TabsContent>
            </Tabs>
          </div>
        </Panel>
      </Section>

      <Section id="overlays" title="Superposiciones y feedback">
        <Panel>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => setDialogOpen(true)}>
              Abrir diálogo
            </Button>
            <Button variant="secondary" onClick={() => setConfirmOpen(true)}>
              Confirmación destructiva
            </Button>
            <Button variant="secondary" onClick={() => setSheetOpen(true)}>
              Panel lateral
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" icon={<MoreHorizontal aria-hidden="true" />}>
                  Menú de acciones
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem icon={<Pencil aria-hidden="true" />}>Editar</DropdownMenuItem>
                <DropdownMenuItem icon={<UserPlus aria-hidden="true" />}>
                  Asignar profesional
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem icon={<Trash2 aria-hidden="true" />} destructive>
                  Cancelar cita
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="secondary"
              onClick={() =>
                toast.success('Cliente registrado', 'Carla Rojas ya puede agendar citas.')
              }
            >
              Toast de éxito
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                toast.error('No se pudo guardar', 'Revisa tu conexión e inténtalo de nuevo.')
              }
            >
              Toast de error
            </Button>
          </div>
        </Panel>
        <div className="flex flex-col gap-3">
          <InlineAlert tone="info" title="Horario sujeto a disponibilidad">
            Solo se muestran los horarios libres del profesional y del espacio.
          </InlineAlert>
          <InlineAlert
            tone="warning"
            title="5 citas de mañana sin confirmar"
            action={
              <Button size="sm" variant="secondary">
                Ver
              </Button>
            }
          />
          <InlineAlert tone="danger" title="El horario ya no está disponible">
            Otra persona reservó ese horario hace un momento. Elige una de las alternativas.
          </InlineAlert>
          <InlineAlert tone="success" title="Sesión registrada">
            El tratamiento avanzó a la sesión 5 de 10.
          </InlineAlert>
        </div>
      </Section>

      <Section
        id="estados"
        title="Estados de pantalla"
        description="Toda vista contempla carga, vacío, sin resultados, error y sin permiso."
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Panel title="Cargando" flush>
            <ListSkeleton rows={3} label="Cargando clientes…" />
          </Panel>
          <Panel title="Vacío">
            <EmptyState
              size="compact"
              icon={<Users />}
              title="Aún no hay clientes"
              description="Registra el primer cliente para agendar citas y dar seguimiento a sus tratamientos."
              action={<Button icon={<UserPlus aria-hidden="true" />}>Registrar cliente</Button>}
            />
          </Panel>
          <Panel title="Sin resultados">
            <NoResultsState query="Rojs" onClear={() => undefined} />
          </Panel>
          <Panel title="Error">
            <ErrorState size="compact" onRetry={() => undefined} />
          </Panel>
        </div>
      </Section>

      <Dialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Registrar asistencia"
        description="Carla Rojas · Fisioterapia · hoy 09:00"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => setDialogOpen(false)}>Marcar como atendida</Button>
          </>
        }
      >
        <FormField label="Nota" optional>
          {(p) => <Textarea {...p} rows={3} />}
        </FormField>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        destructive
        loading={confirmLoading}
        title="¿Cancelar esta cita?"
        description="La cita de Carla Rojas del lunes 29/09 a las 09:00 quedará cancelada y el horario se liberará. Esta acción no se puede deshacer."
        confirmLabel="Cancelar cita"
        cancelLabel="Volver"
        onConfirm={fakeConfirm}
      >
        <FormField label="Motivo de cancelación" required>
          {(p) => (
            <Select {...p} defaultValue="cliente">
              <option value="cliente">Solicitud del cliente</option>
              <option value="profesional">Ausencia del profesional</option>
              <option value="otro">Otro</option>
            </Select>
          )}
        </FormField>
      </ConfirmDialog>

      <Sheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Detalle de la cita"
        description="Lunes 29 de septiembre · 09:00 – 09:45"
        footer={
          <>
            <Button variant="secondary">Reprogramar</Button>
            <Button>Confirmar cita</Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <Avatar name="Carla Rojas" />
            <div>
              <p className="text-body-sm font-semibold text-fg">Carla Rojas Vda.</p>
              <p className="text-caption text-fg-subtle">CI 1234567 CB · +591 712 34567</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <AppointmentStatusBadge status="PENDIENTE" />
            <CategoryTag category="FISIOTERAPIA" />
          </div>
          <KeyValueList
            columns={1}
            items={[
              { label: 'Servicio', value: 'Fisioterapia lumbar' },
              { label: 'Profesional', value: 'Lic. Diego Pérez' },
              { label: 'Espacio', value: 'Camilla 2' },
              { label: 'Sesión', value: '5 de 10' },
            ]}
          />
        </div>
      </Sheet>
    </div>
  );
}
