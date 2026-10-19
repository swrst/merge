import { defineConfig } from 'vite';
import { existsSync } from 'node:fs';

export default defineConfig({
  base: './',                       // relative paths so the native WebView can load assets
  build: { target: 'es2020', outDir: 'dist' },
  // Firebase switches itself on when android/app/google-services.json is present
  define: { __HAS_FIREBASE__: JSON.stringify(existsSync('android/app/google-services.json')) },
  server: { host: true, port: 5173 },
  // bundle the native plugins up front: discovering them mid-load makes the dev server reload the page
  optimizeDeps: { include: ['@capacitor/core', '@capacitor/share', '@capacitor/filesystem', 'pixi.js'] },
});
