import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'quick-liquid': path.resolve(__dirname, '../packages/quick-liquid/src'),
      'quick-liquid/react': path.resolve(__dirname, '../packages/quick-liquid/src/react'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        docs: path.resolve(__dirname, 'docs/index.html'),
        playground: path.resolve(__dirname, 'playground/index.html'),
        lab: path.resolve(__dirname, 'lab/index.html'),
      },
    },
  },
});
