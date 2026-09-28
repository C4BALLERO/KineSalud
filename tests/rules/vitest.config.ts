import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/** Pruebas de Security Rules: requieren el emulador de Firestore (npm run test:rules). */
export default defineConfig({
  test: {
    root: fileURLToPath(new URL('.', import.meta.url)),
    environment: 'node',
    include: ['**/*.rules.test.ts'],
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
