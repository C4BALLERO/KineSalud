import { defineConfig } from 'vitest/config';

/** Pruebas de integración contra Firestore Emulator (transacciones reales). */
export default defineConfig({
  test: {
    include: ['src/**/*.emulator.test.ts'],
    testTimeout: 60_000,
    env: { GCLOUD_PROJECT: 'demo-kinesalud-it', METADATA_SERVER_DETECTION: 'none' },
  },
});
