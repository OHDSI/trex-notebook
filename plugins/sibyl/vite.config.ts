import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'
import { fileURLToPath, URL } from 'node:url'

// Served at `/` standalone, or `/plugins/sibyl/` when built for trex
// (npm run build:trex). The router uses import.meta.env.BASE_URL, so the
// router base follows this automatically.
const uiBase = process.env.VITE_UI_BASE_PATH || '/'
// Where the dev server proxies trex backend calls (auth, rest, graphql).
// This repo's docker-compose stack exposes trex HTTP on 8011 (8010 is TLS).
const trexProxy = process.env.VITE_TREX_PROXY || 'http://localhost:8011'

export default defineConfig({
  base: uiBase,
  plugins: [vue(), vuetify({ autoImport: true })],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-vue': ['vue', 'vue-router', 'pinia'],
          'vendor-vuetify': ['vuetify'],
          'vendor-utils': ['zod'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      '/trex': { target: trexProxy, changeOrigin: true, secure: false },
    },
  },
})
