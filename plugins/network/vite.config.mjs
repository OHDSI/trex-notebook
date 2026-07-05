import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vuetify from 'vite-plugin-vuetify';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
// Default target is the sibyl shell's plugin dir (dev/CI `npm run build`,
// matching how the plugin is actually consumed at runtime). Standalone
// package builds (npm publish) set NETWORK_OUT_DIR=dist via `build:pkg`.
const OUT_DIR = process.env.NETWORK_OUT_DIR
  ? join(__dirname, process.env.NETWORK_OUT_DIR)
  : join(__dirname, '../sibyl/public/plugins/network-plugin');

export default defineConfig({
  plugins: [vue(), vuetify({ autoImport: true, styles: 'none' })],
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
  },
});
