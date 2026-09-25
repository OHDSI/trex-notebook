/// <reference types="vitest" />
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vuetify from 'vite-plugin-vuetify';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read rD2E.R at build time; JSON.stringify produces a safely escaped string
// (avoids the R escape-sequence corruption that ?raw / template literals cause).
const rD2ESource = readFileSync(
  path.resolve(__dirname, './src/kernels/rD2E.R'),
  'utf-8'
)
// Default target is the sibyl shell's plugin dir (dev/CI `npm run build`,
// matching how the plugin is actually consumed at runtime). Standalone
// package builds (npm publish) set OUT_DIR=dist via `build:pkg`.
const OUT_DIR = process.env.OUT_DIR
  ? path.join(__dirname, process.env.OUT_DIR)
  : path.join(__dirname, '../sibyl/public/plugins/notebook-plugin');

export default defineConfig({
  plugins: [
    vue(),
    vuetify({ autoImport: true, styles: 'none' }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // The notebook source uses the `@/...` alias internally; point it at the
      // notebook package so its components compile when bundled from source.
      '@': path.resolve(__dirname, '../notebook/src'),
      '@trex/notebook': path.resolve(__dirname, '../notebook/src/index.ts'),
    },
  },
  worker: { format: 'es' },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
  },
  build: {
    cssCodeSplit: false,
    lib: {
      entry: './src/main.ts',
      formats: ['system'],
      fileName: 'index',
    },
    rollupOptions: {
      external: ['vue'],
      output: { format: 'system', globals: { vue: 'vue' } },
    },
    outDir: OUT_DIR,
    emptyOutDir: true,
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
    __RD2E_SOURCE__: JSON.stringify(rD2ESource),
  },
  test: {
    environment: 'happy-dom',
    globals: false,
    include: ['src/**/*.spec.ts', 'tests/**/*.spec.ts'],
    exclude: ['tests/e2e/**'],
  },
});
