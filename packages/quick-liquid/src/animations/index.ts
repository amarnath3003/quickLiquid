/**
 * quick-liquid/animations/index.ts
 * 
 * Liquid animations — the "water" in liquid glass.
 * 
 * This module provides spring-physics animations that make glass
 * elements feel alive: merging like water droplets, bouncing on press,
 * stretching with gestures, and flowing between states.
 */

// Core physics
export { Spring, SpringVector, SPRING_PRESETS } from './spring';
export type { SpringConfig, SpringPreset } from './spring';

// Animation scheduler
export { AnimationScheduler } from './scheduler';

// Shape morphing & metaballs
export { LiquidMorph, LiquidMetaball, generateMergeBlob } from './morph';
export type { MorphTarget, MorphConfig } from './morph';

// Spring-animated transitions
export { LiquidTransition, LiquidLayoutAnimation } from './transitions';
export type { TransformState, AnimatableProperty, LiquidTransitionConfig } from './transitions';

// Gesture handling
export { LiquidGesture, LiquidButton, LiquidDrag } from './gestures';
export type { GestureConfig } from './gestures';

// Multi-element group system
export { LiquidGroup, LiquidTabBar } from './group';
export type { LiquidGroupConfig } from './group';
