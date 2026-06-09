/**
 * quick-liquid/animations/transitions.ts
 * 
 * Liquid transitions — spring-animated property changes.
 * 
 * This replaces CSS transitions with physics-based spring animations.
 * Apple's iOS never uses linear or cubic-bezier for UI motion —
 * everything is spring-based, which is why it feels "alive."
 * 
 * USAGE:
 *   const lt = new LiquidTransition(element);
 *   lt.to({ x: 100, y: 50, scale: 1.2, opacity: 0.8 });
 *   lt.to({ x: 0, y: 0, scale: 1, opacity: 1 }, 'bouncy');
 * 
 * All properties animate with independent springs, producing that
 * characteristic Apple "overshoot on position, settle on scale" look
 * where different properties settle at different rates.
 */

import { Spring, SpringConfig, SpringPreset, SPRING_PRESETS } from './spring';
import { AnimationScheduler } from './scheduler';

/** Animatable transform properties */
export interface TransformState {
  x: number;
  y: number;
  scale: number;
  scaleX: number;
  scaleY: number;
  rotate: number;
  opacity: number;
  borderRadius: number;
  /** For liquid glass: blur amount */
  blur: number;
  /** For liquid glass: rim highlight intensity */
  rimIntensity: number;
}

export type AnimatableProperty = keyof TransformState;

export interface LiquidTransitionConfig {
  /** Default spring for all properties */
  spring: Partial<SpringConfig> | SpringPreset;
  /** Per-property spring overrides (e.g., position bouncier than scale) */
  propertySprings: Partial<Record<AnimatableProperty, Partial<SpringConfig> | SpringPreset>>;
  /** Callback every frame with current state */
  onUpdate?: (state: TransformState) => void;
  /** Callback when all springs are at rest */
  onComplete?: () => void;
  /** Apply transforms directly to element style */
  autoApply: boolean;
}

const DEFAULT_TRANSITION_CONFIG: LiquidTransitionConfig = {
  spring: 'default',
  propertySprings: {},
  autoApply: true,
};

/**
 * Liquid transition controller — attaches to a DOM element and
 * provides spring-animated property changes.
 */
export class LiquidTransition {
  private el: HTMLElement;
  private cfg: LiquidTransitionConfig;
  private scheduler: AnimationScheduler;
  private springs: Map<AnimatableProperty, Spring> = new Map();
  private state: TransformState;
  private animId: number | null = null;
  private _initialState: TransformState;

  constructor(element: HTMLElement, config: Partial<LiquidTransitionConfig> = {}) {
    this.el = element;
    this.cfg = { ...DEFAULT_TRANSITION_CONFIG, ...config };
    this.scheduler = AnimationScheduler.shared();
    
    // Read initial state from element
    this._initialState = this.readCurrentState();
    this.state = { ...this._initialState };
  }

  /**
   * Animate to target state with spring physics.
   * Only specified properties are animated — others stay put.
   */
  to(
    target: Partial<TransformState>,
    spring?: Partial<SpringConfig> | SpringPreset
  ): this {
    for (const [key, value] of Object.entries(target) as [AnimatableProperty, number][]) {
      if (value === undefined) continue;
      
      let s = this.springs.get(key);
      if (!s) {
        // Create spring with per-property or default config
        const cfg = this.cfg.propertySprings[key] || spring || this.cfg.spring;
        s = new Spring(this.state[key], cfg);
        this.springs.set(key, s);
      } else if (spring) {
        // Update spring config if provided
        const resolved = typeof spring === 'string' ? SPRING_PRESETS[spring] : spring;
        s.updateConfig(resolved);
      }
      
      s.setTarget(value);
    }
    
    this.startAnimation();
    return this;
  }

  /**
   * Instantly set values (no animation) — useful during gestures.
   */
  set(values: Partial<TransformState>): this {
    for (const [key, value] of Object.entries(values) as [AnimatableProperty, number][]) {
      if (value === undefined) continue;
      this.state[key] = value;
      const s = this.springs.get(key);
      if (s) s.setValue(value);
    }
    if (this.cfg.autoApply) this.applyState();
    return this;
  }

  /**
   * Add velocity to properties — used after gesture release (flick).
   * The element will continue moving with momentum then spring back.
   */
  release(velocities: Partial<TransformState>, target?: Partial<TransformState>): this {
    for (const [key, velocity] of Object.entries(velocities) as [AnimatableProperty, number][]) {
      if (velocity === undefined) continue;
      
      let s = this.springs.get(key);
      if (!s) {
        const cfg = this.cfg.propertySprings[key] || this.cfg.spring;
        s = new Spring(this.state[key], cfg);
        this.springs.set(key, s);
      }
      
      s.addVelocity(velocity);
      if (target && target[key] !== undefined) {
        s.setTarget(target[key]!);
      }
    }
    
    this.startAnimation();
    return this;
  }

  /**
   * Spring back to initial state (e.g., after hover/press ends).
   */
  reset(spring?: Partial<SpringConfig> | SpringPreset): this {
    return this.to(this._initialState, spring || 'snappy');
  }

  /**
   * Get current animated state.
   */
  getState(): Readonly<TransformState> {
    return this.state;
  }

  /** Whether any spring is still animating */
  get isAnimating(): boolean {
    return this.animId !== null;
  }

