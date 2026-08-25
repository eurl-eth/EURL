/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  define: {
    'import.meta.env.VITE_HASH_ROUTER': JSON.stringify('1'),
  },
  build: {
    outDir: 'dist-single',
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 100_000_000,
  },
})
