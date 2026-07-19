import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const uiRoot = dirname(fileURLToPath(import.meta.url))
const apiPort = Number(process.env.COMPANION_SURFACE_PORT || 8790)
const uiPort = Number(process.env.COMPANION_UI_PORT || 5174)

export default defineConfig({
  plugins: [react()],
  root: uiRoot,
  server: {
    port: uiPort,
    proxy: {
      '/api': `http://127.0.0.1:${apiPort}`,
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
