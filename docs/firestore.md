# Modelo de datos en Firestore

## Principios

1. **Separar lo administrativo de lo clínico.** Los datos clínicos viven en la colección raíz `clinicalRecords`, que no es accesible desde el cliente. Solo se leen y escriben mediante Cloud Functions, que verifican el permiso y registran la auditoría.
2. **Desnormalizar lo que se lista.** `clientName`, `professionalName` y `serviceName` se copian en citas y tratamientos para evitar lecturas N+1. Un trigger mantiene la consistencia si cambia un nombre.
3. **Diseñar los campos para las reglas y las consultas:** `professionalId`, `date` (`YYYY-MM-DD` local), `status` y `searchKeywords`.
4. **Precalcular agregados.** `dailyStats` permite que un reporte mensual lea unos 30 documentos en lugar de miles de citas.

## Colecciones

| Colección                                                 | Campos principales                                                                                                                                                                                                       | Notas                                                                                        |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `users/{uid}`                                             | displayName, email, role, active, professionalId?, lastLoginAt, createdAt                                                                                                                                                | Espejo legible de los custom claims. Los tokens FCM van en la subcolección `devices/{token}` |
| `professionals/{id}`                                      | firstName, lastName, specialties[], serviceIds[], color, phone, active, userId?, weeklySchedule                                                                                                                          | Un profesional puede existir sin cuenta de acceso                                            |
| `professionals/{id}/exceptions/{id}`                      | dateFrom, dateTo, type (VACACIONES/PERMISO/BLOQUEO), note                                                                                                                                                                | Bloquean la disponibilidad                                                                   |
| `rooms/{id}`                                              | name, kind (CAMILLA/CABINA_ESTETICA/GIMNASIO), capacity, allowedCategories[], active                                                                                                                                     | Espacios físicos                                                                             |
| `services/{id}`                                           | name, category, durationMin, bufferMin, defaultSessions, roomKinds[], active                                                                                                                                             | Catálogo de servicios                                                                        |
| `clients/{id}`                                            | firstName, lastName, ci, ciExt?, phone, phoneE164, email?, birthDate, address?, adminNotes, status, assignedProfessionalIds[], searchKeywords[], stats{}, createdAt, createdBy                                           | Solo datos administrativos                                                                   |
| `clientCiIndex/{ci}`                                      | clientId                                                                                                                                                                                                                 | Garantiza un CI único (se escribe en la misma transacción)                                   |
| `appointments/{id}`                                       | clientId, clientName, professionalId, professionalName, roomId, serviceId, serviceName, category, treatmentId?, sessionNumber?, date, startAt, endAt, status, source, cancelReason?, reminderState, createdBy, updatedAt | Estados: PENDIENTE, CONFIRMADA, ATENDIDA, CANCELADA, NO_ASISTIO                              |
| `appointments/{id}/events/{id}`                           | type, from, to, actor{type, uid, channel}, at                                                                                                                                                                            | Historial inmutable de cambios                                                               |
| `treatments/{id}`                                         | clientId, clientName, professionalId, serviceId, category, startDate, plannedSessions, completedSessions, status, nextAppointmentAt?, lastSessionAt?                                                                     | Resumen **no clínico**, visible para recepción                                               |
| `treatments/{id}/sessions/{id}`                           | number, date, professionalId, appointmentId?, sessionType, status                                                                                                                                                        | Metadatos no clínicos para la línea de tiempo                                                |
| `clinicalRecords/{clientId}`                              | background, clinicalAlerts, accessProfessionalIds[]                                                                                                                                                                      | **Privado**, solo vía Functions                                                              |
| `clinicalRecords/{clientId}/treatmentPlans/{treatmentId}` | goals, indications, referral?                                                                                                                                                                                            | Privado                                                                                      |
| `clinicalRecords/{clientId}/sessionNotes/{sessionId}`     | treatmentId, observations, evolution, recommendations, painScale? (0–10), professionalId, createdAt                                                                                                                      | Privado                                                                                      |
| `reminders/{id}`                                          | appointmentId, clientId, type, channel, scheduledFor, status, attempts, lastError?, handledBy?                                                                                                                           | Cola de recordatorios                                                                        |
| `notifications/{id}`                                      | userId, title, body, link, read, createdAt                                                                                                                                                                               | Bandeja in-app del personal                                                                  |
| `dailyStats/{YYYY-MM-DD}`                                 | byStatus{}, byProfessional{}, byCategory{}, newClients                                                                                                                                                                   | Mantenida por un trigger                                                                     |
| `auditLogs/{id}`                                          | actor, action, entity, entityId, at, meta                                                                                                                                                                                | Solo la escribe el servidor y solo la lee el administrador                                   |
| `settings/clinic`                                         | name, timezone, openingHours, slotMinutes, reminderLeadHours                                                                                                                                                             | Configuración general                                                                        |

## Búsqueda de clientes

`searchKeywords` guarda prefijos normalizados (sin tildes y en minúsculas) de:

- nombre;
- apellido;
- CI;
- teléfono.

Se consulta con `array-contains` y se ordena por `lastNameLower`.

## Índices compuestos previstos

| Colección    | Campos                                                                                       |
| ------------ | -------------------------------------------------------------------------------------------- |
| appointments | (professionalId, date, startAt) · (roomId, date) · (clientId, startAt desc) · (date, status) |
| treatments   | (clientId, status) · (professionalId, status)                                                |
| clients      | (searchKeywords array, lastNameLower)                                                        |
| reminders    | (status, scheduledFor)                                                                       |

Los índices se agregan a `firestore.indexes.json` en la fase de cada módulo.

## Integridad de citas

`createAppointment` y `rescheduleAppointment` se ejecutan en una transacción del Admin SDK:

1. Validan la entrada (zod) y el permiso del actor.
2. Leen las citas activas del **profesional**, del **espacio** y del **cliente** en esa fecha.
3. Verifican que no haya solapamiento (`inicioA < finB && inicioB < finA`). También comprueban el horario semanal, las excepciones, el horario del consultorio, que el profesional realice el servicio y que el tipo de espacio sea compatible.
4. Si todo está libre, escriben la cita, su evento y el recordatorio. Si hay conflicto, devuelven `failed-precondition` con el motivo y las tres alternativas libres más cercanas.

**Máquina de estados:**

- PENDIENTE → CONFIRMADA → ATENDIDA.
- {PENDIENTE, CONFIRMADA} → CANCELADA.
- {PENDIENTE, CONFIRMADA} → NO_ASISTIO, solo después de la hora de inicio.
- Reprogramar devuelve la cita a PENDIENTE.
- Solo el administrador corrige estados finales, y debe indicar un motivo.

## Estado actual de las reglas

En la Fase 5, `firestore.rules` **deniega todo**. Cada módulo agrega sus reglas explícitas junto con sus pruebas en el emulador.
