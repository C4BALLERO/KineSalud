import { setGlobalOptions } from 'firebase-functions/v2';

/** São Paulo: la región de Google Cloud más cercana a Bolivia. */
export const REGION = 'southamerica-east1';

setGlobalOptions({
  region: REGION,
  // Límite de instancias como protección de costos en el plan Blaze.
  maxInstances: 10,
});
