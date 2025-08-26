import { defineConfig } from 'vite'
import path, { resolve } from 'path'
import fs, { copyFileSync } from 'fs'

export default defineConfig({
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background.ts'),
        content: resolve(__dirname, 'src/content.ts'),
        popup: resolve(__dirname, 'src/popup/popup.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
        manualChunks: undefined,
      }
    },
    minify: false,
    sourcemap: true,
  },
  plugins: [
    {
      name: 'copy-files',
      writeBundle() {
        copyFileSync('src/manifest.json', 'dist/manifest.json')
        // Copy icons directory if it exists (png/svg)
        try {
          if (fs.existsSync('src/icons')) {
            if (!fs.existsSync('dist/icons')) {
              fs.mkdirSync('dist/icons', { recursive: true })
            }
            const iconFiles = fs.readdirSync('src/icons').filter((f: string) => f.endsWith('.png') || f.endsWith('.svg'))
            iconFiles.forEach((file: string) => {
              copyFileSync(path.join('src/icons', file), path.join('dist/icons', file))
            })
            console.log(`📁 Copied ${iconFiles.length} icon files to dist/icons/`)
          } else {
            console.warn('Note: No icon files found in src/icons/')
          }
        } catch (e) {
          console.warn('Note: Icon copy failed', e)
        }
        // Place popup.html at dist root
        try {
          const builtPopupPath = path.join('dist', 'src', 'popup', 'popup.html')
          const destPopupPath = path.join('dist', 'popup.html')
          if (fs.existsSync(builtPopupPath)) {
            fs.copyFileSync(builtPopupPath, destPopupPath)
            console.log('📄 Copied popup.html to dist/popup.html')
          }
        } catch (e) {
          console.warn('Note: Could not copy popup.html to dist root')
        }
      }
    }
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
  },
})