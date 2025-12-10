import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'build',
    rollupOptions: {
      input: {
        main: 'index.html',
        overlay: 'src/overlay.html'
      }
    }
  },
  server: {
    watch: {
      // Exclude files/folders that cause reload loops
      ignored: [
        '**/progress.json',
        '**/tesseract-portable/**',
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/vision/**',
        '**/tarkov_assets/**',
        '**/*.log',
        '**/.git/**',
        '**/resources/**',
        '**/tailwind.config.js',
        '**/postcss.config.mjs'
      ],
      // Disable polling for better performance
      usePolling: false
    },
    // Disable HMR completely to prevent rebuild loops
    hmr: false
  }
})
