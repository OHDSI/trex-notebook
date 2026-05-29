import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  // The fixture is built from the repo root (cwd), so Vite would otherwise
  // default publicDir to the host's public/ and recursively copy it into
  // outDir (which lives inside public/). Disable it — the fixture has no assets.
  publicDir: false,
  build: {
    lib: {
      entry: fileURLToPath(new URL('./src/main.ts', import.meta.url)),
      formats: ['system'],
      fileName: 'index',
    },
    rollupOptions: {
      external: ['vue'],
      output: { format: 'system', globals: { vue: 'vue' } },
    },
    outDir: fileURLToPath(new URL('../../../public/plugins/hello-fixture-plugin', import.meta.url)),
    emptyOutDir: true,
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
  },
})
