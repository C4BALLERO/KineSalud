import { defineConfig } from 'vitest/config';

// Las pruebas *.emulator.test.ts necesitan Firestore Emulator y usan su propia
// configuración (vitest.emulator.config.ts, vía `npm run test:integration`).
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.emulator.test.ts', 'node_modules/**'],
  },
});
