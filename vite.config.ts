/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    // Default to a fast node environment for the pure-logic unit tests.
    // Component tests opt into jsdom with a `// @vitest-environment jsdom`
    // comment at the top of the file.
    environment: 'node',
    setupFiles: './src/test/setup.ts',
  },
})
