import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [svelte()],
  base: '/runlab/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
})
