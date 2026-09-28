# Preparación para el chatbot (etapa 2)

El chatbot **no se implementa en la versión 1**. Tampoco se instala Dialogflow ni ninguna dependencia de procesamiento de lenguaje natural. Este documento describe cómo la arquitectura queda lista para incorporarlo **sin reconstruir el sistema**.

## 1. Capa de dominio independiente del transporte

La lógica de negocio vive en `functions/src/domain/` y **no sabe quién la invoca**. Cada operación recibe un `Actor` ([`functions/src/core/actor.ts`](../functions/src/core/actor.ts)):

```ts
interface Actor {
  type: 'USER' | 'CHATBOT' | 'SYSTEM';
  uid?: string;
  role?: Role;
  professionalId?: string | null;
  channel: string; // "web", y en el futuro "whatsapp"
}
```

## 2. Adaptadores

| Adaptador            | Etapa    | Autenticación                                |
| -------------------- | -------- | -------------------------------------------- |
| `api/callable/*`     | v1 (web) | Firebase Auth + custom claims                |
| `api/http/chatbot/*` | etapa 2  | Secreto compartido o App Check del proveedor |

Ambos adaptadores llaman **a los mismos servicios**, así que las reglas de negocio no se duplican.

## 3. Operaciones que el chatbot podrá usar

| Operación                | Servicio                                 | Regla específica para el chatbot                                          |
| ------------------------ | ---------------------------------------- | ------------------------------------------------------------------------- |
| Consultar disponibilidad | `AvailabilityService.findSlots`          | Solo servicios activos y marcados como agendables en línea                |
| Identificar cliente      | `ClientService.findByPhone` / `findByCi` | Coincidencia exacta con `phoneE164`; nunca expone datos de otros clientes |
| Crear cita               | `AppointmentService.create`              | Siempre en estado PENDIENTE; `source = CHATBOT`                           |
| Confirmar cita           | `AppointmentService.confirm`             | Solo citas del cliente identificado                                       |
| Reprogramar              | `AppointmentService.reschedule`          | Misma validación anti-solapamiento                                        |
| Cancelar                 | `AppointmentService.cancel`              | Motivo registrado y evento con `actor.channel`                            |

## 4. Datos ya previstos en el modelo

- `appointments.source` y `appointments/{id}/events.actor.channel`: trazabilidad del origen.
- `clients.phoneE164`: teléfono normalizado para identificar al cliente por WhatsApp.
- `clients.contactPreferences`: consentimiento (_opt-in_) para recibir mensajes.
- Canales `WHATSAPP`, `SMS` y `EMAIL`, reservados en `reminders.channel`.
- Colección `conversations`: **reservada, no creada**. Guardará el historial de conversaciones cuando exista el chatbot.

## 5. Qué no se hace en la versión 1

- Ningún endpoint público.
- Ninguna integración con Dialogflow, WhatsApp Business API ni servicios de NLP.
- Ninguna interfaz conversacional.
