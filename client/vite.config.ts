import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,   // Bind to 0.0.0.0 so the dev server is reachable inside Docker
    port: 5173,
  },
})
