import { defineConfig } from 'vite'
import type { Connect, ViteDevServer, PreviewServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'
import { fileURLToPath, URL } from 'node:url'
import { createReadStream, statSync } from 'node:fs'
import { join } from 'node:path'

// Served at `/` standalone, or `/plugins/sibyl/` when built for trex
// (npm run build:trex). The router uses import.meta.env.BASE_URL, so the
// router base follows this automatically.
const uiBase = process.env.VITE_UI_BASE_PATH || '/'
// Where the dev server proxies trex backend calls (auth, rest, graphql).
// This repo's docker-compose stack exposes trex HTTP on 8011 (8010 is TLS).
const trexProxy = process.env.VITE_TREX_PROXY || 'http://localhost:8011'

// shinylive's webR (used by the results-viewer plugin) fetches its base image
// `webr/library.data.gz` — which holds shiny + its deps — and decompresses the
// gzip itself in `webr-worker.js`. vite/sirv serves `.gz` files with
// `Content-Encoding: gzip`, so the browser transparently decompresses them; webR
// then receives already-inflated bytes, its own gunzip fails, the base image
// never mounts, and the app dies with "there is no package called 'shiny'".
// Serve shinylive's `.gz` assets as opaque bytes with NO Content-Encoding so
// webR gets the raw gzip. (A production server must do the same, e.g. Caddy
// `file_server` without precompressed gzip.)
function serveShinyliveGzRaw() {
  const publicDir = fileURLToPath(new URL('./public', import.meta.url))
  const base = uiBase.replace(/\/$/, '')
  const handler: Connect.NextHandleFunction = (req, res, next) => {
    const url = (req.url || '').split('?')[0]
    if (!url.endsWith('.gz') || !url.includes('/shinylive/')) return next()
    const rel = base && url.startsWith(base) ? url.slice(base.length) : url
    try {
      const fp = join(publicDir, decodeURIComponent(rel))
      const st = statSync(fp)
      res.setHeader('Content-Type', 'application/octet-stream')
      res.setHeader('Accept-Ranges', 'bytes')
      res.setHeader('Cache-Control', 'no-cache')
      const range = req.headers.range
      const m = range && /bytes=(\d*)-(\d*)/.exec(range)
      if (m) {
        const start = m[1] ? parseInt(m[1], 10) : 0
        const end = m[2] ? parseInt(m[2], 10) : st.size - 1
        res.statusCode = 206
        res.setHeader('Content-Range', `bytes ${start}-${end}/${st.size}`)
        res.setHeader('Content-Length', String(end - start + 1))
        createReadStream(fp, { start, end }).pipe(res)
      } else {
        res.setHeader('Content-Length', String(st.size))
        createReadStream(fp).pipe(res)
      }
    } catch {
      next()
    }
  }
  return {
    name: 'serve-shinylive-gz-raw',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(handler)
    },
    configurePreviewServer(server: PreviewServer) {
      server.middlewares.use(handler)
    },
  }
}

export default defineConfig({
  base: uiBase,
  plugins: [vue(), vuetify({ autoImport: true }), serveShinyliveGzRaw()],
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
    // Cross-origin isolation so plugins that use SharedArrayBuffer (the
    // results-viewer's WebR + DuckDB-WASM workers) can run. `credentialless`
    // is used over `require-corp` so any cross-origin asset webR may pull
    // (e.g. from repo.r-wasm.org) isn't blocked for lacking a CORP header.
    // Harmless for the other plugins. Behind the trex published image the same
    // headers must be set by the backend for the /plugins/sibyl route — a follow-up.
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
    proxy: {
      '/trex': { target: trexProxy, changeOrigin: true, secure: false },
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
    // Don't let vite auto-decompress .gz assets — WebR needs the raw bytes.
    proxy: {},
  },
})
