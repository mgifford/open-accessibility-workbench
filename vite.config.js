import { defineConfig } from 'vite';

export default defineConfig({
  root: './',
  base: './',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    target: 'esnext'
  },
  worker: {
    format: 'es'
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/unit/**/*.{test,spec}.js']
  }
});
