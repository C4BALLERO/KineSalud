# ADR 0002 — Datos clínicos en una colección separada y privada

- **Estado:** aceptada
- **Fecha:** 2026-09-27

## Contexto

Recepción necesita ver los datos administrativos del cliente y el progreso de sus tratamientos (cuántas sesiones lleva), pero **nunca** la información clínica: evolución, observaciones y recomendaciones. Los permisos de Firestore se aplican por documento, no por campo.

## Decisión

- Los datos clínicos se guardan en la colección raíz `clinicalRecords/{clientId}`, con las subcolecciones `treatmentPlans` y `sessionNotes`.
- Las Security Rules deniegan toda lectura y escritura desde el cliente (`allow read, write: if false`).
- Solo se accede mediante Cloud Functions. Estas verifican que el actor sea ADMINISTRADOR o el profesional asignado, y registran cada acceso en `auditLogs`.
- `treatments` y `treatments/{id}/sessions` conservan únicamente metadatos no clínicos: número de sesión, fecha, estado y profesional.

## Consecuencias

**A favor**

- La separación entre lo público y lo privado es verificable con pruebas de reglas.
- Hay auditoría de cada lectura clínica.
- Los datos administrativos no pueden filtrar accidentalmente información clínica.

**En contra**

- Las lecturas clínicas no son en tiempo real y pasan por una Function. Es aceptable para una historia clínica.
