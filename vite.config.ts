import { defineConfig } from 'vite';

export default defineConfig({
  base: './',                       // relative paths so the native WebView can load assets
  build: { target: 'es2020', outDir: 'dist' },
  server: { host: true, port: 5173 },
  // bundle the native plugins up front: discovering them mid-load makes the dev server reload the page
  optimizeDeps: { include: ['@capacitor/core', '@capacitor/share', '@capacitor/filesystem', 'pixi.js'] },
});
