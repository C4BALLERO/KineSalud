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
| 11 · Tratamientos                                       | ✅ Aprobada                             |
| 12 · Seguimiento (y módulo de Servicios)                | ✅ Completada — pendiente de revisión   |
| 13 · Recordatorios                                      | ✅ Completada — pendiente de revisión   |
| 14 · Reportes                                           | ✅ Completada — pendiente de revisión   |
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

- **Precio por sesión** en el catálogo de servicios (hoy en el módulo Servicios). Se guarda en la cita al agendar.
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

## Fase 11 — Tratamientos

**Entregado**

- **Listado** (`/tratamientos`):
  - administración y recepción ven los del consultorio; el profesional, solo los suyos;
  - búsqueda por cliente o servicio (sin distinguir tildes);
  - filtros por estado, área, profesional y "por terminar" (2 sesiones o menos), guardados en la URL;
  - progreso "n de N" en cada fila. En móvil se muestra como tarjetas.
- **Nuevo tratamiento** (`/tratamientos/nuevo`, también desde el perfil del cliente):
  - cliente, servicio y profesional; solo se ofrecen los profesionales que realizan el servicio;
  - fecha de inicio, sesiones previstas (con el valor sugerido del servicio) y una nota administrativa;
  - el profesional solo abre tratamientos a su nombre y para sus pacientes.
- **Detalle** (`/tratamientos/:id`):
  - progreso con sesiones realizadas, agendadas y por agendar, la próxima sesión, la última y las inasistencias;
  - **línea de tiempo** de las sesiones: realizadas, agendadas, perdidas o canceladas (atenuadas) y las que faltan agendar, con acceso directo a la agenda;
  - **Agendar sesión** abre el asistente de citas con el cliente, el servicio, el profesional y el tratamiento ya elegidos;
  - al completar las sesiones previstas, sugiere finalizar el tratamiento o ampliarlo.
- **Acciones:**
  - **editar:** profesional, sesiones previstas y nota. Las sesiones previstas no pueden quedar por debajo de las realizadas más las agendadas;
  - **finalizar, suspender y reactivar**, con motivo cuando corresponde.
- **Reglas de negocio** (en `packages/shared/src/treatments.ts`, las mismas en la web y el servidor):
  - un cliente no tiene dos tratamientos activos del mismo servicio;
  - un tratamiento con citas agendadas no se finaliza ni se suspende: primero se cancelan esas citas;
  - el motivo es obligatorio al suspender, al finalizar antes de completar las sesiones y al reabrir uno finalizado;
  - el contador de tratamientos activos del cliente se mantiene en la misma transacción.
- **Servidor:** `treatments-create`, `-update` y `-changeStatus`, en transacción y con auditoría.
- **Perfil del cliente:** la pestaña Tratamientos enlaza a cada detalle y permite abrir uno nuevo.
- **Datos de demostración:**
  - las sesiones de cada tratamiento se numeran en orden y nunca superan las previstas;
  - hay tratamientos por terminar, completos, uno suspendido con motivo y uno finalizado.
- **Pruebas:**
  - estados y esquemas (6);
  - servicio de tratamientos (9);
  - listado, progreso, línea de tiempo y diálogos (7);
  - reglas de las citas por tratamiento (2).

**Decisiones**

- **Lo clínico queda para la Fase 12.** Objetivos, indicaciones y evolución son datos clínicos con acceso restringido y auditado. El tratamiento guarda solo datos administrativos, que la recepción puede ver.
- **La línea de tiempo se arma con las citas** vinculadas al tratamiento, sin duplicar la información en otra colección.
- **Consultas solo por igualdad**, ordenadas en la web: no necesitan índices compuestos nuevos.

## Fase 14 — Reportes

Se adelantó a pedido del consultorio. Las Fases 12 (Seguimiento) y 13 (Recordatorios) siguen pendientes.

**Entregado**

- **Resúmenes diarios mantenidos por triggers:**
  - `dailyStats/{fecha}`: citas por profesional, área y estado, minutos atendidos y clientes nuevos;
  - `dailyIncome/{fecha}`: cobros válidos por medio de pago, profesional y área (solo administración).

  Cada cambio de una cita, un cobro o un cliente nuevo recalcula el día completo desde los datos originales. Así el resultado no cambia si el trigger se reintenta, y una cita reprogramada actualiza los dos días.

