# Modelo de datos en Firestore

## Principios

1. **Separar lo administrativo de lo clínico.** Los datos clínicos viven en la colección raíz `clinicalRecords`, que no es accesible desde el cliente. Solo se leen y escriben mediante Cloud Functions, que verifican el permiso y registran la auditoría.
2. **Desnormalizar lo que se lista.** `clientName`, `professionalName` y `serviceName` se copian en citas y tratamientos para evitar lecturas N+1. Un trigger mantiene la consistencia si cambia un nombre.
3. **Diseñar los campos para las reglas y las consultas:** `professionalId`, `date` (`YYYY-MM-DD` local), `status` y `searchKeywords`.
4. **Precalcular agregados.** `dailyStats` permite que un reporte mensual lea unos 30 documentos en lugar de miles de citas.

## Colecciones

| Colección                                                 | Campos principales                                                                                                                                                                                                                                                                  | Notas                                                                                        |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `users/{uid}`                                             | displayName, email, role, active, professionalId?, lastLoginAt, createdAt                                                                                                                                                                                                           | Espejo legible de los custom claims. Los tokens FCM van en la subcolección `devices/{token}` |
| `professionals/{id}`                                      | title?, firstName, lastName, displayName, specialties[], categories[], serviceIds[], phone?, active, userId?, weeklySchedule                                                                                                                                                        | Un profesional puede existir sin cuenta de acceso                                            |
| `professionalExceptions/{id}`                             | professionalId, dateFrom, dateTo, type (VACACIONES/PERMISO/BLOQUEO), note?, createdBy                                                                                                                                                                                               | Colección raíz: la agenda consulta las ausencias de todo el personal en una sola consulta    |
| `rooms/{id}`                                              | name, kind (CAMILLA/CABINA_ESTETICA/GIMNASIO), capacity, allowedCategories[], active                                                                                                                                                                                                | Espacios físicos                                                                             |
| `services/{id}`                                           | name, category, durationMin, bufferMin, defaultSessions, roomKinds[], priceCents, active                                                                                                                                                                                            | Catálogo de servicios                                                                        |
| `clients/{id}`                                            | firstName, lastName, ci, ciExt?, phone, phoneE164, email?, birthDate, address?, adminNotes, status, assignedProfessionalIds[], searchKeywords[], stats{}, createdAt, createdBy                                                                                                      | Solo datos administrativos                                                                   |
| `clientCiIndex/{ci}`                                      | clientId                                                                                                                                                                                                                                                                            | Garantiza un CI único (se escribe en la misma transacción)                                   |
| `appointments/{id}`                                       | clientId, clientName, professionalId, professionalName, roomId, serviceId, serviceName, category, treatmentId?, sessionNumber?, date, startAt, endAt, status, source, cancelReason?, priceCents, paymentStatus, paymentId?, sessionRecorded, reminderState, createdBy, updatedAt    | Estados: PENDIENTE, CONFIRMADA, ATENDIDA, CANCELADA, NO_ASISTIO                              |
| `appointments/{id}/events/{id}`                           | type, professionalId, from, to, reason, actor{type, uid, name, channel}, at                                                                                                                                                                                                         | Historial inmutable; lo escribe el servidor en la misma transacción que el cambio            |
| `scheduleLocks/{fecha}`                                   | version, at                                                                                                                                                                                                                                                                         | Candado por día: serializa las reservas simultáneas (ver "Candado por día")                  |
| `treatments/{id}`                                         | clientId, clientName, professionalId, serviceId, category, startDate, plannedSessions, completedSessions, status, statusReason?, statusChangedAt?, notes?, lastSessionAt?, createdBy                                                                                                | Resumen **no clínico**, visible para recepción                                               |
| `treatments/{id}/sessions/{id}`                           | number, date, professionalId, appointmentId?, sessionType, status                                                                                                                                                                                                                   | Metadatos no clínicos para la línea de tiempo                                                |
| `clinicalRecords/{clientId}`                              | clientId, background, alerts, updatedAt, updatedBy                                                                                                                                                                                                                                  | **Privado**, solo vía Functions                                                              |
| `clinicalRecords/{clientId}/treatmentPlans/{treatmentId}` | treatmentId, assessment, goals, indications, updatedAt, updatedBy                                                                                                                                                                                                                   | Privado                                                                                      |
| `clinicalRecords/{clientId}/sessionNotes/{appointmentId}` | appointmentId, treatmentId?, sessionNumber?, date, serviceName, professionalId, observations, evolution?, recommendations?, painBefore?, painAfter? (EVA 0–10), createdAt, createdBy, updatedAt?                                                                                    | Privado                                                                                      |
| `reminders/{id}`                                          | appointmentId, clientId, type, channel, scheduledFor, status, attempts, lastError?, handledBy?                                                                                                                                                                                      | Cola de recordatorios                                                                        |
| `notifications/{id}`                                      | userId, title, body, link, read, createdAt                                                                                                                                                                                                                                          | Bandeja in-app del personal                                                                  |
| `dailyStats/{YYYY-MM-DD}`                                 | date, cells{`profesional__ÁREA`: {PENDIENTE…NO_ASISTIO, attendedMinutes}}, newClients                                                                                                                                                                                               | Lo recalcula un trigger con cada cambio de cita o cliente nuevo                              |
| `dailyIncome/{YYYY-MM-DD}`                                | date, totalCents, count, byMethod{}, byProfessional{}, byCategory{}                                                                                                                                                                                                                 | Lo recalcula un trigger con cada cobro; solo administración                                  |
| `auditLogs/{id}`                                          | actor, action, entity, entityId, at, meta                                                                                                                                                                                                                                           | Solo la escribe el servidor y solo la lee el administrador                                   |
| `payments/{id}`                                           | appointmentId, clientName, professionalId, serviceName, category, listPriceCents, discountCents, discountReason?, amountCents, method (EFECTIVO/QR/TARJETA), receivedCents?, changeCents?, reference?, cashSessionId, date, paidAt, createdBy, status (VALIDO/ANULADO), voidReason? | Un cobro por cita. Montos en centavos. Anular no borra: marca ANULADO                        |
| `cashSessions/{id}`                                       | status (ABIERTA/CERRADA), date, openedAt, openedBy, openingCents, totals{EFECTIVO, QR, TARJETA}, paymentsCount, closedAt?, expectedCashCents?, countedCashCents?, differenceCents?, closingNote?                                                                                    | Una apertura y cierre de la caja del consultorio                                             |
| `cashRegister/main`                                       | openSessionId                                                                                                                                                                                                                                                                       | Qué caja está abierta (a lo sumo una); serializa abrir, cobrar y cerrar                      |
| `incomeStats/{YYYY-MM}`                                   | totalCents, count, byMethod{}, byDay{}, byProfessional{}, byCategory{}                                                                                                                                                                                                              | Ingresos del mes, sumados en la misma transacción de cada cobro o anulación                  |
| `settings/clinic`                                         | name, timezone, openingHours, slotMinutes, reminderLeadHours                                                                                                                                                                                                                        | Configuración general                                                                        |

