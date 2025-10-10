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
    sourcemap: true,
    // メモリ使用量を削減するための最適化
    rollupOptions: {
      output: {
        manualChunks: {
          // CodeMirrorを個別チャンクに分離
          'codemirror': ['@codemirror/state', '@codemirror/view', '@codemirror/commands', '@codemirror/language', '@codemirror/lang-markdown', '@codemirror/autocomplete', '@codemirror/search', '@codemirror/lint', '@replit/codemirror-vim'],
          // Transformersとonnxruntimeを個別チャンクに分離（111MB）
          'ml-runtime': ['@xenova/transformers'],
          // その他の大きな依存を分離
          'mermaid': ['mermaid'],
          'vendor': ['react', 'react-dom', 'zustand', 'immer'],
          'utils': ['marked', 'jszip', 'lucide-react']
        }
      }
    },
    // チャンクサイズ警告の閾値を上げる（大きな依存があるため）
    chunkSizeWarningLimit: 1000
  },
  base: command === 'serve' ? '/' : '/Mindoodle/',
}))
