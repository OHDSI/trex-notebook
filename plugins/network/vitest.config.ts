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
  },
});
