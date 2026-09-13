import { defineConfig } from 'tsup';

// One build graph keeps the engine, caches and registry shared across entries.
export default defineConfig({
  entry: { index: 'src/index.ts', 'react/index': 'src/react/index.ts', 'core/index': 'src/core/index.ts' },
  outDir: 'dist',
  format: ['cjs', 'esm'],
  splitting: true,
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom'],
});