- **Recalcular** (`reports-rebuild`, solo administración): vuelve a calcular un período de hasta 366 días. Sirve para datos cargados antes de activar los reportes o para reparar una cifra.
- **Pantalla de reportes** (`/reportes`, administración y recepción):
  - **período:** hoy, esta semana, este mes, mes anterior, últimos 30 días, este año o un rango personalizado;
  - **filtros:** área y, para la administración, profesional. Todo queda guardado en la URL;
  - **indicadores:** citas, atendidas (con horas), asistencia, cancelaciones, clientes nuevos y, para la administración, ingresos;
  - **gráfico de citas por estado:** se agrupa por día, por semana o por mes según el largo del período, con leyenda y detalle en cada barra;
  - **por área:** citas, atendidas y asistencia;
  - **tratamientos:** iniciados y finalizados en el período, activos y suspendidos hoy;
  - **carga por profesional** (solo administración): citas, atendidas, horas, asistencia, cancelaciones e ingresos;
  - **ingresos** (solo administración): total, cantidad de cobros, promedio por cobro, gráfico del período y reparto por medio de pago y por área;
  - **exportar CSV** del detalle por día, con ";" y tildes correctas para abrirlo en Excel.
- **Reglas:** la recepción y la administración leen `dailyStats`; `dailyIncome` es solo de la administración; nadie los escribe desde la web.
- **Datos de demostración:** cuatro semanas de historia antes de la semana actual.
- **Verificación con el emulador:** después de cargar los datos, los resúmenes cuentan las 275 citas y suman exactamente lo mismo que los cobros válidos.
- **Pruebas:**
  - agregación, filtros, tasas, agrupación y recálculo (7 en el dominio compartido, 3 en el servidor);
  - períodos, series, CSV y gráfico (7 en la web);
  - reglas (2).

**Decisiones**

- **Recalcular el día en lugar de sumar o restar:** con incrementos, un reintento del trigger contaría dos veces. Recalcular cuesta unas decenas de lecturas por cambio, que con el volumen de un consultorio no se nota.
- **Celdas por profesional y área:** permiten filtrar por cualquiera de los dos, o por ambos, con un documento por día.
- **Ingresos en una colección aparte:** así la recepción no puede leer los ingresos por profesional.
- **Gráficos propios con CSS:** como en el dashboard, sin agregar una biblioteca de gráficos.

## Fase 12 — Seguimiento clínico y módulo de Servicios

**Entregado: seguimiento clínico**

- **Registrar sesión** (`/citas/:id/sesion`, desde el detalle de la cita o el aviso de "Mi día"):
  - observaciones (obligatorias), evolución, recomendaciones y dolor al llegar y al terminar (EVA 0–10);
  - muestra las alertas clínicas del paciente y el número de sesión del tratamiento;
  - si la cita no estaba marcada como atendida, la marca en la misma operación, sin contar la sesión dos veces;
  - la nota la edita su autor durante 7 días; después, solo la administración;
  - avisa si se sale con cambios sin guardar.
- **Historia clínica** (pestaña del perfil del cliente): alertas destacadas (alergias, contraindicaciones), antecedentes editables y todas las notas de sesión.
- **Tratamiento:** pestañas **Plan** (motivo y evaluación, objetivos, indicaciones; lo define el profesional del tratamiento) y **Evolución** (gráfico del dolor antes y después por sesión, más las notas).
- **"Mi día"** avisa al profesional de sus sesiones atendidas sin registrar.
- **Privacidad:**
  - `clinicalRecords` está cerrada a la web para todos los roles; se accede solo por `clinical-*`;
  - la recepción nunca ve información clínica;
  - cada lectura queda en la auditoría, y las pestañas clínicas solo consultan al abrirse.

**Entregado: módulo de Servicios** (`/servicios`, en el menú de administración y recepción)

- **Listado** con búsqueda, filtros por área y estado, y una columna de quién realiza cada servicio.
- **Avisos** de servicio sin precio, sin espacio compatible o sin profesional que lo realice.
- **CRUD completo** (administración):
  - crear, editar y **duplicar**;
  - activar y desactivar;
  - **asignar profesionales** desde el servicio, validando que atiendan el área;
  - **eliminar** un servicio sin historial. Uno con citas o tratamientos se rechaza con el detalle y la sugerencia de desactivarlo.
- **Configuración** queda con Consultorio y Espacios; los enlaces viejos a la pestaña de servicios redirigen al módulo.
- **Servidor:** `settings-deleteService` y `settings-setServiceProfessionals`, con auditoría.

