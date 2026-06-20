import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vuetify from 'vite-plugin-vuetify';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = process.env.STRATEGUS_OUT_DIR
  ? join(__dirname, process.env.STRATEGUS_OUT_DIR)
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
    environment: 'jsdom',
    globals: false,
    include: ['tests/**/*.spec.ts'],
  },
});
