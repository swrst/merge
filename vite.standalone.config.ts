/* Build used only for MergeRocket.html: one bundle, no code splitting, so the
   whole game can be inlined into a single double-clickable file. */
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    outDir: 'dist-standalone',
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
