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

En dos terminales:

```bash
npm run emulators      # Terminal 1: compila Functions y levanta Auth, Firestore y Functions
npm run dev            # Terminal 2: aplicación web en http://localhost:5173
```

Con los emuladores en marcha, carga los datos de demostración:

- una cuenta por rol;
- profesionales, espacios, servicios, 16 clientes y 10 tratamientos;
- dos semanas de citas relativas a la fecha actual.

Se puede ejecutar las veces que haga falta: reemplaza los datos operativos y no cierra las sesiones abiertas.

```bash
npm run seed
```

| Cuenta                     | Rol                             |
| -------------------------- | ------------------------------- |
| `admin@kinesalud.test`     | Administrador (también atiende) |
| `recepcion@kinesalud.test` | Recepcionista                   |
| `dperez@kinesalud.test`    | Profesional (fisioterapia)      |
| `cvargas@kinesalud.test`   | Profesional (estética)          |

La contraseña de estas cuentas es la constante `DEMO_PASSWORD` de [`scripts/seed.mjs`](../scripts/seed.mjs). Solo existe en los emuladores.

- **UI del emulador:** <http://localhost:4000>. Ahí se ven las cuentas, los datos de Firestore y los **correos de restablecimiento**. En local no se envían correos reales: el enlace aparece en la pestaña Authentication y también en la consola del emulador.
- En desarrollo la web se conecta a los emuladores por defecto. Para usar el proyecto real, define `VITE_USE_EMULATORS=false` en `.env.local`.

### Nota para Windows

`npm run emulators` y `npm run test:rules` usan [`scripts/firebase.mjs`](../scripts/firebase.mjs), que hace dos ajustes:

1. Indica a Java una carpeta temporal simple. Sin eso, el JDK 21 falla con _"Unable to establish loopback connection"_ en algunas rutas de usuario.
2. Amplía a 30 s el tiempo de carga de Functions. El primer arranque puede ser lento mientras el antivirus analiza `node_modules`.

Si `java` no se reconoce después de instalarlo, abre una terminal nueva para que tome el PATH actualizado.

## Calidad

```bash
npm run typecheck      # TypeScript estricto en todos los paquetes
npm run lint           # ESLint (incluye reglas de accesibilidad jsx-a11y)
npm test               # Vitest (shared, web y functions)
npm run test:rules     # Security Rules contra el emulador de Firestore (requiere Java)
npm run check          # typecheck + lint + test
npm run build          # Build de producción (web + functions)
```

Estas mismas verificaciones se ejecutan en GitHub Actions en cada _push_ y _pull request_ (`.github/workflows/ci.yml`).

## Despliegue

El paso a paso para publicar en el proyecto real (`kinesalud-d9291`) está en [despliegue.md](despliegue.md).
