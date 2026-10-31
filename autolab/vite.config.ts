import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Одна сборка → один HTML-файл (работает и на GitHub Pages, и как Artifact)
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  build: { outDir: '../auto', emptyOutDir: true, chunkSizeWarningLimit: 4000 },
});
