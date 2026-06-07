import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    environmentOptions: { jsdom: { url: 'http://localhost/' } },
    setupFiles: ['tests/setup.ts'],
    globals: true,
    include: ['tests/**/*.spec.ts'],
    exclude: ['tests/e2e/**'],
    // Transform Vuetify and @ohdsi/atlas-ui (which renders Vuetify internally)
    // rather than treating them as external, so their `.css` imports are handled
    // by vite instead of Node's ESM loader — otherwise a spec that renders an
    // Atlas/Vuetify component throws "Unknown file extension .css".
    server: { deps: { inline: ['vuetify', '@ohdsi/atlas-ui'] } },
  },
});
