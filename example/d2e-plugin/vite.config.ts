import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js'
import path from 'path'
import type { Plugin } from 'vite'

/**
 * Rollup doesn't emit SystemJS export calls when there are no external
 * dependencies (empty System.register([],...)). This plugin patches the
 * output to properly export the single-spa lifecycle functions.
 */
function systemjsExportPlugin(): Plugin {
  return {
    name: 'systemjs-lifecycle-exports',
    generateBundle(_, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk' || !chunk.isEntry) continue
        // Match the tail pattern: varName.bootstrap,varName.mount,varName.unmount
        // Find the export function name (first arg to System.register callback)
        const exportFnMatch = chunk.code.match(
          /System\.register\(\[\],\(function\((\w+),/
        )
        if (!exportFnMatch) continue
        const exportFn = exportFnMatch[1]
        // Match: varName.bootstrap,varName.mount,varName.unmount})}}));
        const match = chunk.code.match(
          /(\w+)\.bootstrap,\1\.mount,\1\.unmount\}\)\}\}\)\);\s*$/
        )
        if (!match) continue
        const v = match[1]
        chunk.code = chunk.code.replace(
          new RegExp(`${v}\\.bootstrap,${v}\\.mount,${v}\\.unmount\\}\\)\\}\\}\\)\\);\\s*$`),
          `${exportFn}("bootstrap",${v}.bootstrap),${exportFn}("mount",${v}.mount),${exportFn}("unmount",${v}.unmount)})}}));\n`
        )
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), cssInjectedByJsPlugin(), systemjsExportPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  worker: {
    format: 'es',
  },
  server: {
    port: 8084,
    headers: {
      // Required for WebR SharedArrayBuffer support
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  base: './',
  build: {
    rollupOptions: {
      input: path.resolve(__dirname, 'src/lifecycles.tsx'),
      external: [],
      output: {
        format: 'system',
        entryFileNames: 'lifecycles.js',
        chunkFileNames: 'assets/[name]-[hash].js',
      },
    },
    outDir: 'resources/notebook',
  },
})