  // ─── Internal ─────────────────────────────────────────────────

  private startAnimation(): void {
    if (this.animId !== null) return;
    
    this.animId = this.scheduler.schedule((now) => {
      let anyActive = false;
      
      for (const [key, spring] of this.springs) {
        if (spring.tick(now)) {
          anyActive = true;
        }
        this.state[key] = spring.value;
      }
      
      if (this.cfg.autoApply) this.applyState();
      if (this.cfg.onUpdate) this.cfg.onUpdate(this.state);
      
      if (!anyActive) {
        this.animId = null;
        if (this.cfg.onComplete) this.cfg.onComplete();
      }
      
      return anyActive;
    });
  }

  private applyState(): void {
    const s = this.state;
    
    // Compose transform — GPU-composited, no layout thrashing
    const transforms: string[] = [];
    if (s.x !== 0 || s.y !== 0) transforms.push(`translate3d(${s.x}px, ${s.y}px, 0)`);
    if (s.scale !== 1) transforms.push(`scale(${s.scale})`);
    else if (s.scaleX !== 1 || s.scaleY !== 1) transforms.push(`scale(${s.scaleX}, ${s.scaleY})`);
    if (s.rotate !== 0) transforms.push(`rotate(${s.rotate}deg)`);
    
    this.el.style.transform = transforms.join(' ') || 'none';
    
    if (s.opacity !== 1) {
      this.el.style.opacity = String(s.opacity);
    } else {
      this.el.style.opacity = '';
    }
    
    if (s.borderRadius > 0) {
      this.el.style.borderRadius = `${s.borderRadius}px`;
    }
  }

  private readCurrentState(): TransformState {
    const computed = getComputedStyle(this.el);
    const matrix = new DOMMatrix(computed.transform);
    
    return {
      x: matrix.e || 0,
      y: matrix.f || 0,
      scale: Math.sqrt(matrix.a * matrix.a + matrix.b * matrix.b) || 1,
      scaleX: matrix.a || 1,
      scaleY: matrix.d || 1,
      rotate: Math.atan2(matrix.b, matrix.a) * (180 / Math.PI) || 0,
      opacity: parseFloat(computed.opacity) || 1,
      borderRadius: parseFloat(computed.borderRadius) || 0,
      blur: 0,
      rimIntensity: 0,
    };
  }

  destroy(): void {
    if (this.animId !== null) {
      this.scheduler.cancel(this.animId);
      this.animId = null;
    }
    this.springs.clear();
    this.el.style.transform = '';
    this.el.style.opacity = '';
  }
}

/**
 * Layout animation — animates between layout states.
 * 
 * Apple's "magic move" / shared element transitions:
 * Captures element rect before a change, captures after,
 * then spring-animates the difference using FLIP technique.
 */
export class LiquidLayoutAnimation {
  private animations: Map<HTMLElement, LiquidTransition> = new Map();

  constructor() {
  }

  /**
   * Capture current positions of elements before a layout change.
   * Call this BEFORE modifying the DOM/layout.
   */
  capturePositions(elements: HTMLElement[]): Map<HTMLElement, DOMRect> {
    const positions = new Map<HTMLElement, DOMRect>();
    for (const el of elements) {
      positions.set(el, el.getBoundingClientRect());
    }
    return positions;
  }

  /**
   * Animate from captured positions to current positions.
   * Call this AFTER the DOM/layout change.
   * 
   * Uses FLIP (First, Last, Invert, Play) technique:
   * - Elements instantly appear at final position
   * - Transform offsets are applied to "fake" the old position
   * - Springs animate the offset back to zero
   */
  animateFromPositions(
    elements: HTMLElement[],
    previousPositions: Map<HTMLElement, DOMRect>,
    spring: Partial<SpringConfig> | SpringPreset = 'default'
  ): void {
    for (const el of elements) {
      const prev = previousPositions.get(el);
      if (!prev) continue;
      
      const curr = el.getBoundingClientRect();
      const dx = prev.left - curr.left;
      const dy = prev.top - curr.top;
      const sx = prev.width / curr.width;
      const sy = prev.height / curr.height;
      
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && 
          Math.abs(sx - 1) < 0.01 && Math.abs(sy - 1) < 0.01) {
        continue; // No meaningful change
      }
      
      let lt = this.animations.get(el);
      if (!lt) {
        lt = new LiquidTransition(el);
        this.animations.set(el, lt);
      }
      
      // Start at old position (inverted offset)
      lt.set({ x: dx, y: dy, scaleX: sx, scaleY: sy });
      // Animate to final position (zero offset)
      lt.to({ x: 0, y: 0, scaleX: 1, scaleY: 1 }, spring);
    }
  }

  /**
   * Convenience: wrap a callback that changes layout.
   * Automatically captures before and animates after.
   */
  animate(
    elements: HTMLElement[],
    layoutChange: () => void,
    spring?: Partial<SpringConfig> | SpringPreset
  ): void {
    const positions = this.capturePositions(elements);
    layoutChange();
    // Wait for browser to compute new layout
    requestAnimationFrame(() => {
      this.animateFromPositions(elements, positions, spring);
    });
  }

  destroy(): void {
    for (const lt of this.animations.values()) {
      lt.destroy();
    }
    this.animations.clear();
  }
}
