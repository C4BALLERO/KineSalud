# Roles y permisos

## Roles

| Rol               | Descripción                                                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **ADMINISTRADOR** | Gestiona el consultorio completo: usuarios, configuración, personal y reportes. Puede estar vinculado a una ficha de profesional y atender con agenda propia |
| **RECEPCIONISTA** | Opera el día a día: clientes, agenda, confirmaciones y recordatorios. **Nunca** accede a información clínica                                                 |
| **PROFESIONAL**   | Atiende a sus pacientes: su agenda, registro de sesiones y evolución clínica de los pacientes asignados                                                      |

El rol se guarda como **custom claim** de Firebase Authentication (`role`, `professionalId`, `active`). Solo lo asigna la Cloud Function de gestión de usuarios, y el documento `users/{uid}` lo refleja para mostrarlo en pantalla.

## Matriz de permisos

La fuente de verdad es [`packages/shared/src/permissions.ts`](../packages/shared/src/permissions.ts). La usan la UI (`<Can>`, `RequirePermission`) y Cloud Functions.

Alcances:

- `all`: sobre cualquier registro.
- `own`: solo sobre registros asignados al profesional de la sesión.

| Permiso                | ADMINISTRADOR | RECEPCIONISTA | PROFESIONAL |
| ---------------------- | :-----------: | :-----------: | :---------: |
| `users.manage`         |      all      |       —       |      —      |
| `settings.manage`      |      all      |       —       |      —      |
| `staff.read`           |      all      |      all      |     own     |
| `staff.manage`         |      all      |       —       |      —      |
| `clients.read`         |      all      |      all      |     own     |
| `clients.write`        |      all      |      all      |      —      |
| `appointments.read`    |      all      |      all      |     own     |
| `appointments.manage`  |      all      |      all      |     own     |
| `appointments.correct` |      all      |       —       |      —      |
| `attendance.mark`      |      all      |      all      |     own     |
| `treatments.read`      |      all      |      all      |     own     |
| `treatments.manage`    |      all      |      all      |     own     |
| `clinical.read`        |      all      |       —       |     own     |
| `clinical.write`       |      all      |       —       |     own     |
| `reminders.manage`     |      all      |      all      |      —      |
| `payments.read`        |      all      |      all      |     own     |
| `payments.manage`      |      all      |      all      |      —      |
| `income.view`          |      all      |       —       |      —      |
| `reports.view`         |      all      |      all      |      —      |
| `reports.viewWorkload` |      all      |       —       |      —      |
| `audit.view`           |      all      |       —       |      —      |

**ADMINISTRADOR que atiende:** si tiene `professionalId`, además suma los permisos de PROFESIONAL sobre su propia agenda. Como ya tiene alcance `all`, en la práctica esto solo agrega su agenda personal a la vista "Mi día".

## Navegación por rol

| Sección       | ADMINISTRADOR | RECEPCIONISTA |   PROFESIONAL   |
| ------------- | :-----------: | :-----------: | :-------------: |
| Inicio        |       ✔       |       ✔       |    "Mi día"     |
| Agenda        |       ✔       |       ✔       |   "Mi agenda"   |
| Caja          |       ✔       |       ✔       |        —        |
| Clientes      |       ✔       |       ✔       | "Mis pacientes" |
| Tratamientos  |       ✔       |       ✔       |        ✔        |
| Personal      |       ✔       |       ✔       |        —        |
| Recordatorios |       ✔       |       ✔       |        —        |
| Reportes      |       ✔       |       ✔       |        —        |
| Usuarios      |       ✔       |       —       |        —        |
| Configuración |       ✔       |       —       |        —        |

La configuración está en [`apps/web/src/app/navigation.ts`](../apps/web/src/app/navigation.ts) y cubierta por pruebas.

## Protección en capas

1. **UI:** oculta secciones y acciones. Si alguien entra por URL a una sección no permitida, ve el estado "No tienes acceso a esta sección".
2. **Security Rules:** limitan las lecturas y bloquean las escrituras directas.
3. **Cloud Functions:** vuelven a validar el rol, el permiso y el alcance en cada comando.
4. **Auditoría:** registra los accesos y cambios de datos clínicos.

La UI nunca es la barrera de seguridad; solo mejora la experiencia.

### Citas: qué puede hacer cada rol

- **Agendar, reprogramar y cancelar** exige `appointments.manage` con alcance `all`: recepción y administración. El profesional (alcance `own`) no crea ni cancela citas.
- **Confirmar** una cita: `appointments.manage` sobre esa cita. Lo hacen recepción, administración o el profesional de la cita.
- **Registrar asistencia** (atendida o no asistió): `attendance.mark` sobre esa cita, desde la hora de inicio.
- **Corregir un estado final** (`appointments.correct`): solo la administración, con motivo obligatorio que queda en el historial y en la auditoría.

### Caja y cobros: qué puede hacer cada rol

- **Cobrar, abrir y cerrar la caja, y anular cobros de la caja abierta** (`payments.manage`): recepción y administración.
- **Ver cobros** (`payments.read`): recepción y administración, todos. El profesional ve solo los de sus sesiones ("Tus ingresos" en su inicio).
- **Ingresos globales del consultorio** (`income.view`): solo la administración. Incluye el mes completo, el reparto por profesional y por medio de pago. En su inicio, la recepción ve solo los ingresos del día y el estado de la caja.

### Tratamientos: qué puede hacer cada rol

- **Recepción y administración** abren, editan, finalizan, suspenden y reactivan cualquier tratamiento (`treatments.manage` con alcance `all`), y agendan sus sesiones.
- **El profesional** (alcance `own`) abre tratamientos solo a su nombre y para sus pacientes, y gestiona los suyos. No los reasigna a otro profesional ni agenda citas.

### Reportes: qué ve cada rol

- **Administración** (`reports.view`, `reports.viewWorkload`, `income.view`): todo, incluida la carga por profesional, los ingresos y el filtro por profesional. Además, puede recalcular las estadísticas.
- **Recepción** (`reports.view`): reportes operativos (citas, asistencia, áreas, tratamientos y clientes nuevos), sin carga por profesional ni ingresos.
- **Profesional:** no accede a Reportes. Su resumen está en "Mi día".