## Búsqueda de clientes

`searchKeywords` guarda prefijos normalizados (sin tildes y en minúsculas) de:

- nombre;
- apellido;
- CI;
- teléfono.

Se consulta con `array-contains` y se ordena por `lastNameLower`.

- Se guardan prefijos de hasta 15 caracteres. El carnet y el teléfono se normalizan antes (sin guiones, espacios ni prefijo 591).
- Firestore admite un solo `array-contains` por consulta: se busca por el primer término y los demás se filtran en el navegador.
- Para el profesional, la condición `array-contains` la ocupa `assignedProfessionalIds`, así que "Mis pacientes" carga sus clientes asignados y los filtra en el navegador.

## Índices compuestos previstos

| Colección    | Campos                                                                                       |
| ------------ | -------------------------------------------------------------------------------------------- |
| appointments | (professionalId, date, startAt) · (roomId, date) · (clientId, startAt desc) · (date, status) |
| treatments   | (clientId, status) · (professionalId, status)                                                |
| clients      | (searchKeywords array, [status], lastNameLower \| createdAt desc) · (status, lastNameLower)  |
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

`firestore.rules` **deniega todo por defecto**. Cada módulo agrega sus reglas explícitas junto con sus pruebas en el emulador (`tests/rules/`, que se ejecutan con `npm run test:rules`).

| Colección                                        | Lectura                                                                                              | Escritura desde la web                                                           | Desde    |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------- |
| `users/{uid}`                                    | la propia cuenta; el administrador, todas                                                            | solo `lastLoginAt` propio, con la hora del servidor                              | Fase 6   |
| `auditLogs`                                      | solo el administrador                                                                                | ninguna                                                                          | Fase 6   |
| `professionals`, `rooms`, `services`, `settings` | todo el personal activo                                                                              | ninguna: `staff-*` y `settings-*` (solo administración)                          | Fase 9   |
| `professionalExceptions`                         | todo el personal activo (la agenda muestra quién está ausente)                                       | ninguna: `staff-addException`, `staff-removeException`                           | Fase 9   |
| `clients`                                        | administración y recepción; el profesional, solo los que tiene asignados (`assignedProfessionalIds`) | ninguna: `clients-create`, `-update`, `-setStatus`                               | Fase 8   |
| `clientCiIndex`                                  | denegada (solo el servidor)                                                                          | denegada                                                                         | Fase 8   |
| `appointments`                                   | administración y recepción; el profesional, solo las propias (`professionalId`)                      | ninguna: `appointments-create`, `-reschedule`, `-changeStatus`, `-correctStatus` | Fase 10  |
| `appointments/{id}/events`                       | quien puede ver la cita (se consulta la cita padre)                                                  | ninguna                                                                          | Fase 10  |
| `treatments`                                     | administración y recepción; el profesional, solo los propios (`professionalId`)                      | ninguna: `treatments-create`, `-update`, `-changeStatus`                         | Fase 11  |
| `payments`                                       | administración y recepción; el profesional, solo los de sus sesiones (`professionalId`)              | ninguna: `cash-charge`, `cash-voidPayment`                                       | Fase 10B |
| `cashSessions`, `cashRegister`                   | administración y recepción                                                                           | ninguna: `cash-open`, `cash-close`                                               | Fase 10B |
| `clinicalRecords/**`                             | denegada para todos (también administración): solo vía Functions, con auditoría                      | denegada: `clinical-*`                                                           | Fase 12  |
| `dailyStats`                                     | administración y recepción                                                                           | ninguna (trigger; `reports-rebuild`)                                             | Fase 14  |
| `dailyIncome`                                    | solo el administrador                                                                                | ninguna (trigger; `reports-rebuild`)                                             | Fase 14  |
| `incomeStats`                                    | solo el administrador                                                                                | ninguna                                                                          | Fase 10B |
| resto                                            | denegada                                                                                             | denegada                                                                         | —        |

