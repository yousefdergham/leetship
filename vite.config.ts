import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    outDir: 'dist',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove any remaining console statements
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.warn'], // Remove specific functions
      },
    },
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/service-worker.ts'),
        content: resolve(__dirname, 'src/content/leetcode.ts'),
        injected: resolve(__dirname, 'src/injected/inject.js'),
        options: resolve(__dirname, 'src/ui/options.ts'),
        onboarding: resolve(__dirname, 'src/ui/onboarding.ts'),
      },

      output: {
        entryFileNames: chunk => {
          if (chunk.name === 'background') return 'background/service-worker.js'
          if (chunk.name === 'content') return 'content/leetcode.js'
          if (chunk.name === 'injected') return 'injected/inject.js'
          return '[name].js'
        },
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: assetInfo => {
          if (assetInfo.name?.endsWith('.html')) return '[name].[ext]'
          if (assetInfo.name?.endsWith('.css')) return 'styles/[name].[ext]'
          return 'assets/[name].[ext]'
        },
      },
    },
    copyPublicDir: false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
})
