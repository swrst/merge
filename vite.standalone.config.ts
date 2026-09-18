/* Build used only for MergeRocket.html: one bundle, no code splitting, so the
   whole game can be inlined into a single double-clickable file. */
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    outDir: 'dist-standalone',
    // the audio pack has to travel inside the HTML too, so nothing stays a
    // separate file: every asset becomes a data: URI regardless of size
    assetsInlineLimit: 40 * 1024 * 1024,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
