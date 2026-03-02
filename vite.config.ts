import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  server: {
    fs: {
      strict: false,
    },
  },
})
