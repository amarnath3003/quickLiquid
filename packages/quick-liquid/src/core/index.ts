/**
 * quick-liquid/core/index.ts
 */
export { LiquidGlassEngine, DEFAULT_CONFIG } from './engine';
export type { LiquidGlassConfig } from './engine';

// v8 optimized engine — A/B candidate, see ../../OPTIMIZATION.md.
// Kept alongside v7 until visual parity is signed off in the compare app.
export { LiquidGlassEngineOpt } from './engine-opt';
export type { LiquidGlassOptConfig } from './engine-opt';
