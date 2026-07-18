import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiPort = Number(process.env.COMPANION_SURFACE_PORT || 8790)
const uiPort = Number(process.env.COMPANION_UI_PORT || 5174)

export default defineConfig({
  plugins: [react()],
  root: '.',
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
