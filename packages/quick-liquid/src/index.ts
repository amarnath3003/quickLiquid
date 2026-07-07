/**
 * quick-liquid - Liquid Glass UI Framework
 *
 * Produces Apple's liquid glass visual effect with real refraction distortion
 * and smooth liquid animations.
 */

// Core glass engine
export { LiquidGlassEngine, DEFAULT_CONFIG, MATERIAL_PRESETS } from './core/engine';
export type { LiquidGlassConfig } from './core/engine';

// Liquid animations
export {
  // Spring physics
  Spring,
  SpringVector,
  SPRING_PRESETS,
  // Scheduler
  AnimationScheduler,
  // Morphing and metaballs
  LiquidMorph,
  LiquidMetaball,
  generateMergeBlob,
  // Transitions
  LiquidTransition,
  LiquidLayoutAnimation,
  // Gestures
  LiquidGesture,
  LiquidButton,
  LiquidDrag,
  // Group system
  LiquidGroup,
  LiquidTabBar,
} from './animations';

export type {
  SpringConfig,
  SpringPreset,
  MorphTarget,
  MorphConfig,
  TransformState,
  AnimatableProperty,
  LiquidTransitionConfig,
  GestureConfig,
  LiquidGroupConfig,
} from './animations';