El profesional debe filtrar sus consultas por su propia ficha (`where('professionalId', '==', …)`): las reglas rechazan una consulta que pueda devolver documentos ajenos.

Una cuenta desactivada pierde el acceso aunque su token siga vigente, porque las reglas exigen `active == true` en los claims.

## Candado por día (implementado en la Fase 10)

En Firestore, una consulta dentro de una transacción bloquea los documentos que devuelve, pero **no** impide que otra transacción inserte uno nuevo que también cumpla la consulta. Por eso dos reservas simultáneas podrían leer "horario libre" y guardar ambas.

Para evitarlo, cada reserva (crear, reprogramar o reactivar una cita) lee y actualiza `scheduleLocks/{fecha}` en su transacción. Dos transacciones sobre el mismo día chocan en ese documento: Firestore reintenta la segunda, que ahora ve la cita de la primera y la rechaza con alternativas. La prueba `booking.emulator.test.ts` lo comprueba contra el emulador lanzando cinco reservas a la vez del mismo horario, y solo una se guarda.

Se ejecuta con:

```bash
npm run test:integration
```

## Caja y cobros (Fase 10B)

- **Montos en centavos** (enteros): Bs 150,50 se guarda como `15050`. Así no hay errores de redondeo al sumar.
- **Una sola caja abierta.** `cashRegister/main` guarda cuál es. Abrir, cobrar y cerrar leen ese documento en su transacción, así una caja no se cierra mientras entra un cobro y nunca hay dos abiertas.
- **Cobro atómico.** En una transacción se crea `payments/{id}`, la cita pasa a `PAGADA`, se registra el evento en su historial y se suman los totales de la caja y de `incomeStats/{mes}`. Dos cobros simultáneos de la misma cita chocan en la cita y el segundo ve que ya está pagada.
- **Precio de la cita.** Se guarda el precio del servicio al agendar (`priceCents`), para que un cambio de tarifa no altere lo ya agendado. Las citas anteriores a los precios se cobran al precio actual.
- **Anulación**, solo de cobros de la caja abierta. El cobro queda `ANULADO`, con su motivo; se descuentan los totales y la cita vuelve a `POR_COBRAR`. Los cobros de una caja cerrada no se tocan porque su arqueo ya se firmó.
- **Cita pagada.** No se cancela: primero se anula el cobro y se devuelve el dinero. Sí se puede reprogramar.
- **Arqueo.** El efectivo esperado es el monto inicial más los cobros en efectivo. QR y tarjeta se informan aparte porque no están en el cajón. Si lo contado no coincide, la observación es obligatoria.

## Información clínica (Fase 12)

- **Cerrada para la web.** Las reglas niegan toda lectura y escritura de `clinicalRecords/**`, incluso a la administración. Todo pasa por las funciones `clinical-*`, que:
  - verifican el acceso: la administración, a todo; el profesional, a los pacientes que tiene asignados; la recepción, nunca;
  - registran **cada lectura** en `auditLogs` (`clinical.read`, con el alcance: cliente, tratamiento o cita) y cada escritura.
- **Una nota por cita.** El id de la nota es el de la cita, así no puede haber dos notas para la misma sesión.
- **Registrar la sesión es atómico.** En una transacción se hace todo junto:
  - la cita pasa a ATENDIDA si no lo estaba, con su evento en el historial;
  - se suma la sesión al tratamiento y se registra la última visita del cliente;
  - se guarda la nota y la cita queda con `sessionRecorded = true`.

  Si la asistencia ya estaba marcada, la sesión no se vuelve a contar. Dos registros simultáneos de la misma cita chocan en la transacción y el segundo se rechaza (probado contra el emulador).

- **`sessionRecorded` en la cita** es el único dato que sale de lo clínico, y no revela su contenido. Permite avisar al profesional de las sesiones sin registrar.
- **Edición de notas:** su autor puede editarla durante 7 días; la administración, siempre. Ninguna nota se borra.
