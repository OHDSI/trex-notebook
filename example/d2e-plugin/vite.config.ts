import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss(), cssInjectedByJsPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../src'),
    },
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
  build: {
    rollupOptions: {
      input: path.resolve(__dirname, 'src/lifecycles.tsx'),
      external: ['react', 'react-dom'],
      output: {
        format: 'system',
        entryFileNames: 'lifecycles.js',
        chunkFileNames: 'assets/[name]-[hash].js',
      },
    },
    outDir: 'resources/notebook',
  },
})
