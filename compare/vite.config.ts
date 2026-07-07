import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  server: { port: 5175 },
  resolve: {
    alias: {
      'quick-liquid': path.resolve(__dirname, '../packages/quick-liquid/src'),
      'quick-liquid/react': path.resolve(__dirname, '../packages/quick-liquid/src/react'),
    },
  },
});
