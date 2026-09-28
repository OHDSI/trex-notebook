/// <reference types="vitest" />
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vuetify from 'vite-plugin-vuetify';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Default target is the sibyl shell's plugin dir (dev/CI `npm run build`,
// matching how the plugin is actually consumed at runtime). Standalone
// package builds (npm publish) set OUT_DIR=dist via `build:pkg`.
// The notebook package's pyodide worker falls back to a HARDCODED CDN url
// (v0.29.0). loadPyodide checks that the CDN build matches the bundled JS
// package and rejects with "Pyodide version does not match" when they differ —
// which is why the Python kernel came up red on pyodide 0.29.4. Resolve the
// installed version and hand the worker a matching indexUrl. Fail the build
// loudly rather than shipping a mismatch that only shows up as a dead kernel.
const pyodideVersion: string = (() => {
  // pyodide is a dependency of ../notebook (the lib this plugin bundles from
  // source), NOT of this package — CI installs the two separately, so it lives
  // in ../notebook/node_modules and resolving from this file alone only works
  // with a hoisted install. Resolve from the lib first, then fall back.
  const roots = [
    path.resolve(__dirname, '../notebook/package.json'),
    fileURLToPath(import.meta.url),
  ];
  for (const root of roots) {
    try {
      return JSON.parse(
        readFileSync(createRequire(root).resolve('pyodide/package.json'), 'utf-8')
      ).version;
    } catch {
      // try the next root
    }
  }
  throw new Error(
    'Could not resolve the installed pyodide version from ' + roots.join(' or ')
  );
})();

// rD2E is not a real webR package — it is injected as R source and its import
// is shimmed (see src/kernels/rD2EBootstrap.ts). Read as a JSON string rather
// than `?raw` so R escape sequences survive template-literal interpolation.
const rD2ESource = readFileSync(
  path.resolve(__dirname, 'src/kernels/rD2E.R'),
  'utf-8'
);

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
  // Relative base. The plugin is served from a nested path
  // (/atlas/plugins/notebook-plugin/), not the origin root, and the default
  // base of '/' makes Vite emit asset URLs as "/assets/x.js". Those are
  // ABSOLUTE, so `new URL("/assets/x.js", import.meta.url)` discards the
  // module's directory and resolves against the origin — the Pyodide worker
  // then 404s and the Python kernel never comes up. './' keeps them relative
  // so they resolve against the bundle's own URL.
  base: './',
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
    __PYODIDE_VERSION__: JSON.stringify(pyodideVersion),
  },
  test: {
    environment: 'happy-dom',
    globals: false,
    include: ['src/**/*.spec.ts', 'tests/**/*.spec.ts'],
    exclude: ['tests/e2e/**'],
    // @ohdsi/atlas-ui ships from GitHub Packages and needs NODE_AUTH_TOKEN, so
    // it is not installed for local/CI unit runs. Component tests resolve it to
    // minimal stubs instead. Production builds use the real package.
    alias: {
      '@ohdsi/atlas-ui': path.resolve(__dirname, './tests/stubs/atlas-ui.ts'),
    },
  },
});
