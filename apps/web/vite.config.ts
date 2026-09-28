/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    // Hilos en lugar de procesos: en Windows el primer arranque de los procesos
    // puede superar el tiempo de espera mientras el antivirus analiza node_modules.
    pool: 'threads',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
