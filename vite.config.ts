import { defineConfig } from 'vite'

const gitSha = process.env.VITE_GIT_SHA ?? 'dev'

export default defineConfig({
  base: './',
  define: {
    __GIT_SHA__: JSON.stringify(gitSha),
  },
  server: {
    fs: {
      strict: false,
    },
  },
})
