import { defineConfig } from 'vite';

export default defineConfig({
  base: './',                       // relative paths so the native WebView can load assets
  build: { target: 'es2020', outDir: 'dist' },
  server: { host: true, port: 5173 },
});
