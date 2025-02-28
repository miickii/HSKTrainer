import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: '0.0.0.0',  // This exposes the server to all network interfaces
    port: 5173
  },
  plugins: [react()],
  base: '/HSKTrainer/',
  
  // Copy audio worklet files to public directory
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        // This ensures worklet files maintain their relative paths
        assetFileNames: (assetInfo) => {
          if (assetInfo.name.endsWith('.js') && assetInfo.name.includes('worklet')) {
            return 'assets/worklets/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
  },
})