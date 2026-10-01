# Despliegue gratuito (sin tarjeta, Bs 0)

Esta rama (`despliegue-gratuito`) publica **todo el sistema sin plan Blaze y sin tarjeta**:

| Parte                                | Dónde                    | Costo               |
| ------------------------------------ | ------------------------ | ------------------- |
| Base de datos y usuarios             | Firebase, plan **Spark** | gratis, sin tarjeta |
| Web y servidor de comandos           | **Vercel**, plan Hobby   | gratis, sin tarjeta |
| Recordatorios cada 15 min (opcional) | cron-job.org             | gratis, sin tarjeta |

La lógica de negocio es **la misma** que en `main`. Solo cambia cómo llega al servidor:

- **Comandos:** en lugar de Cloud Functions, una función de Vercel (`functions/src/api/http`) recibe los mismos comandos con el mismo protocolo. La web usa el SDK de Firebase igual que antes (`VITE_API_URL=/api`).
- **Triggers:** lo que en Blaze hacen los triggers (resúmenes de reportes, sincronizar recordatorios) se ejecuta justo después de cada comando, con los mismos servicios.
- **Tarea programada de recordatorios:** sin Cloud Scheduler, la cola se procesa cada 5 minutos mientras recepción tiene la app abierta. Si además quieres que corra de noche o con la app cerrada, configura el cron gratuito del paso 6.

## 1. Clave de la cuenta de servicio (la haces tú)

El servidor en Vercel necesita una credencial para hablar con Firebase.

1. [Consola de Firebase](https://console.firebase.google.com/project/kinesalud-d9291/settings/serviceaccounts/adminsdk) → Configuración del proyecto → **Cuentas de servicio** → **Generar nueva clave privada**. Se descarga un archivo `.json`.
2. **Trátalo como una contraseña maestra:** da acceso completo al proyecto. No lo subas a GitHub, no lo envíes por chat y bórralo de Descargas cuando lo hayas pegado en Vercel (paso 3).

## 2. Cuenta en Vercel

1. Entra a [vercel.com](https://vercel.com/signup) → **Continue with GitHub**. Elige el plan **Hobby** (no pide tarjeta).
2. **Add New → Project** → importa el repositorio `C4BALLERO/KineSalud`.
3. En _Framework Preset_ deja **Other**. La compilación ya está definida en `vercel.json`.

## 3. Variables de entorno (en Vercel, antes del primer despliegue)

En el proyecto → **Settings → Environment Variables** (entorno _Production_):

| Variable                                         | Valor                                                                                                                |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `FIREBASE_SERVICE_ACCOUNT`                       | El **contenido completo** del `.json` del paso 1. Márcala como _Sensitive_.                                          |
| `VITE_FIREBASE_API_KEY` … `VITE_FIREBASE_APP_ID` | La configuración pública de la web. Vercel acepta pegar el contenido de `apps/web/.env.production.local` de una vez. |
| `CRON_SECRET` (opcional)                         | Una frase larga al azar, solo si configuras el cron del paso 6.                                                      |

`VITE_API_URL` no hace falta: la compilación usa `/api` por defecto.

## 4. Rama de producción y despliegue

1. **Settings → Git → Production Branch:** `despliegue-gratuito`.
2. **Deployments → Redeploy**, o haz un push a la rama. Vercel compila con `node scripts/build-vercel.mjs` y publica en una dirección como `https://kinesalud-xxxx.vercel.app`.
3. **Autoriza ese dominio en Firebase:** Authentication → Configuración → **Dominios autorizados** → Agregar. Los enlaces para definir contraseña vuelven a ese dominio.

## 5. Primer administrador

Igual que en el despliegue con Blaze (funciona en Spark):

```bash
gcloud auth application-default login
npm run bootstrap:admin -- --email <correo> --name "<Nombre Apellido>"
```

Después, en `https://<tu-dominio>.vercel.app/recuperar-contrasena`, ingresa el correo y define la contraseña con el enlace que llega.

## 6. Recordatorios con la app cerrada (opcional)

1. Crea una cuenta gratuita en [cron-job.org](https://cron-job.org).
2. Crea una tarea con:
   - **URL:** `https://<tu-dominio>.vercel.app/api/cron/reminders`
   - **Método:** POST
   - **Cada:** 15 minutos
   - **Encabezado:** `Authorization: Bearer <CRON_SECRET>`

Sin este paso, los recordatorios se procesan igual mientras recepción tiene la app abierta, que es cuando se gestionan.

## Límites y diferencias con el plan Blaze

- **Cuotas de Firebase Spark:** 50 000 lecturas y 20 000 escrituras por día, y 1 GB de datos. Si un día se superan, Firestore deja de responder **hasta el día siguiente: nunca cobra**. Según el cálculo del proyecto, un consultorio de hasta unas 40 citas diarias queda dentro.
- **Vercel Hobby:**
  - según sus condiciones, es para uso **personal y no comercial**. Para la tesis y las demostraciones está bien; si el consultorio lo usa para atender a pacientes reales, revisa esas condiciones;
  - la primera petición después de un rato sin uso tarda 1 a 3 segundos.
- **Resúmenes de reportes:** si una actualización posterior a un comando fallara, la administración puede usar **Recalcular** en Reportes.
- **Ubicación del servidor:** la función corre en São Paulo (`gru1`), cerca de Firestore (`southamerica-east1`).
- **Reglas e índices de Firestore:** se publican igual que en `main`, con `firebase deploy --only firestore --project prod` (funciona en Spark).

## Probarlo en local

Con los emuladores de Auth y Firestore (sin el de Functions):

```bash
npm run emulators:gratis    # terminal 1
npm run seed                # una vez
CORS_ORIGINS=http://localhost:5173 FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 GCLOUD_PROJECT=demo-kinesalud npm run api:local   # terminal 2
VITE_API_URL=http://localhost:3001/api npm run dev                    # terminal 3
```
