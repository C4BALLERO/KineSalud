# Navegación, pantallas y flujos

## Inventario de pantallas

**Públicas:** `/login` · `/recuperar-contrasena` · `/auth/accion` (restablecer contraseña) · aviso de cuenta desactivada.

**Privadas:**

| Ruta                                                                    | Pantalla                                                                        | Fase |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---- |
| `/inicio`                                                               | Dashboard ("Mi día" para el profesional)                                        | 7    |
| `/agenda?vista=dia\|semana&fecha=&profesional=&categoria=`              | Agenda                                                                          | 10   |
| `/agenda/nueva`                                                         | Asistente de nueva cita (panel lateral en escritorio, página completa en móvil) | 10   |
| `/citas/:id`                                                            | Detalle de cita e historial de eventos                                          | 10   |
| `/clientes`, `/clientes/nuevo`, `/clientes/:id`, `/clientes/:id/editar` | Clientes y perfil con pestañas                                                  | 8    |
| `/personal`, `/personal/nuevo`, `/personal/:id`                         | Profesionales, horario y servicios                                              | 9    |
| `/tratamientos`, `/tratamientos/nuevo`, `/tratamientos/:id`             | Tratamientos, progreso y línea de tiempo                                        | 11   |
| `/tratamientos/:id/sesiones/nueva`                                      | Registrar sesión                                                                | 12   |
| `/recordatorios`                                                        | Cola de recordatorios y confirmaciones                                          | 13   |
| `/reportes`                                                             | Reportes con filtros                                                            | 14   |
| `/usuarios`                                                             | Gestión de usuarios                                                             | 6    |
| `/configuracion`                                                        | Consultorio, espacios y servicios                                               | 9    |
| `/mi-cuenta`                                                            | Cuenta propia                                                                   | 6    |
| `/dev/componentes`                                                      | Catálogo del Design System (solo en desarrollo)                                 | 5    |

## Flujos principales

1. **Login.** Credenciales → validación → lectura de claims → si la cuenta está desactivada, se muestra un aviso → `/inicio` con la vista del rol. Los errores no revelan si el correo existe.
2. **Nueva cita** (asistente de 5 pasos con resumen lateral):
   1. **Cliente:** buscador o registro rápido.
   2. **Servicio:** agrupado por categoría y ligado a un tratamiento activo.
   3. **Profesional:** solo quienes realizan el servicio, o "Cualquiera disponible".
   4. **Fecha:** se deshabilitan los días sin disponibilidad.
   5. **Horario:** solo huecos libres, con el espacio asignado.

   Al final se confirma. Si el servidor detecta un conflicto, ofrece alternativas **sin perder lo ya completado**.

3. **Gestión de cita desde la agenda.** Clic en el bloque → panel con las acciones según el estado: Confirmar, Reprogramar, Cancelar (con motivo), Asistencia / No asistió y Atender → Registrar sesión.
4. **Cliente.** Listado → búsqueda o filtros → perfil → pestañas: Resumen, Datos personales, Citas, Tratamientos e Historia clínica (esta última solo con permiso).
5. **Tratamiento.** Cliente → nuevo tratamiento (servicio, profesional, inicio, sesiones, objetivos) → detalle con el progreso "Sesión n de N" → línea de tiempo → evolución (notas y gráfico EVA, si hay datos).
6. **Registrar sesión.** "Mi día" → cita → Atender → formulario precargado → observaciones, evolución, recomendaciones y EVA opcional → guardar. En una sola operación atómica la cita pasa a ATENDIDA y el progreso a n+1. Al llegar a N sesiones, el sistema sugiere finalizar el tratamiento.
7. **Recordatorio.** Crear o confirmar una cita programa un recordatorio a 24 h → la cola lo procesa → recepción recibe la tarea "Confirmar con el cliente" → marca el resultado → se actualiza el estado de la cita.

## Estados obligatorios por pantalla

Cada vista de datos contempla estos estados:

- **Carga:** skeleton con la forma real del contenido.
- **Vacío:** explicación y acción principal.
- **Sin resultados:** sugiere limpiar los filtros.
- **Error:** mensaje comprensible y botón de reintento.
- **Sin permiso.**
- **Éxito:** toast.

Los formularios validan al salir de cada campo y al enviar. Además llevan el foco al primer error, bloquean el doble envío y avisan si hay cambios sin guardar.
