# Arquitectura

## 1. Visión general

```
┌─────────────── apps/web (React SPA, Firebase Hosting) ───────────────┐
│ Páginas → hooks de cada módulo → api/                                  │
│   consultas: SDK de Firestore (tiempo real, filtradas por reglas)      │
│   comandos:  httpsCallable → Cloud Functions                           │
└──────────────┬──────────────────────────────┬─────────────────────────┘
               │ lectura (Security Rules)     │ comandos (auth + zod)
        ┌──────▼───────┐           ┌──────────▼──────────────────────────┐
        │  Firestore   │◄──Admin───┤ functions/ (Node 22, 2.ª gen)       │
        └──────────────┘   SDK     │  api/callable   (web)               │
                                   │  api/http       (chatbot, etapa 2)  │
                                   │  domain/        servicios de negocio│
                                   │  triggers/      estadísticas, avisos│
                                   │  scheduled/     cola de recordatorios│
                                   │  notifications/ canales desacoplados│
                                   └─────────────────────────────────────┘
       packages/shared: tipos, enumeraciones, esquemas, permisos y algoritmo de disponibilidad
```

## 2. Patrón «lecturas directas, comandos por el servidor»

Es una variante ligera de CQRS.

- **Lecturas.** La web lee Firestore directamente con el SDK, lo que permite actualización en tiempo real (por ejemplo, la agenda se refresca sola). Las Security Rules determinan qué documentos puede leer cada rol.
- **Escrituras de negocio.** Pasan siempre por Cloud Functions _callable_. Incluyen el registro de clientes (CI único), las citas (transacción anti-solapamiento), el registro de sesiones (contador atómico), los usuarios (custom claims) y toda la información clínica (con auditoría). Las reglas prohíben escribir directamente en esas colecciones.

**Justificación**

1. Hay una sola ruta de validación, con los mismos esquemas en web y servidor.
2. La integridad transaccional está garantizada: el Admin SDK permite consultas dentro de transacciones y el SDK web no.
3. Hay auditoría de todas las operaciones sensibles.
4. El chatbot de la etapa 2 reutilizará la misma capa de dominio.

**Costo asumido:** la latencia de arranque en frío de Functions (~1–2 s) en la primera escritura. Se mitiga con estados de carga claros.

## 3. Estructura del repositorio

Es un monorepo con _npm workspaces_.

| Carpeta                            | Contenido                                                            |
| ---------------------------------- | -------------------------------------------------------------------- |
| `apps/web/src/app`                 | Router, proveedores globales y configuración de navegación por rol   |
| `apps/web/src/components/ui`       | Primitivas del Design System (Button, Input, Dialog…)                |
| `apps/web/src/components/layout`   | AppShell, Sidebar, Topbar, BottomNav, PageHeader                     |
| `apps/web/src/components/feedback` | Estados de pantalla: vacío, error, sin resultados, sin permiso       |
| `apps/web/src/components/domain`   | Componentes con conocimiento del dominio (estado de cita, categoría) |
| `apps/web/src/components/access`   | `<Can>` y `<RequirePermission>`                                      |
| `apps/web/src/features/<módulo>`   | `api/` (consultas y comandos), `components/`, `hooks/`, `pages/`     |
| `apps/web/src/lib`                 | Inicialización de Firebase y clientes de infraestructura             |
| `functions/src/domain`             | Servicios de negocio independientes del transporte                   |
| `functions/src/api`                | Adaptadores: `callable/` (web) y, en la etapa 2, `http/` (chatbot)   |
| `packages/shared/src`              | Código compartido sin dependencias de plataforma                     |

**Convenciones**

- El código está en inglés. La interfaz, la documentación y los códigos de enumeración están en español (`PENDIENTE`, `NO_ASISTIO`), tal como los define el proyecto.
- Ningún componente contiene lógica de acceso a datos: la lógica vive en los hooks y servicios de cada módulo.
- Ningún componente usa colores o medidas arbitrarias: todo sale de los tokens (ver [design-system.md](design-system.md)).

## 4. Bibliotecas y justificación

| Biblioteca                             | Motivo                                                                               |
| -------------------------------------- | ------------------------------------------------------------------------------------ |
| Vite                                   | Build rápido para una SPA. No se necesita SSR en un panel privado                    |
| React Router                           | Rutas anidadas, guardias por rol y enlaces profundos (`/agenda?fecha=…`)             |
| TanStack Query                         | Comandos (`useMutation`) con estados de carga y error uniformes; lecturas puntuales  |
| Tailwind CSS 4                         | Los tokens del Design System se definen en `@theme` y son la única paleta disponible |
| Radix UI                               | Primitivas accesibles (foco, teclado, ARIA) sin estilo impuesto                      |
| lucide-react                           | Una única familia de iconos, SVG y _tree-shakeable_                                  |
| clsx + tailwind-merge                  | Composición de clases sin conflictos                                                 |
| react-hook-form + zod                  | Formularios con los mismos esquemas que valida el servidor                           |
| date-fns _(Fase 10)_                   | Fechas en la zona `America/La_Paz`                                                   |
| Recharts _(Fase 14)_                   | Gráficos simples y accesibles, solo en Dashboard y Reportes                          |
| esbuild                                | Empaqueta Functions junto con `@kinesalud/shared` para el despliegue                 |
| @fontsource-variable/plus-jakarta-sans | Tipografía auto-alojada, sin dependencias externas en tiempo de ejecución            |

**Acceso a datos desde la web**

- **Lecturas en tiempo real:** `useLiveQuery` ([`hooks/useLiveQuery.ts`](../apps/web/src/hooks/useLiveQuery.ts)), una suscripción `onSnapshot` con estados explícitos (carga, éxito y error) y reintento.
- **Comandos:** `callFunction` ([`lib/callable.ts`](../apps/web/src/lib/callable.ts)) dentro de `useMutation`. Los errores se normalizan a `AppError`, con mensajes en español que vienen del dominio.
- **Autenticación:** [`features/auth/api/authApi.ts`](../apps/web/src/features/auth/api/authApi.ts). Los componentes nunca importan Firebase directamente.

**Lo que no se usa, y por qué**

- **Redux:** TanStack Query y Context bastan.
- **Storybook:** se sustituye por el catálogo interno `/dev/componentes`.
- **FullCalendar:** pesa mucho, tiene aspecto genérico y la vista de recursos es de pago.
- **Algolia:** la búsqueda por palabras clave en Firestore alcanza para el volumen de un consultorio.

## 5. Seguridad en capas

1. **UI.** Oculta lo que el rol no puede usar (`<Can>`, `RequirePermission`). Es solo experiencia de usuario, no seguridad.
2. **Security Rules.** Limitan las lecturas por rol y por asignación, y bloquean las escrituras directas.
3. **Cloud Functions.** Verifican autenticación, rol, permiso y alcance (`own`/`all`), validan con zod y aplican las reglas de negocio.
4. **Auditoría.** Los cambios de datos y cada lectura de información clínica quedan en `auditLogs`, visibles en la pantalla Auditoría.

Detalle, pasos opcionales (App Check) y riesgos residuales en [seguridad.md](seguridad.md).

## 6. Zona horaria

El consultorio opera en `America/La_Paz` (UTC−4, sin horario de verano).

- Las fechas se guardan como `Timestamp`.
- Además se guarda el campo `date` (`YYYY-MM-DD` en hora local) para consultar por día.
