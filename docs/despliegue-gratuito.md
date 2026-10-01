# Despliegue gratuito (sin tarjeta, Bs 0)

Esta rama (`despliegue-gratuito`) publica **todo el sistema sin plan Blaze y sin tarjeta**:

| Parte                                | Dónde                    | Costo               |
| ------------------------------------ | ------------------------ | ------------------- |
| Base de datos y usuarios             | Firebase, plan **Spark** | gratis, sin tarjeta |
| Web y servidor de comandos           | **Vercel**, plan Hobby   | gratis, sin tarjeta |
| Recordatorios cada 15 min (opcional) | cron-job.org             | gratis, sin tarjeta |

Resumen: `vercel login` y `vercel link` → `npm run vercel:clave -- <clave.json>` → `npm run deploy:gratis` → autorizar el dominio → `npm run bootstrap:admin`.

La lógica de negocio es **la misma** que en `main`. Solo cambia cómo llega al servidor:

- **Comandos:** en lugar de Cloud Functions, una función de Vercel (`functions/src/api/http`) recibe los mismos comandos con el mismo protocolo. La web usa el SDK de Firebase igual que antes (`VITE_API_URL=/api`). `GET /api/health` confirma que el servidor llega a Firestore.
- **Triggers:** lo que en Blaze hacen los triggers (resúmenes de reportes, sincronizar recordatorios) se ejecuta justo después de cada comando, con los mismos servicios.
- **Tarea programada de recordatorios:** sin Cloud Scheduler, la cola se procesa cada 5 minutos mientras recepción tiene la app abierta. Si además quieres que corra de noche o con la app cerrada, configura el cron gratuito del paso 6.

## 1. Vincular Vercel (una vez por computadora)

```bash
npx vercel@62 login
npx vercel@62 link --yes --project kinesalud
```

`login` abre la autorización en el navegador (cuenta Hobby, sin tarjeta). `link` crea el proyecto si no existe y guarda el vínculo en `.vercel/project.json`, que git ignora. No hace falta conectar el repositorio de GitHub: se publica desde tu computadora y `vercel.json` desactiva los despliegues por push.

## 2. Clave de la cuenta de servicio (la haces tú)

El servidor en Vercel necesita una credencial para hablar con Firebase.

1. [Consola de Firebase](https://console.firebase.google.com/project/kinesalud-d9291/settings/serviceaccounts/adminsdk) → Configuración del proyecto → **Cuentas de servicio** → **Generar nueva clave privada**. Se descarga un archivo `.json`.
2. **Trátalo como una contraseña maestra:** da acceso completo al proyecto. No lo subas a GitHub ni lo envíes por chat.
3. Guárdalo en Vercel como variable secreta. El script comprueba que sea la clave del proyecto correcto y no la muestra en pantalla:

```bash
npm run vercel:clave -- "<ruta del .json descargado>"
```

## 3. Publicar

```bash
npm run deploy:gratis
```

Corre `npm run check`, compila la web y el servidor, y publica con `vercel deploy --prebuilt --prod`. La web toma la configuración pública de `apps/web/.env.production.local`, igual que en el despliegue con Blaze, así que no hace falta cargarla en Vercel. Al terminar muestra la dirección, por ejemplo `https://kinesalud.vercel.app`.

Comprueba el servidor: `https://<dominio>/api/health` debe responder `{"status":"ok"}`. Si responde `error`, la clave del paso 2 falta o es incorrecta.

Cada vez que cambies la clave o el código, vuelve a correr `npm run deploy:gratis`.

## 4. Autorizar el dominio en Firebase

Authentication → Configuración → **Dominios autorizados** → Agregar `<dominio>.vercel.app`. Los enlaces para definir la contraseña vuelven a ese dominio.

## 5. Primer administrador

Con la misma clave del paso 2 (no hace falta gcloud):

```bash
npm run bootstrap:admin -- --credentials "<ruta del .json>" --app-url https://<dominio> --email <correo> --name "<Nombre Apellido>"
```

Después, en `https://<dominio>/recuperar-contrasena`, ingresa el correo y define la contraseña con el enlace que llega. Cuando termines, borra el archivo `.json` de Descargas.

## 6. Recordatorios con la app cerrada (opcional)

1. Guarda una frase larga al azar como `CRON_SECRET` con `npx vercel@62 env add CRON_SECRET production --sensitive` y publica de nuevo.
2. Crea una cuenta gratuita en [cron-job.org](https://cron-job.org) y una tarea con:
   - **URL:** `https://<dominio>/api/cron/reminders`
   - **Método:** POST
   - **Cada:** 15 minutos
   - **Encabezado:** `Authorization: Bearer <CRON_SECRET>`

Sin este paso, los recordatorios se procesan igual mientras recepción tiene la app abierta, que es cuando se gestionan.

## Alternativa: despliegue automático con cada push

Si prefieres que Vercel compile solo al hacer push:

1. Conecta el repositorio en el proyecto de Vercel.
2. Quita `"git": { "deploymentEnabled": false }` de `vercel.json`.
3. Elige `despliegue-gratuito` como _Production Branch_.
4. Carga en Vercel las variables `VITE_FIREBASE_*`. Puedes pegar el contenido de `apps/web/.env.production.local` de una vez.

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
