import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: 'public',
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'GraphEditor',
      fileName: 'graph-editor',
      formats: ['es']
    },
    rollupOptions: {
      external: [],
    },
    outDir: 'dist',
    sourcemap: true,
  },
  server: {
    open: '/demo.html'
  }
});
