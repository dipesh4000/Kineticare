import react from '@vitejs/plugin-react'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'


// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: [{ find: /^@mediapipe\/pose$/, replacement: fileURLToPath(new URL('./src/vision/mediapipePose.js', import.meta.url)) }] },
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: { '/api': process.env.API_PROXY_TARGET || 'http://127.0.0.1:3001' },
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
  },
})
