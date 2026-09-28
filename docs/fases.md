# Avance por fases

| Fase                                                    | Estado                                  |
| ------------------------------------------------------- | --------------------------------------- |
| 1–4 · Análisis, arquitectura, Design System, wireframes | ✅ Aprobada (ver documentos de `docs/`) |
| 5 · Layout principal                                    | ✅ Aprobada                             |
| 6 · Autenticación                                       | ✅ Completada — pendiente de revisión   |
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
