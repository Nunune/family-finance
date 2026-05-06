import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
      '/socket.io': { target: 'http://localhost:3001', ws: true },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Recharts + all D3 sub-packages → lazy chunk (not in initial bundle)
          if (id.includes('recharts') || id.includes('/d3-') || id.includes('node_modules/d3')) {
            return 'charts'
          }
          // Everything else in node_modules → single vendor chunk
          if (id.includes('node_modules')) {
            return 'vendor'
          }
        },
      },
    },
  },
})
