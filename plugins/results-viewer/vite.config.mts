import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vuetify from 'vite-plugin-vuetify';
import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync, cpSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function copyPublicAssets() {
  return {
    name: 'copy-public-assets',
    closeBundle() {
      const outDir = join(__dirname, '../sibyl/public/plugins/results-viewer');

      // The httpuv service worker lives under src/public (not vite's default
      // publicDir), so it isn't emitted by the lib build. Copy it to the outDir
      // root so it is served at `<base>httpuv-serviceworker.js` with that scope.
      const swSrc = join(__dirname, 'src', 'public', 'httpuv-serviceworker.js');
      if (existsSync(swSrc)) {
        mkdirSync(outDir, { recursive: true });
        copyFileSync(swSrc, join(outDir, 'httpuv-serviceworker.js'));
      }

      // Copy shinylive export files
      const slDir = join(__dirname, 'shinylive-export');
      if (existsSync(slDir)) {
        const slOut = join(outDir, 'shinylive');
        mkdirSync(slOut, { recursive: true });
        for (const f of readdirSync(slDir)) {
          const src = join(slDir, f);
          const dest = join(slOut, f);
          if (statSync(src).isDirectory()) {
            cpSync(src, dest, { recursive: true });
          } else {
            copyFileSync(src, dest);
          }
        }
      }

      // Copy R package tarballs
      const pkgDir = join(__dirname, 'r-packages');
      if (existsSync(pkgDir)) {
        const destPkgDir = join(outDir, 'r-packages');
        mkdirSync(destPkgDir, { recursive: true });
        for (const f of readdirSync(pkgDir)) {
          if (f.endsWith('.tar.gz')) {
            copyFileSync(join(pkgDir, f), join(destPkgDir, f));
          }
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [
    vue(),
    vuetify({ autoImport: true, styles: 'none' }),
    copyPublicAssets(),
  ],
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
    outDir: '../sibyl/public/plugins/results-viewer',
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
    __BUILD_ID__: JSON.stringify(Date.now().toString(36)),
  },
});
