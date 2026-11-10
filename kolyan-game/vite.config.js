import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// One self-contained index.html: easy to host anywhere (GitHub Pages, any static host, artifact).
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: { outDir: '../kolyan', emptyOutDir: true, target: 'es2019', chunkSizeWarningLimit: 2000 },
});
