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
| `attendance.mark`      |      all      |      all      |     own     |
| `treatments.read`      |      all      |      all      |     own     |
| `treatments.manage`    |      all      |      all      |     own     |
| `clinical.read`        |      all      |       —       |     own     |
| `clinical.write`       |      all      |       —       |     own     |
| `reminders.manage`     |      all      |      all      |      —      |
| `reports.view`         |      all      |      all      |      —      |
| `reports.viewWorkload` |      all      |       —       |      —      |
| `audit.view`           |      all      |       —       |      —      |

**ADMINISTRADOR que atiende:** si tiene `professionalId`, además suma los permisos de PROFESIONAL sobre su propia agenda. Como ya tiene alcance `all`, en la práctica esto solo agrega su agenda personal a la vista "Mi día".

## Navegación por rol

| Sección       | ADMINISTRADOR | RECEPCIONISTA |   PROFESIONAL   |
| ------------- | :-----------: | :-----------: | :-------------: |
| Inicio        |       ✔       |       ✔       |    "Mi día"     |
| Agenda        |       ✔       |       ✔       |   "Mi agenda"   |
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
