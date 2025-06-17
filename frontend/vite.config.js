import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './components'),
      '@pages': path.resolve(__dirname, './Pages'),
      '@services': path.resolve(__dirname, './services')
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html')
      }
    }
  },
  server: {
    port: 5175,
    proxy: {
      '/chathub': {
        target: 'http://localhost:5211',
        ws: true,
        secure: false,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/chathub/, '/chathub')
      },
      '/api': {
        target: 'http://localhost:5211',
        secure: false,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api')
      }
    },
    cors: true
  }
})
