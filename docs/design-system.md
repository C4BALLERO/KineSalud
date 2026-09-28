# Design System — Kinesalud y Vida

**Identidad:** clínica moderna, cálida y precisa. Es un estilo minimalista y funcional aplicado a la salud:

- aire generoso;
- jerarquía tipográfica fuerte;
- separación con bordes en lugar de sombras;
- color con significado, nunca decorativo.

Los tokens están en [`apps/web/src/styles/tokens.css`](../apps/web/src/styles/tokens.css). **Las paletas por defecto de Tailwind están anuladas**, así que en el código solo existen estos tokens. El catálogo visual está en `/dev/componentes`, solo en desarrollo.

## Color

Los contrastes se midieron con la fórmula WCAG 2.x. Salvo que se indique otra cosa, están calculados sobre blanco.

| Token            | Valor     | Uso                                            | Contraste                             |
| ---------------- | --------- | ---------------------------------------------- | ------------------------------------- |
| `primary`        | `#0F766E` | Acción primaria, enlaces, foco                 | 5.47:1                                |
| `primary-hover`  | `#115E59` | Hover y activo                                 | 7.58:1                                |
| `primary-subtle` | `#F0FDFA` | Ítem activo, selección                         | —                                     |
| `secondary`      | `#B34A33` | Acento cálido de marca ("y Vida"), uso puntual | 5.32:1                                |
| `canvas`         | `#F6F8F8` | Fondo de la aplicación                         | —                                     |
| `surface`        | `#FFFFFF` | Paneles, tablas, formularios                   | —                                     |
| `surface-muted`  | `#EEF2F1` | Encabezados de tabla, hover, deshabilitado     | —                                     |
| `fg`             | `#14211F` | Texto principal                                | 16.57:1                               |
| `fg-muted`       | `#51605E` | Texto secundario                               | 6.59:1                                |
| `fg-subtle`      | `#62716F` | Metadatos y placeholders                       | 5.11:1 (4.53:1 sobre `surface-muted`) |
| `border`         | `#DDE4E3` | Divisores (decorativo)                         | —                                     |
| `border-strong`  | `#C4CECC` | Separadores con énfasis                        | —                                     |
| `border-control` | `#808E8B` | Límites de inputs, checkbox y select           | 3.41:1 (WCAG 1.4.11)                  |
| `success`        | `#15803D` | Atendida, guardado                             | 4.79:1 sobre `success-subtle`         |
| `warning`        | `#B45309` | Pendiente, alertas                             | 4.84:1 sobre `warning-subtle`         |
| `danger`         | `#B91C1C` | Error, no asistió, eliminar                    | 5.91:1 sobre `danger-subtle`          |
| `info`           | `#1D4ED8` | Confirmada, avisos                             | 6.16:1 sobre `info-subtle`            |

**Ajustes hechos al verificar el contraste**

- `fg-subtle` cambió de `#6B7A78` (4.49:1, no cumplía) a `#62716F`.
- `secondary` cambió de `#C2553D` (4.51:1, al límite) a `#B34A33`.
- Se agregó `border-control` porque el borde original de los inputs (1.61:1) no cumplía el mínimo de 3:1 para límites de controles.

### Colores de dominio

Siempre van acompañados de texto o icono; el color nunca es la única señal.

| Categoría      | Token                          | Contraste |
| -------------- | ------------------------------ | --------- |
| Fisioterapia   | `cat-fisioterapia` `#0369A1`   | 5.93:1    |
| Rehabilitación | `cat-rehabilitacion` `#4D7C0F` | 4.99:1    |
| Estética       | `cat-estetica` `#BE185D`       | 6.04:1    |

| Estado de cita | Tono    | Icono (Lucide) |
| -------------- | ------- | -------------- |
| Pendiente      | warning | `Clock`        |
| Confirmada     | info    | `CircleCheck`  |
| Atendida       | success | `CheckCheck`   |
| Cancelada      | neutral | `CircleX`      |
| No asistió     | danger  | `UserX`        |

## Tipografía

Se usa una sola familia: **Plus Jakarta Sans Variable**, auto-alojada. Las horas, tablas y KPIs usan cifras tabulares (clase `tabular`).

| Token           | Tamaño / interlineado | Peso | Uso                                       |
| --------------- | --------------------- | ---- | ----------------------------------------- |
| `text-display`  | 30/36                 | 600  | Saludo del dashboard, KPI principal       |
| `text-h1`       | 24/32                 | 600  | Título de página                          |
| `text-h2`       | 18/28                 | 600  | Sección, título de diálogo                |
| `text-h3`       | 16/24                 | 600  | Título de panel                           |
| `text-body`     | 15/24                 | 400  | Texto general                             |
| `text-body-sm`  | 14/20                 | 400  | Tablas, labels, botones                   |
| `text-caption`  | 13/18                 | 400  | Ayudas y errores de campo                 |
| `text-overline` | 12/16                 | 600  | Encabezados de grupo (en mayúsculas)      |
| `text-tab`      | 11/14                 | 500  | Solo etiquetas de la barra inferior móvil |

