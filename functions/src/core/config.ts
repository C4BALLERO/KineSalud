import { setGlobalOptions } from 'firebase-functions/v2';

/**
 * App Check en los comandos (ver docs/seguridad.md). Se activa con
 * APPCHECK_ENFORCE=true (functions/.env.<proyecto>) solo cuando la web ya envía
 * tokens de App Check; antes rechazaría todas las peticiones.
 */
export const ENFORCE_APP_CHECK = process.env.APPCHECK_ENFORCE === 'true';

/** São Paulo: la región de Google Cloud más cercana a Bolivia. */
export const REGION = 'southamerica-east1';

setGlobalOptions({
  region: REGION,
  // Límite de instancias como protección de costos en el plan Blaze.
  maxInstances: 3,
});
