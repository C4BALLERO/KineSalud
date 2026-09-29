# Despliegue a producción

Proyecto real: **`kinesalud-d9291`** (alias `prod` en `.firebaserc`). El desarrollo local sigue usando `demo-kinesalud` con los emuladores, así que nada de lo que se hace en local toca producción.

Producción **no recibe datos de demostración**: `npm run seed` solo funciona contra los emuladores. Los datos reales (espacios, servicios, personal, clientes) se cargan desde el propio sistema.

## 1. Preparar el proyecto en la consola (una sola vez)

Estos pasos los hace la persona dueña del proyecto en [console.firebase.google.com](https://console.firebase.google.com/project/kinesalud-d9291):

1. **Plan Blaze.** Uso y facturación → Modificar plan → Blaze. Cloud Functions lo exige. Configura además una **alerta de presupuesto** (por ejemplo, 5 USD al mes) en Google Cloud → Facturación → Presupuestos y alertas. Con el volumen de un consultorio el consumo queda dentro de la capa gratuita.
2. **Firestore.** Firestore Database → Crear base de datos → modo producción → ubicación **`southamerica-east1` (São Paulo)**. La ubicación no se puede cambiar después.
3. **Authentication.** Authentication → Comenzar → Método de acceso → **Correo electrónico/contraseña** → Habilitar (sin "vínculo de correo electrónico").
4. **Cerrar el registro público.** Authentication → Configuración → Acciones del usuario → desmarcar **"Habilitar creación (registro)"**. Las cuentas solo las crea un administrador desde la pantalla Usuarios.
5. **Correo de restablecimiento.** Authentication → Plantillas → Restablecimiento de contraseña:
   - idioma de la plantilla: español;
   - personalizar la URL de acción: `https://kinesalud-d9291.web.app/auth/accion`, para que el enlace abra la pantalla propia del sistema.

## 2. Configuración de la web

La app web lee su configuración de `apps/web/.env.production.local`, que **no** se sube al repositorio. Se genera con:

```bash
firebase apps:sdkconfig WEB --project prod
```

y se copian los valores a las variables de `apps/web/.env.example`, con `VITE_USE_EMULATORS=false` y `VITE_FIREBASE_FUNCTIONS_REGION=southamerica-east1`.

## 3. Publicar

```bash
npm run deploy
```

Ejecuta las verificaciones (`typecheck`, `lint`, pruebas), compila todo y publica en `prod`:

| Parte     | Qué se publica                                               |
| --------- | ------------------------------------------------------------ |
| Firestore | `firestore.rules` y `firestore.indexes.json`                 |
| Functions | Comandos del servidor (Node 22, región `southamerica-east1`) |
| Hosting   | `apps/web/dist` en `https://kinesalud-d9291.web.app`         |

Los índices tardan unos minutos en construirse la primera vez. Mientras tanto, algunas listas pueden mostrar un error y reintentar.

Para publicar solo una parte: `firebase deploy --project prod --only hosting` (o `functions`, `firestore:rules`, `firestore:indexes`).

## 4. Primer administrador (una sola vez)

Solo un administrador puede crear cuentas desde el sistema, así que la primera se crea con un script que usa el Admin SDK con tus credenciales de Google Cloud:

```bash
gcloud auth application-default login
gcloud auth application-default set-quota-project kinesalud-d9291
npm run bootstrap:admin -- --email <correo> --name "<Nombre Apellido>"
```

El script:

- crea la cuenta **sin contraseña**, le asigna el rol ADMINISTRADOR y lo registra en la auditoría;
- crea `settings/clinic` con un horario inicial, si no existe;
- se niega a correr si ya hay un administrador activo.

Después, en `https://kinesalud-d9291.web.app/recuperar-contrasena`, ingresa ese correo y define la contraseña con el enlace que llega por correo.

## 5. Puesta en marcha

Con la cuenta de administración, en este orden:

1. **Configuración → Consultorio:** nombre, horario de atención e intervalo de la agenda.
2. **Configuración → Espacios y Servicios:** camillas, cabinas, gimnasio y el catálogo de servicios.
3. **Personal:** fichas de los profesionales, servicios que realizan y su horario semanal.
4. **Usuarios:** cuentas de recepción y de cada profesional, vinculadas a su ficha. Cada persona recibe el enlace para definir su contraseña.

## Antes de cargar datos reales de pacientes

El sistema ya valida todo en el servidor y las reglas impiden escrituras directas, pero la Fase 15 (Seguridad) agrega protecciones pensadas para datos clínicos reales: App Check, revisión final de permisos y de la auditoría. Hasta entonces conviene usar producción con datos de prueba.