En móvil, los inputs usan 16 px para evitar el zoom automático de iOS.

## Espaciado, radios y sombras

- **Espaciado:** base 4 px (4, 8, 12, 16, 20, 24, 32, 40, 48, 64).
- **Padding de página:** 16 px (móvil), 24 px (tablet) y 32 px (escritorio).
- **Radios:**
  - `sm` 6 px: badges.
  - `md` 8 px: inputs y botones.
  - `lg` 12 px: paneles y diálogos.
  - `full`: avatares.
- **Sombras:** solo tres niveles.
  - `sm`: elementos elevados.
  - `md`: menús y popovers.
  - `lg`: diálogos y paneles laterales.
  - Los paneles normales usan borde, no sombra.

## Estados de interacción

| Estado        | Tratamiento                                                                            |
| ------------- | -------------------------------------------------------------------------------------- |
| Hover         | Fondo `surface-muted` o `primary-hover`, 150 ms                                        |
| Foco          | Contorno de 2 px `primary` con separación de 2 px (`:focus-visible`), nunca se elimina |
| Deshabilitado | Opacidad 50 % y `cursor-not-allowed`; en inputs, fondo `surface-muted`                 |
| Error         | Borde `danger`, mensaje bajo el campo con icono y `aria-invalid`                       |
| Carga         | Spinner en el botón, `aria-busy` y botón bloqueado (evita el doble envío)              |

## Movimiento

- Duraciones: 150 ms (hover), 200 ms (popover y toast) y 250 ms (diálogo y panel).
- La salida es más rápida que la entrada.
- Se respeta `prefers-reduced-motion`.
- No hay animaciones decorativas.

## Objetivos táctiles

- Mínimo 44 × 44 px en pantallas pequeñas.
- 36–40 px de alto en escritorio.

## Iconografía

- **Solo Lucide**, con trazo de 1.75.
- Tamaños: 20 px en navegación y 16 px en línea.
- Los iconos decorativos llevan `aria-hidden`.
- Los botones que solo tienen icono exigen `label` (nombre accesible y tooltip).
- No se usan emojis como iconos.

## Logo

- **Símbolo:** una figura humana en movimiento que forma una "K": el cuerpo, el brazo que se eleva (recuperación) y la pierna que avanza (movimiento). La cabeza va en un tono arcilla claro, que representa la "Vida".
- **Variantes:**
  - `full`: símbolo + nombre, para el sidebar y el login.
  - `symbol`: solo el símbolo, para el riel y el favicon.
- **Archivos:** [`Logo.tsx`](../apps/web/src/components/brand/Logo.tsx) y [`favicon.svg`](../apps/web/public/favicon.svg).

## Layout responsive

| Ancho                       | Navegación                                               |
| --------------------------- | -------------------------------------------------------- |
| < 768 px (móvil)            | Barra superior + navegación inferior (4 accesos + "Más") |
| 768–1279 px (tablet/laptop) | Riel de iconos (72 px) expandible                        |
| ≥ 1280 px (escritorio)      | Sidebar completo (248 px) con grupos                     |

## Componentes

| Grupo        | Componentes                                                                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Acciones     | Button, IconButton, SegmentedControl                                                                                                                                |
| Formularios  | FormField, Input, Textarea, Select, Checkbox, Switch, SearchInput, PasswordInput (mostrar/ocultar y aviso de Bloq Mayús), RadioCardGroup (opciones con descripción) |
| Datos        | Badge, AppointmentStatusBadge, CategoryTag, Avatar, KeyValueList, Stat, ProgressBar, SessionProgress, DataTable (tabla desde md, tarjetas en móvil)                 |
| Contenedores | Panel, Tabs, Dialog, ConfirmDialog, Sheet, DropdownMenu, Tooltip                                                                                                    |
| Feedback     | Toast (`useToast`), Skeleton, ListSkeleton, Spinner, InlineAlert, EmptyState, NoResultsState, ErrorState, NoPermissionState                                         |
| Layout       | AppShell, Sidebar, Topbar, BottomNav, PageHeader, GlobalSearch, UserMenu, NotificationsButton                                                                       |
| Acceso       | Can, RequirePermission                                                                                                                                              |

Cada módulo agregará en su fase los componentes que necesite: Combobox, DatePicker, SlotPicker, CalendarGrid, Timeline, Stepper y PainScaleInput. DataTable incorporará ordenamiento y paginación (TanStack Table) en el módulo de Clientes.
