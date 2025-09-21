import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const PORT = parseInt(process.env.PORT || '5174', 10);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@local': path.resolve(__dirname, './src/Local'),
      '@local/core': path.resolve(__dirname, './src/Local/core'),
      '@local/features': path.resolve(__dirname, './src/Local/features'),
      '@local/shared': path.resolve(__dirname, './src/Local/shared'),
      '@shared': path.resolve(__dirname, './src/app/shared')
    }
  },
  server: {
    port: PORT,
    strictPort: true,
    host: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  },
base: '/Mindoodle/',
})
