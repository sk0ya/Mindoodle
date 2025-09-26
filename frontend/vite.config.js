import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const PORT = parseInt(process.env.PORT || '5174', 10);

export default defineConfig(({ command }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, './src/app/shared'),
      '@core': path.resolve(__dirname, './src/app/core'),
      '@commands': path.resolve(__dirname, './src/app/commands'),
      '@mindmap': path.resolve(__dirname, './src/app/features/mindmap'),
      '@ai': path.resolve(__dirname, './src/app/features/ai'),
      '@file-management': path.resolve(__dirname, './src/app/features/file-management'),
      '@markdown': path.resolve(__dirname, './src/app/features/markdown'),
      '@theme': path.resolve(__dirname, './src/app/features/theme'),
      '@vim': path.resolve(__dirname, './src/app/features/vim')
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
  base: command === 'serve' ? '/' : '/Mindoodle/',
}))
