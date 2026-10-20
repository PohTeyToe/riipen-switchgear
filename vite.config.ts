import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // The recorded runs ship as JSON in the bundle (about 130 KB gzipped in all).
  build: { chunkSizeWarningLimit: 800 },
  server: { port: 5104, strictPort: true },
  preview: { port: 5104, strictPort: true },
})
