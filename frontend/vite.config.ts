import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
    server: {
    host: '0.0.0.0',
    allowedHosts: ['.trycloudflare.com', '.archlinux'],
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/ws/insole': {
        target: 'ws://127.0.0.1:8765',
        ws: true,
      },
      '/ws/exoskeleton': {
        target: 'ws://127.0.0.1:8766',
        ws: true,
      },
    },
  },
})
