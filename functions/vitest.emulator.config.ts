import { defineConfig } from 'vitest/config';

/** Pruebas de integración contra Firestore Emulator (transacciones reales). */
export default defineConfig({
  test: {
    include: ['src/**/*.emulator.test.ts'],
    testTimeout: 60_000,
    // Comparten el mismo emulador y limpian sus colecciones: de a un archivo por vez.
    fileParallelism: false,
    env: { GCLOUD_PROJECT: 'demo-kinesalud-it', METADATA_SERVER_DETECTION: 'none' },
  },
});
