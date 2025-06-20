import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, 'src') },
      { find: '@components', replacement: path.resolve(__dirname, 'components') },
      { find: '@pages', replacement: path.resolve(__dirname, 'Pages') },
      { find: '@services', replacement: path.resolve(__dirname, 'services') }
    ]
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor-react'
            }
            if (id.includes('framer-motion') || id.includes('react-hot-toast')) {
              return 'vendor-ui'
            }
            return 'vendor'
          }
          if (id.includes('services')) {
            return 'services'
          }
          if (id.includes('components')) {
            return 'components'
          }
        }
      }
    }
  },
  optimizeDeps: {
    include: [
      'react', 
      'react-dom', 
      'react-router-dom', 
      'framer-motion', 
      'react-hot-toast',
      '@microsoft/signalr'
    ],
    exclude: []
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
  },
  esbuild: {
    jsxInject: `import React from 'react'`
  }
})
