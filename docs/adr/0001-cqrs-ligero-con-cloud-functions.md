# ADR 0001 — Lecturas directas y comandos por Cloud Functions

- **Estado:** aceptada
- **Fecha:** 2026-09-27

## Contexto

La aplicación necesita:

- integridad fuerte (no puede haber citas solapadas y el CI de cada cliente debe ser único);
- protección de la información clínica, con auditoría;
- reutilizar la lógica de negocio con un chatbot en una etapa posterior.

El SDK web de Firestore no permite consultas dentro de transacciones, y las Security Rules no pueden expresar reglas como "no existe otra cita en el intervalo".

## Decisión

- **Lecturas:** directas desde la web con el SDK de Firestore y filtradas por Security Rules, lo que permite trabajar en tiempo real.
- **Escrituras de negocio:** exclusivamente mediante Cloud Functions _callable_ (Node.js 22, 2.ª generación) sobre servicios de dominio independientes del transporte.
- **Proyecto:** plan **Blaze**, con alerta de presupuesto y `maxInstances` limitado.

## Consecuencias

**A favor**

- Una sola ruta de validación.
- Transacciones del Admin SDK.
- Auditoría garantizada.
- La capa de dominio se reutiliza en el chatbot.

**En contra**

- Latencia de arranque en frío en las escrituras.
- Requiere el plan Blaze. Tiene cuota gratuita y el volumen de un consultorio normalmente no la supera.
- El desarrollo local depende de Firebase Emulator Suite, que necesita Java.
