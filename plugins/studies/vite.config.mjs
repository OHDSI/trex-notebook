import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vuetify from 'vite-plugin-vuetify';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = process.env.STUDIES_OUT_DIR
  ? join(__dirname, process.env.STUDIES_OUT_DIR)
  : join(__dirname, 'dist');

export default defineConfig({
  plugins: [
    vue(),
    vuetify({ autoImport: true, styles: 'none' }),
  ],
  build: {
    cssCodeSplit: false,
    lib: {
      entry: './src/main.ts',
      formats: ['system'],
      fileName: 'index',
    },
    rollupOptions: {
      external: ['vue'],
      output: {
        format: 'system',
        globals: { vue: 'vue' },
      },
    },
    outDir: OUT_DIR,
    emptyOutDir: true,
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
  },
  test: {
    environment: 'happy-dom',
    globals: false,
    include: ['src/**/*.spec.ts', 'tests/**/*.spec.ts'],
    exclude: ['tests/e2e/**'],
    // Transform Vuetify and @ohdsi/atlas-ui (which renders Vuetify internally)
    // rather than treating them as external, so their `.css` imports are handled
    // by vite instead of Node's ESM loader — otherwise a spec that renders an
    // Atlas/Vuetify component throws "Unknown file extension .css".
    server: { deps: { inline: ['vuetify', '@ohdsi/atlas-ui'] } },
  },
});
