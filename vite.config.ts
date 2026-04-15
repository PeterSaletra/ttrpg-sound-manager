import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/ttrpg-sound-manager",
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
