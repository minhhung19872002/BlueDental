import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5019',
        changeOrigin: true,
        secure: false,
      },
      '/signalr': {
        target: 'http://localhost:5019',
        changeOrigin: true,
        secure: false,
        ws: true,
        timeout: 0,
        proxyTimeout: 0,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    testTimeout: 30000,
  },
})