**Verificación**

- **Pruebas:**
  - reglas clínicas, permisos y escala EVA (6 en el dominio compartido);
  - servicio clínico (7) y eliminar o asignar servicios (3) en el servidor;
  - escala, nota, gráfico, aviso y servicios (8) en la web;
  - reglas: nadie lee `clinicalRecords` desde la web (1).
- **Integración contra el emulador:**
  - registrar sesión actualiza cita, tratamiento, cliente y nota en la misma transacción;
  - dos registros simultáneos de la misma cita guardan uno solo.

  Las pruebas de integración ahora corren de a un archivo por vez, porque comparten el emulador.

- **Datos de demostración** (ficticios): antecedentes y alertas, planes de tratamiento y notas con el dolor bajando sesión a sesión. Algunas sesiones quedan sin registrar, para el aviso.

**Decisiones**

- **Lecturas clínicas por función, no con suscripciones:** así cada acceso queda auditado, a cambio de no actualizarse en tiempo real (se recargan después de cada cambio).
- **Una nota por cita, con el mismo id:** evita duplicados sin consultas adicionales.
- **Color nuevo para gráficos `--color-chart-2` (arcilla):** se validó junto al turquesa para daltonismo (ΔE 13,9) y visión normal (ΔE 24,6).

## Fase 13 — Recordatorios

Los clientes no tienen la app, así que el recordatorio es **asistido**. El sistema programa y organiza el trabajo; recepción contacta al cliente con un toque y registra lo que respondió.

**Entregado**

- **Programación automática.** Un trigger mantiene un recordatorio por cita (`reminders/{idCita}`):
  - se programa `reminderLeadHours` antes de la cita (24 h por defecto, en Configuración → Consultorio), o de inmediato si la cita es más próxima;
  - reprogramar la cita lo reinicia, y cancelarla o cerrarla lo anula;
  - es idempotente, y se verificó en el emulador creando y cancelando una cita.
- **Cola cada 15 minutos** (`triggers-processReminders`, Cloud Scheduler). Los recordatorios vencidos pasan a **"Por gestionar"** y se avisa al personal de recepción y administración por cada canal:
  - **bandeja in-app**: la campana del encabezado, con contador, en tiempo real;
  - **push del navegador** (FCM), opcional: se activa por dispositivo en "Mi cuenta".

  Un canal que falla no frena la cola. Tras 3 errores de procesamiento, el recordatorio queda **Fallido**. La administración tiene "Procesar ahora" (`reminders-runNow`), que también sirve en el emulador, donde las tareas programadas no corren.

- **Pantalla Recordatorios** (`/recordatorios`), con tres pestañas:
  - **Por gestionar**: botón **WhatsApp**, que abre el chat con el mensaje ya redactado (día, hora, servicio y profesional, sin datos clínicos), y botón **Llamar**;
  - **Programados**;
  - **Gestionados**.
- **Resultado del contacto:**
  - "Confirmó" confirma la cita pendiente (si ya estaba confirmada, el botón dice "Avisado");
  - "No respondió" la deja en la cola para reintentar;
  - "Canceló" pide el motivo y cancela la cita, con las mismas reglas de la agenda (una cita pagada no se cancela sin anular antes el cobro).
- **Inicio de recepción:** aviso "N recordatorios por gestionar".
- **Reglas:**
  - recordatorios: solo lectura para recepción y administración;
  - notificaciones: cada persona ve las suyas y solo puede marcarlas como leídas;
  - dispositivos push: cada persona registra los suyos.
- **Pruebas:**
  - plan, mensaje y enlace de WhatsApp (6 en el dominio compartido);
  - programación, cola y gestión (8 en el servidor);
  - fila de recordatorio y aviso (5 en la web);
  - reglas (3).
- **Datos de demostración:** recordatorios en todos los estados y avisos en la campana de recepción y de administración.

**Decisiones**

- **Contacto asistido en lugar de envío automático:** la API de WhatsApp Business tiene costo y requiere una verificación del negocio. El canal está desacoplado (`NotificationChannel`), así que se puede agregar en la etapa 2 sin tocar el dominio.
- **Un recordatorio por cita, con su mismo id:** evita duplicados y simplifica el trigger.
- **Push solo para el personal**, sin datos de pacientes. Requiere la clave Web Push del proyecto (ver `docs/despliegue.md`); sin ella, la opción no se ofrece.
