# Avance por fases

| Fase                                                    | Estado                                  |
| ------------------------------------------------------- | --------------------------------------- |
| 1–4 · Análisis, arquitectura, Design System, wireframes | ✅ Aprobada (ver documentos de `docs/`) |
| 5 · Layout principal                                    | ✅ Aprobada                             |
| 6 · Autenticación                                       | ✅ Aprobada                             |
| 7 · Dashboard                                           | ✅ Aprobada                             |
| 8 · Clientes                                            | ✅ Aprobada                             |
| 9 · Personal y configuración                            | ✅ Aprobada                             |
| 10 · Agenda                                             | ✅ Aprobada                             |
| 10B · Cobros y caja                                     | ✅ Aprobada                             |
| 11 · Tratamientos                                       | ⏳                                      |
| 12 · Seguimiento                                        | ⏳                                      |
| 13 · Recordatorios                                      | ⏳                                      |
| 14 · Reportes                                           | ⏳                                      |
| 15 · Seguridad                                          | ⏳                                      |
| 16 · Pruebas y despliegue                               | ⏳                                      |

## Fase 5 — Layout principal

**Entregado**

- **Monorepo:** npm workspaces (`apps/web`, `functions`, `packages/shared`), TypeScript estricto, ESLint (con `jsx-a11y`), Prettier y CI en GitHub Actions.
- **`packages/shared`:** enumeraciones del dominio y matriz de permisos, con pruebas.
- **Design System:**
  - tokens con contraste verificado y paletas por defecto de Tailwind anuladas;
  - tipografía auto-alojada;
  - logo y favicon;
  - componentes base accesibles: acciones, formularios, datos, contenedores y feedback (ver [design-system.md](design-system.md#componentes)).
- **Layout responsive:**
  - sidebar en escritorio;
  - riel expandible en tablet/laptop;
  - navegación inferior con "Más" en móvil;
  - enlace para saltar al contenido.
- **Navegación por rol**, con guardias de ruta y estado "sin permiso".
- **Rutas provisionales** para todos los módulos, página 404, límite de errores y pantalla de carga.
- **Catálogo del Design System** en `/dev/componentes`.
- **Backend:** configuración de Firebase (emuladores, Hosting, reglas cerradas) y esqueleto de Functions con empaquetado esbuild.

## Fase 6 — Autenticación

**Entregado**

- **Firebase Authentication:**
  - el rol, el estado y el vínculo con el profesional viajan como _custom claims_;
  - el documento `users/{uid}` los refleja para la interfaz.
- **Cloud Functions** (`users-create`, `users-update`, `users-setActive`):
  - validación con esquemas compartidos y auditoría en `auditLogs`;
  - reglas de negocio: debe existir al menos un administrador activo, nadie puede cambiar su propio rol ni desactivar su propia cuenta, y si falla una creación se revierte la cuenta en Auth.
- **Sesión en la web:**
  - un cambio de rol se aplica de inmediato en la sesión abierta (versión de claims `cv`);
  - una desactivación cierra la sesión (tokens revocados más una escucha del propio documento).
- **Pantallas:**
  - login;
  - recuperar contraseña (sin revelar qué correos existen);
  - crear o restablecer contraseña (`/auth/accion`);
  - cuenta bloqueada;
  - "Mi cuenta", con cambio de contraseña que exige la actual;
  - Usuarios: filtros, tabla responsive, creación, edición, envío del enlace de acceso y desactivación con confirmación.
- **Flujo de alta segura:** el administrador nunca conoce ni asigna contraseñas. La cuenta nace sin contraseña y la persona crea la suya con el enlace que recibe por correo.
- **Security Rules** para `users` y `auditLogs`:
  - cada persona solo lee su propia cuenta y el administrador lee todas;
  - desde la web solo se puede escribir el último acceso, y con la hora del servidor;
  - todo lo demás está denegado.
- **Datos de demostración:** `npm run seed` crea una cuenta por rol en los emuladores.
- **Pruebas:**
  - servicio de usuarios y guardias de Functions (18);
  - esquemas compartidos (14);
  - web: login, guardias de ruta, layout por rol, formatos y errores (30);
  - Security Rules en el emulador (12).

**Verificado en el navegador, contra los emuladores**

- Login correcto e incorrecto.
- Regreso a la página solicitada.
- Crear cuenta: sin contraseña, con claims, correo de acceso y auditoría.
- Crear contraseña desde el enlace, y rechazo del enlace ya usado.
- Cambiar rol.
- Desactivar cuenta y bloqueo de su login.
- Acceso denegado a Usuarios para la recepcionista.
- "Mi cuenta" y recuperación de contraseña.
- Vista móvil.

**Corregido durante la revisión**

- Tras "Cerrar sesión", la siguiente persona que ingresaba era enviada a la última página de la anterior. Ahora un cierre de sesión voluntario no recuerda ningún destino.
- Accesibilidad del selector de rol: cada opción tiene nombre y descripción asociados.
- Mensajes: nombre vacío y error del rol con icono, y un texto de "Mi cuenta" adaptado al administrador.

## Fase 7 — Dashboard

**Entregado**

- **Modelo de datos compartido** (`packages/shared/src/domain.ts`): profesionales, espacios, servicios, clientes, citas y tratamientos, más utilidades de fecha en `America/La_Paz` (`toDateKey`, `startOfWeek`, `clinicDateTime`…).
- **Security Rules de lectura** para la operación:
  - administración y recepción leen todo;
  - el profesional solo lee sus citas, sus tratamientos y los clientes que tiene asignados;
  - los catálogos los lee todo el personal activo;
  - las escrituras siguen cerradas hasta que cada módulo tenga sus comandos en el servidor.
- **Índices compuestos** para las consultas del dashboard (`firestore.indexes.json`).
- **Dashboard por rol:**
  - administración y recepción ven todo el consultorio;
  - el profesional ve "Mi día";
  - un administrador que también atiende puede filtrar la agenda con "Todas / Mías".
- **Secciones:**
  - resumen del día en una sola franja (barra por estado con leyenda de texto e icono);
  - indicadores (clientes activos, tratamientos activos y profesionales que atienden hoy);
  - agenda de hoy, con la cita en curso resaltada;
  - alertas accionables (citas sin registrar asistencia, citas sin confirmar del próximo día hábil y tratamientos que terminan en la próxima sesión);
  - gráfico de citas de la semana, donde cada barra enlaza al día en la agenda.
- **Casos límite:**
  - si hoy no hay citas, se muestra el próximo día con citas;
  - el domingo, el gráfico muestra la semana que empieza al día siguiente;
  - sin alertas se lee "Todo en orden".
- **Datos de demostración:** `npm run seed` genera catálogos, 16 clientes, 10 tratamientos y dos semanas de citas en todos los estados, relativos a la fecha actual.
- **Pruebas:**
  - lógica del dashboard y componentes (16);
  - fechas y dominio compartido (8);
  - reglas de lectura operativa en el emulador (11).

**Corregido durante la revisión**

- **Scroll horizontal en móvil:** una grilla de una columna con pista `auto` crecía con el contenido. Se corrigió con `grid-cols-1` y se aplicó el mismo arreglo en "Mi cuenta" y en el catálogo.
- **"Nueva cita" duplicado en escritorio**, en la barra superior y en el encabezado.
- **Resumen comprimido** junto a los indicadores.
- **"Domingo 27 De Septiembre":** `capitalize` de CSS capitalizaba cada palabra.
- **Seed:** un mismo cliente aparecía dos veces el mismo día.
- **Color de la serie del gráfico:** validado con la guía de visualización de datos. El turquesa de la interfaz se leía gris en barras, así que se usa `chart-1` (`#008F99`).

## Fase 8 — Clientes

**Entregado**

- **Esquemas compartidos** (`packages/shared/src/clients.ts`): validación de nombres, carnet (con complemento y expedición), teléfono boliviano, correo y fecha de nacimiento. La web y las Functions usan los mismos esquemas y los mismos normalizadores (`normalizeCi`, `normalizePhone`, `buildClientSearchKeywords`).
- **Comandos en el servidor** (`clients-create`, `clients-update`, `clients-setStatus`):
  - el carnet es único gracias a una transacción sobre `clientCiIndex/{ci}`; si ya existe, el error indica el campo y el cliente existente;
  - cada cambio queda en `auditLogs`, y la edición registra solo los campos que cambiaron;
  - solo administración y recepción pueden escribir.
- **Listado** (`/clientes`):
  - búsqueda por nombre, apellido, carnet o teléfono, con espera de 300 ms entre teclas;
  - filtro por estado y orden por apellido o por fecha de registro;
  - los filtros viven en la URL, así que se pueden compartir y sobreviven a "Atrás";
  - paginación por cursor ("Cargar más clientes");
  - en escritorio es una tabla y en móvil, una lista de tarjetas.
- **"Mis pacientes":** el profesional ve solo los clientes que tiene asignados y los filtra en el navegador. Firestore admite una sola condición `array-contains` por consulta.
- **Registrar y editar:**
  - campos agrupados en Identificación, Contacto y Notas administrativas;
  - edad calculada en vivo;
  - aviso para no escribir datos clínicos en las notas;
  - validación al salir de cada campo;
  - aviso de cambios sin guardar al salir;
  - acciones fijas al pie en móvil.
  - Tras registrar, un aviso ofrece "Agendar cita".
- **Perfil** (`/clientes/:id`):
  - pestañas Resumen, Datos, Citas, Tratamientos e Historia clínica, enlazables con `?tab=`;
  - desactivar y reactivar, con confirmación;
  - un aviso cuando el cliente está inactivo;
  - el profesional solo ve sus propias citas y tratamientos;
  - la historia clínica muestra "restringida" a recepción y queda preparada para la Fase 12.
- **Pruebas:**
  - esquemas y normalización (shared);
  - servicio de clientes con un gateway simulado (9);
  - búsqueda, formatos y formulario: validación, datos normalizados y carnet duplicado (7);
  - reglas: nadie escribe clientes desde la web y `clientCiIndex` es privado (2 nuevas, 25 en total).

**Decisiones**

- **No se usa TanStack Table.** Las tablas son simples (sin orden por columna ni selección múltiple), y el orden y los filtros los resuelve Firestore. Un componente `DataTable` propio basta y pesa menos.
- **Búsqueda sin servicio externo.** Se consulta el primer término con `array-contains` sobre `searchKeywords`, y los demás términos se filtran en el navegador. Alcanza para el volumen de un consultorio.
- **Paginación por cursor** (`startAfter`) en lugar de páginas numeradas: Firestore no tiene `offset` eficiente.

## Fase 9 — Personal y configuración

**Entregado**

- **Esquemas compartidos:**
  - `schedule.ts`: horario semanal (tramos ordenados, sin superposiciones, máximo 4 por día) y utilidades como `daysOutsideHours` y `formatRanges`.
  - `staff.ts`: ficha del profesional, ausencias y `dayAvailability` (inactivo, ausente, no atiende o atiende en ciertos tramos).
  - `settings.ts`: consultorio, espacios, servicios y `compatibleRooms`.
- **Comandos en el servidor**, solo para administración y todos auditados:
  - `staff-create`, `staff-update` y `staff-setActive`. Los servicios asignados deben existir y pertenecer a las áreas del profesional.
  - `staff-setSchedule`: el horario debe caber en el horario de atención del consultorio.
  - `staff-addException` y `staff-removeException`: no se aceptan ausencias superpuestas ni ya terminadas, y se informa cuántas citas pendientes caen en esas fechas.
  - `staff-linkAccount`: vincula o desvincula la cuenta de acceso y actualiza el claim `professionalId` de las cuentas afectadas.
  - `settings-updateClinic`: avisa qué profesionales quedan fuera del nuevo horario.
  - `settings-saveRoom`, `settings-saveService` y los cambios de estado: nombres únicos sin distinguir mayúsculas ni tildes. No se puede cambiar el área de un servicio que ofrece un profesional de otra área.
- **Personal** (`/personal`):
  - directorio con filtros por área y estado;
  - disponibilidad de hoy con texto e icono ("Atiende hoy", "Vacaciones", "No atiende hoy");
  - horas por semana y cuenta vinculada.
- **Ficha** (`/personal/:id`), con pestañas:
  - Resumen: hoy, próximos 7 días, datos y cuenta de acceso;
  - Horario y ausencias: editor semanal y ausencias;
  - Servicios;
  - Próximas citas (14 días).
- **Alta y edición:**
  - áreas de atención con casillas y servicios agrupados por área;
  - al quitar un área se quitan sus servicios;
  - tras registrar, lleva a definir el horario.
- **Editor de horario semanal** (`WeeklyScheduleEditor`), reutilizado para el consultorio y para cada profesional:
  - toma el horario del consultorio como guía y bloquea los días en que está cerrado;
  - incluye "Copiar el lunes de martes a viernes";
  - valida por día y avisa de cambios sin guardar.
- **Configuración** (`/configuracion`), con pestañas:
  - Consultorio: nombre, intervalo de la agenda, anticipación del recordatorio y horario de atención;
  - Espacios;
  - Servicios: agrupados por área, con el aviso "Sin espacio compatible".
- **El profesional** consulta su propia ficha desde "Mi cuenta" y no ve las de otros.
- **Dashboard:** "Profesionales hoy" descuenta a quienes están ausentes.
- **Datos de demostración:** títulos, teléfonos normalizados y dos ausencias futuras.
- **Pruebas:**
  - esquemas y disponibilidad (13);
  - servicios de Personal y Configuración con gateways en memoria (17);
  - editor de horario, disponibilidad y formulario del profesional (8);
  - dashboard con ausencias (1);
  - reglas de ausencias y catálogos (26 en total).

**Decisiones**

- **Ausencias en una colección raíz** (`professionalExceptions`) en lugar de una subcolección. Así el directorio, el dashboard y la agenda consultan las de todo el personal con una sola consulta (`dateTo >= hoy`), sin índices de grupo de colecciones.
- **Ausencias por días completos.** Los bloqueos de pocas horas se resolverán en la agenda (Fase 10).
- **Nombres históricos:** las citas guardan el nombre del profesional y del servicio con que se agendaron; renombrar no reescribe el historial.
- **Toasts de advertencia:** nuevo tono para resultados que requieren una acción posterior, como una ausencia con citas pendientes.

## Fase 10 — Agenda

**Entregado**

- **Algoritmo de disponibilidad** (`packages/shared/src/availability.ts`), puro y compartido. Lo usa la web para ofrecer horarios y el servidor para validarlos. Considera:
  - el horario del profesional recortado al del consultorio, y sus ausencias;
  - los servicios que realiza cada profesional;
  - los espacios compatibles y libres;
  - la preparación posterior del servicio, que ocupa al profesional y al espacio pero no al cliente;
  - que un cliente no tenga dos citas a la vez;
  - los horarios que ya pasaron.

  Ante un conflicto, sugiere las 3 alternativas libres más cercanas.

- **Máquina de estados** (`appointments.ts`):
  - PENDIENTE pasa a CONFIRMADA;
  - una cita abierta pasa a ATENDIDA o NO_ASISTIO solo desde la hora de inicio;
  - una cita abierta pasa a CANCELADA con motivo obligatorio;
  - reprogramar la vuelve a PENDIENTE;
  - la administración corrige los estados finales indicando un motivo.
- **Comandos en el servidor:** `appointments-create`, `-reschedule`, `-changeStatus` y `-correctStatus`.
  - Todos corren en una transacción con candado por día. Se probó contra el emulador: de cinco reservas simultáneas del mismo horario, solo una se guarda.
  - Cada cambio queda en el historial inmutable de la cita (`appointments/{id}/events`) y en la auditoría.
  - Al agendar, el cliente pasa a figurar entre los pacientes del profesional.
  - Si la cita se vincula a un tratamiento, se numera la sesión y no se agendan más sesiones de las previstas.
  - Al atender, se suma la sesión al tratamiento y se registra la última visita del cliente. Una inasistencia suma al contador del cliente, y las correcciones revierten esos contadores.
- **Agenda** (`/agenda`):
  - Vista día con una columna por profesional: sombrea las horas no disponibles, marca ausencias y muestra la línea de la hora actual. Un clic en un hueco libre abre "Nueva cita" con el profesional y la hora ya puestos.
  - Vista semana con una columna por día.
  - En móvil, lista por día y un selector de días de la semana.
  - Filtros por profesional, área y estado, guardados en la URL junto con la cita abierta (`?cita=`).
  - El profesional ve "Mi agenda" con solo sus citas.
- **Detalle de la cita** en panel lateral:
  - datos y enlace al cliente;
  - acciones según el estado y el rol (confirmar, marcar atendida, no asistió, reprogramar, cancelar y corregir estado);
  - la asistencia aparece deshabilitada antes de la hora, con el motivo;
  - historial de cambios con quién hizo cada uno y cuándo.
- **Nueva cita** (`/agenda/nueva`), asistente de 5 pasos con resumen lateral:
  - cliente, con búsqueda y la opción de registrarlo y volver al asistente;
  - servicio, o continuar un tratamiento activo;
  - fecha y profesional (o "Cualquiera disponible");
  - horario libre;
  - confirmación, con estado inicial y una nota administrativa.

  Si alguien ocupa el horario mientras tanto, se ofrecen alternativas sin perder lo ya elegido.

- **Datos de demostración:**
  - el horario del consultorio ahora cubre el de todo el personal (estética atiende hasta las 19:00);
  - los espacios no se superponen, considerando la preparación;
  - las citas incluyen la preparación y la nota.
- **Pruebas:**
  - disponibilidad y estados (14);
  - servicio de citas con transacción en memoria (16);
  - concurrencia contra el emulador (2);
  - grilla, acciones, bloque de cita y selector de horarios (6);
  - reglas del historial (27 en total).

**Decisiones**

- **Calendario propio** en lugar de FullCalendar: la vista con una columna por profesional es de pago en FullCalendar, y así se mantiene la identidad visual.
- **Candado por día** (`scheduleLocks/{fecha}`) para serializar reservas; ver `docs/firestore.md`. Con el volumen de un consultorio no genera esperas perceptibles.
- **Espacio asignado automáticamente:** el primero compatible y libre. Quien agenda no tiene que elegirlo, aunque el comando admite uno explícito.
- **Asistencia y progreso del tratamiento:** marcar una cita como atendida suma la sesión al tratamiento. La Fase 12 agregará la nota clínica de esa sesión sin volver a contarla.
- **Nuevo permiso `appointments.correct`**, solo para la administración (ver `docs/roles-permisos.md`).

## Fase 10B — Cobros y caja

Módulo agregado a pedido del consultorio. En el plan original los pagos quedaban fuera de alcance; la facturación fiscal (SIN) sigue fuera.

**Decisiones del consultorio**

- **Medios de pago:** efectivo, QR / transferencia y tarjeta.
- **Qué se cobra:** cada sesión (cita), al precio del servicio, con descuento opcional y motivo.
- **Caja:** una sola, del consultorio, compartida por recepción y administración.
- **Ingresos visibles:**
  - la administración ve el día, el mes, por medio de pago y por profesional;
  - la recepción ve el día y la caja;
  - cada profesional ve lo que generaron sus sesiones.

**Entregado**

- **Precio por sesión** en el catálogo de servicios (Configuración → Servicios). Se guarda en la cita al agendar.
- **Caja** (`/caja`, recepción y administración):
  - **apertura** con el monto inicial en efectivo;
  - **por cobrar:** las sesiones de hoy sin pagar y las atendidas de días anteriores;
  - **cobros de la caja** con su medio de pago, descuento, recibido y cambio. Se pueden anular con motivo mientras la caja está abierta;
  - **cierre con arqueo:** efectivo esperado (inicial + cobros en efectivo) frente al contado, con la diferencia marcada como "Cuadra", "Sobran" o "Faltan". Si no cuadra, la observación es obligatoria. QR y tarjeta se informan aparte;
  - **historial de cierres** con sus diferencias.
- **Cobro de una sesión**, desde la caja o desde el detalle de la cita:
  - muestra el total con el descuento aplicado;
  - en efectivo, **calcula el cambio a devolver** mientras se escribe el monto recibido, con montos frecuentes a un toque (exacto y redondeos a billetes de 10, 20, 50, 100 y 200);
  - en QR o tarjeta se registra el número de operación (opcional).
- **Detalle de la cita:** estado de pago ("Pagada" o "Por cobrar") y botón "Cobrar". Una cita pagada no se cancela sin anular antes el cobro.
- **Dashboard:**
  - **administración:** ingresos de hoy y del mes, sesiones por cobrar, estado de la caja, un gráfico de ingresos por día y el reparto por medio de pago y por profesional;
  - **recepción:** lo cobrado hoy por medio de pago, sesiones por cobrar y estado de la caja;
  - **profesional:** "Tus ingresos" de hoy y del mes.
- **Servidor:** `cash-open`, `cash-close`, `cash-charge` y `cash-voidPayment`. Cada uno corre en una transacción y queda en la auditoría (ver "Caja y cobros" en `docs/firestore.md`).
- **Reglas:**
  - el profesional solo lee los cobros de sus sesiones;
  - la caja la leen solo recepción y administración;
  - los ingresos globales, solo la administración;
  - nadie escribe estas colecciones desde la web.
- **Datos de demostración:**
  - precios de los servicios;
  - citas desde el inicio del mes;
  - una caja por jornada, con cobros por los tres medios de pago, algunos descuentos y un cierre con faltante;
  - la caja de hoy abierta y algunas sesiones sin cobrar.
- **Pruebas:**
  - montos, cambio y reglas de cobro (9);
  - servicio de caja con transacción en memoria (10);
  - cita pagada no cancelable (1);
  - diálogo de cobro y modelo de caja (7);
  - reglas de las nuevas colecciones (3).

**Decisiones técnicas**

- **Montos en centavos enteros.** El campo de monto es de texto y acepta "150", "150,50" o "1.500".
- **Ingresos del mes precalculados** en `incomeStats/{mes}`: el dashboard de administración hace una sola lectura en lugar de leer cada cobro.
- **Anular en lugar de borrar**, y solo en la caja abierta: el arqueo de una caja cerrada no cambia después.
