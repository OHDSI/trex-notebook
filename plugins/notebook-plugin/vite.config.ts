/// <reference types="vitest" />
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vuetify from 'vite-plugin-vuetify';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

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
    outDir: '../sibyl/public/plugins/notebook-plugin',
    emptyOutDir: true,
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
  },
  test: {
    environment: 'happy-dom',
    globals: false,
    include: ['src/**/*.spec.ts'],
  },
});
