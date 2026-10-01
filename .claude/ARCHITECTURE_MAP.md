# Mapa del código

| Qué                                   | Dónde                                                                                                                                                 |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reglas de negocio, esquemas, permisos | `packages/shared/src/` (`appointments`, `availability`, `payments`, `treatments`, `reports`, `permissions`…)                                          |
| Comandos del servidor                 | `functions/src/api/callable/*.ts` y `functions/src/domain/<módulo>/` (servicio, puerto `*Gateway.ts`, implementación `firestore*Gateway.ts`, pruebas) |
| Triggers                              | `functions/src/triggers/` (resúmenes de reportes)                                                                                                     |
| Web por módulo                        | `apps/web/src/features/<módulo>/` (`api/`, `components/`, `pages/`, `model.ts`, pruebas)                                                              |
| Design System                         | `apps/web/src/components/ui`, `components/domain`, `styles/tokens.css`                                                                                |
| Rutas y navegación por rol            | `apps/web/src/app/router.tsx`, `apps/web/src/app/navigation.ts`                                                                                       |
| Reglas e índices                      | `firestore.rules` (pruebas en `tests/rules/`), `firestore.indexes.json`                                                                               |
| Datos de demostración                 | `scripts/seed-data.mjs`, `scripts/seed.mjs`                                                                                                           |
| Primer administrador en producción    | `scripts/bootstrap-admin.mjs`                                                                                                                         |
| Documentación                         | `docs/` (índice en `docs/INDEX.md`)                                                                                                                   |

Módulos: auth/users, dashboard, clients, staff, settings, services, appointments (agenda), cash (caja y cobros), treatments, clinical (seguimiento), reports. Falta: recordatorios (Fase 13).
