# Seguridad

Fase 15. Resume las capas de protección, lo que se agregó en esta fase, los pasos opcionales que dependen de la cuenta del proyecto y los riesgos que quedan.

## Capas

| Capa                  | Qué protege                                                                                                                   | Dónde                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Interfaz              | Oculta lo que el rol no puede usar. Es experiencia de usuario, no seguridad.                                                  | `<Can>`, `RequirePermission`, `navigation.ts`           |
| Security Rules        | Lecturas por rol y por asignación. Ninguna escritura de negocio desde la web. La información clínica está cerrada para todos. | `firestore.rules`, pruebas en `tests/rules/`            |
| Comandos del servidor | Sesión vigente, rol, permiso y alcance (`own`/`all`), validación con zod, reglas de negocio y transacciones.                  | `functions/src/core`, `functions/src/api/callable`      |
| Auditoría             | Cada comando que cambia datos y cada lectura de información clínica queda en `auditLogs`, que nadie puede editar ni borrar.   | `functions/src/domain/audit.ts`, pantalla **Auditoría** |
| Navegador             | Cabeceras de seguridad: CSP, HSTS, `X-Frame-Options`, `Permissions-Policy`.                                                   | `firebase.json` (`hosting.headers`)                     |
| Sesión en el equipo   | Cierre automático tras 30 minutos sin actividad, con aviso un minuto antes.                                                   | `apps/web/src/features/auth/idle`                       |

## Lo que agregó la Fase 15

- **Sesiones revocadas al instante.** Al desactivar una cuenta, el servidor la deshabilita en Authentication y revoca sus sesiones. Antes, el token ya emitido (dura hasta una hora) podía seguir ejecutando comandos; ahora cada comando comprueba la cuenta (`core/sessions.ts`) y lo rechaza.
- **Pantalla Auditoría** (`/auditoria`, solo administración): actividad por rango de fechas, módulo y persona. Las consultas a la información clínica se marcan con un candado.
- **Cierre por inactividad.** Los equipos de recepción suelen ser compartidos. La actividad se comparte entre pestañas; la pantalla de ingreso explica por qué se cerró la sesión.
- **Cabeceras de seguridad.** La política de contenido (CSP) solo permite scripts propios y de Firebase o reCAPTCHA, conexiones a los servicios de Google y ningún `iframe` que incruste la aplicación.
- **App Check, listo para activar** (ver abajo).
- **Reglas:** el registro de dispositivos para notificaciones push no acepta campos extra, tokens vacíos ni textos desmedidos.
- **Dependencias:** `npm audit` en cero. Se fuerza `@grpc/grpc-js` ≥ 1.14.5 (`overrides` en `package.json`), que el SDK web de Firestore traía en una versión con avisos de seguridad.

## Probar la CSP en local

La política se prueba con la web compilada y las mismas cabeceras de `firebase.json`, contra los emuladores:

```bash
npm run emulators                                                   # terminal 1
VITE_USE_EMULATORS=true npm run build -w @kinesalud/web -- --mode emulators
node scripts/serve-dist.mjs --emulators                             # http://localhost:4173
```

`--emulators` solo agrega los puertos locales a `connect-src`. Cualquier bloqueo aparece en la consola del navegador como violación de la política.

## Pasos opcionales (los hace el dueño del proyecto)

### App Check

Comprueba que las peticiones salen de la web del consultorio y no de un script que reutiliza la configuración pública. Es gratis con reCAPTCHA v3.

1. En [reCAPTCHA](https://www.google.com/recaptcha/admin/create) crea una clave **v3** para el dominio de la web. La clave **secreta** no se comparte ni se sube al repositorio.
2. Consola de Firebase → **App Check** → registra la app web con el proveedor reCAPTCHA v3 y pega ahí la clave secreta.
3. Agrega la clave **pública del sitio** como `VITE_APPCHECK_SITE_KEY` en `apps/web/.env.production.local` y publica.
4. Revisa en App Check → **Métricas** que casi todas las peticiones lleguen verificadas (unos días).
5. Recién entonces activa la aplicación obligatoria:
   - Firestore: App Check → APIs → Cloud Firestore → **Aplicar**.
   - Comandos (Blaze): `APPCHECK_ENFORCE=true` en `functions/.env.prod` y vuelve a desplegar.

Si se activa la aplicación obligatoria antes del paso 3, la web deja de funcionar.

### Política de contraseñas

Consola de Firebase → Authentication → Configuración → **Política de contraseñas**: mínimo 10 caracteres con mayúsculas, minúsculas y números, en modo **Exigir**.

## Riesgos que quedan

- **Lecturas con un token recién revocado.** Firestore valida el token, no consulta si fue revocado. Una cuenta desactivada que conserve su token puede leer (no escribir) hasta una hora. La web cierra la sesión apenas detecta el cambio. Cerrar esta ventana exigiría una lectura extra en cada regla, lo que consume la cuota gratuita.
- **Datos clínicos en la consola de Firebase.** El dueño del proyecto los ve en la consola sin pasar por la auditoría. Las cuentas con acceso al proyecto de Google deben ser pocas y con verificación en dos pasos.
- **Plan gratuito de Vercel.** Ver [despliegue-gratuito.md](https://github.com/C4BALLERO/KineSalud/blob/despliegue-gratuito/docs/despliegue-gratuito.md): sus condiciones son para uso no comercial.
