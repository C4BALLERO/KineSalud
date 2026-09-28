# Avance por fases

| Fase                                                    | Estado                                  |
| ------------------------------------------------------- | --------------------------------------- |
| 1–4 · Análisis, arquitectura, Design System, wireframes | ✅ Aprobada (ver documentos de `docs/`) |
| 5 · Layout principal                                    | ✅ Completada — pendiente de revisión   |
| 6 · Autenticación                                       | ⏳                                      |
| 7 · Dashboard                                           | ⏳                                      |
| 8 · Clientes                                            | ⏳                                      |
| 9 · Personal y configuración                            | ⏳                                      |
| 10 · Agenda                                             | ⏳                                      |
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

**Pendiente, trasladado a la Fase 6**

- **Script de datos semilla para los emuladores.** Necesita los usuarios de Auth por rol, que se crean en esa fase, y Java instalado para el emulador de Firestore.
