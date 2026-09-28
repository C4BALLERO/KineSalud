# Instalación, configuración y despliegue

## Requisitos

| Herramienta  | Versión                             | Para qué                                      |
| ------------ | ----------------------------------- | --------------------------------------------- |
| Node.js      | ≥ 22.12 (desarrollo probado con 24) | Todo el proyecto                              |
| npm          | ≥ 10                                | Workspaces                                    |
| Firebase CLI | 15.x — `npm i -g firebase-tools`    | Emuladores y despliegue                       |
| Java (JDK)   | 21                                  | Emulador de Firestore (a partir de la Fase 6) |
| Git          | cualquiera reciente                 | Control de versiones                          |

## Instalación

```bash
git clone <url-del-repositorio> kinesalud
cd kinesalud
npm install
```

## Variables de entorno

Copia `apps/web/.env.example` a `apps/web/.env.local` y complétalo:

| Variable                                         | Descripción                                                                                                    |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `VITE_FIREBASE_API_KEY` … `VITE_FIREBASE_APP_ID` | Configuración pública de la app web. Se obtiene en Consola de Firebase → Configuración del proyecto → Tus apps |
| `VITE_FIREBASE_PROJECT_ID`                       | En desarrollo local se usa `demo-kinesalud`, un proyecto de demostración que no requiere cuenta                |
| `VITE_FIREBASE_FUNCTIONS_REGION`                 | `southamerica-east1` (São Paulo)                                                                               |
| `VITE_USE_EMULATORS`                             | `true` en desarrollo: conecta con Firebase Emulator Suite                                                      |

Los valores de configuración web de Firebase son públicos por diseño. La seguridad la aportan Authentication, las Security Rules y la validación en Cloud Functions. **Nunca** se suben al repositorio claves de cuentas de servicio.

## Ejecución local

```bash
npm run dev            # Aplicación web en http://localhost:5173
npm run emulators      # Auth, Firestore, Functions y la UI del emulador (http://localhost:4000)
```

En la Fase 5 la aplicación funciona con una **sesión de vista previa**, solo en desarrollo. Desde el menú de usuario → "Vista previa de rol" se puede revisar la interfaz de cada rol. En la Fase 6 se reemplaza por Firebase Authentication.

## Calidad

```bash
npm run typecheck      # TypeScript estricto en todos los paquetes
npm run lint           # ESLint (incluye reglas de accesibilidad jsx-a11y)
npm test               # Vitest
npm run check          # Los tres anteriores
npm run build          # Build de producción (web + functions)
```

Estas mismas verificaciones se ejecutan en GitHub Actions en cada _push_ y _pull request_ (`.github/workflows/ci.yml`).

## Despliegue

Se completa en la Fase 16.

1. Crear el proyecto en la consola de Firebase, activar el **plan Blaze** y configurar una **alerta de presupuesto**.
2. Habilitar Authentication (correo/contraseña) y Firestore en la región `southamerica-east1`.
3. Ejecutar `firebase use --add` con el ID del proyecto real.
4. Ejecutar `npm run build` y luego `firebase deploy`.

Se despliegan Hosting, Functions, las reglas y los índices.
