/**
 * quick-liquid/animations/spring.ts
 * 
 * Spring physics engine — the heart of Apple's liquid motion.
 * 
 * Apple uses critically-damped and slightly under-damped springs for
 * EVERYTHING: sheet presentations, button presses, icon morphs, tab
 * switches. The "liquid" feel comes from spring physics, not bezier easing.
 * 
 * This implementation solves the damped harmonic oscillator analytically:
 *   x'' + 2ζω₀x' + ω₀²x = 0
 * 
 * Where:
 *   ω₀ = natural frequency (stiffness)
 *   ζ  = damping ratio (0 = no damping, 1 = critical, >1 = overdamped)
 * 
 * PERFORMANCE: No per-frame integration error accumulation.
 * Uses closed-form solution → exact position at any time t.
 */

export interface SpringConfig {
  /** Stiffness (tension). Higher = faster oscillation. Apple typical: 200-400 */
  stiffness: number;
  /** Damping. Higher = less bounce. Apple typical: 20-30 */
  damping: number;
  /** Mass. Keep at 1 unless simulating heavy elements. */
  mass: number;
  /** Velocity threshold to consider "at rest" (default: 0.01) */
  restThreshold: number;
  /** Displacement threshold to consider "at rest" (default: 0.01) */
  restDisplacementThreshold: number;
  /** Clamp to target when within threshold (prevents micro-oscillation) */
  clampOnRest: boolean;
}

/** Apple's preset spring configs */
export const SPRING_PRESETS = {
  /** iOS default spring — slightly bouncy, smooth (sheet presentations) */
  default: { stiffness: 300, damping: 26, mass: 1, restThreshold: 0.01, restDisplacementThreshold: 0.01, clampOnRest: true } as SpringConfig,
  /** Snappy response — button presses, tab switches */
  snappy: { stiffness: 400, damping: 30, mass: 1, restThreshold: 0.01, restDisplacementThreshold: 0.01, clampOnRest: true } as SpringConfig,
  /** Bouncy — playful elements, notification badges */
  bouncy: { stiffness: 250, damping: 15, mass: 1, restThreshold: 0.01, restDisplacementThreshold: 0.01, clampOnRest: true } as SpringConfig,
  /** Gentle — large UI panels, background elements */
  gentle: { stiffness: 150, damping: 20, mass: 1, restThreshold: 0.01, restDisplacementThreshold: 0.01, clampOnRest: true } as SpringConfig,
  /** Stiff — micro-interactions, haptic-like feedback */
  stiff: { stiffness: 600, damping: 35, mass: 1, restThreshold: 0.01, restDisplacementThreshold: 0.01, clampOnRest: true } as SpringConfig,
  /** Liquid merge — slow, gooey, for blob merging animations */
  liquidMerge: { stiffness: 120, damping: 14, mass: 1.2, restThreshold: 0.005, restDisplacementThreshold: 0.005, clampOnRest: true } as SpringConfig,
  /** Liquid split — faster separation with slight overshoot */
  liquidSplit: { stiffness: 280, damping: 18, mass: 0.8, restThreshold: 0.01, restDisplacementThreshold: 0.01, clampOnRest: true } as SpringConfig,
} as const;

export type SpringPreset = keyof typeof SPRING_PRESETS;

/**
 * Analytical spring solver.
 * 
 * Given initial conditions, computes exact (position, velocity) at time t.
 * No numerical integration → no drift, no timestep sensitivity.
 */
export class Spring {
  private cfg: SpringConfig;
  
  // State
  private _value: number;
  private _target: number;
  private _velocity: number;
  private _startTime: number = 0;
  private _startValue: number = 0;
  private _startVelocity: number = 0;
  private _atRest: boolean = true;

  // Derived
  private _omega0: number = 0; // Natural frequency
  private _zeta: number = 0;   // Damping ratio
  private _omegaD: number = 0; // Damped frequency

  constructor(
    initialValue: number = 0,
    config: Partial<SpringConfig> | SpringPreset = 'default'
  ) {
    this.cfg = typeof config === 'string'
      ? { ...SPRING_PRESETS[config] }
      : { ...SPRING_PRESETS.default, ...config };

    this._value = initialValue;
    this._target = initialValue;
    this._velocity = 0;
    this.computeDerivedConstants();
  }

  private computeDerivedConstants(): void {
    const { stiffness, damping, mass } = this.cfg;
    this._omega0 = Math.sqrt(stiffness / mass);
    this._zeta = damping / (2 * Math.sqrt(stiffness * mass));
    
    if (this._zeta < 1) {
      // Under-damped: oscillates
      this._omegaD = this._omega0 * Math.sqrt(1 - this._zeta * this._zeta);
    } else {
      this._omegaD = 0;
    }
  }

  /** Set new target — starts or continues animation */
  setTarget(target: number): void {
    if (target === this._target && this._atRest) return;
    
    // Capture current state as new initial conditions
    this._startValue = this._value;
    this._startVelocity = this._velocity;
    this._startTime = -1; // Will be set on first tick
    this._target = target;
    this._atRest = false;
  }

  /** Interrupt with new value (e.g., during gesture) */
  setValue(value: number, velocity: number = 0): void {
    this._value = value;
    this._velocity = velocity;
    this._startValue = value;
    this._startVelocity = velocity;
    this._startTime = -1;
    this._atRest = false;
  }

  /** Add velocity impulse (e.g., flick gesture) */
  addVelocity(v: number): void {
    this._velocity += v;
    this._startValue = this._value;
    this._startVelocity = this._velocity;
    this._startTime = -1;
    this._atRest = false;
  }

  /**
   * Advance spring to time `now` (ms timestamp from performance.now()).
   * Returns true if still animating, false if at rest.
   */
  tick(now: number): boolean {
    if (this._atRest) return false;

    if (this._startTime < 0) {
      this._startTime = now;
    }

    const t = (now - this._startTime) / 1000; // seconds
    const x0 = this._startValue - this._target; // displacement from target
    const v0 = this._startVelocity;

    let x: number;
    let v: number;

    if (this._zeta < 1) {
      // UNDER-DAMPED (oscillates) — most common for Apple springs
      const env = Math.exp(-this._zeta * this._omega0 * t);
      const cos = Math.cos(this._omegaD * t);
      const sin = Math.sin(this._omegaD * t);
      
      const A = x0;
      const B = (v0 + this._zeta * this._omega0 * x0) / this._omegaD;
      
      x = env * (A * cos + B * sin);
      v = env * (
        (B * this._omegaD - A * this._zeta * this._omega0) * cos -
        (A * this._omegaD + B * this._zeta * this._omega0) * sin
      );
    } else if (this._zeta === 1) {
      // CRITICALLY DAMPED — fastest to rest without oscillation
      const env = Math.exp(-this._omega0 * t);
      x = env * (x0 + (v0 + this._omega0 * x0) * t);
      v = env * (v0 * (1 - this._omega0 * t) - x0 * this._omega0 * this._omega0 * t);
    } else {
      // OVER-DAMPED — slow return, no oscillation (rarely used)
      const s1 = -this._omega0 * (this._zeta - Math.sqrt(this._zeta * this._zeta - 1));
      const s2 = -this._omega0 * (this._zeta + Math.sqrt(this._zeta * this._zeta - 1));
      const A = (v0 - s2 * x0) / (s1 - s2);
      const B = x0 - A;
      
      x = A * Math.exp(s1 * t) + B * Math.exp(s2 * t);
      v = A * s1 * Math.exp(s1 * t) + B * s2 * Math.exp(s2 * t);
    }

    this._value = this._target + x;
    this._velocity = v;

    // Check if at rest
    if (Math.abs(x) < this.cfg.restDisplacementThreshold &&
        Math.abs(v) < this.cfg.restThreshold) {
      if (this.cfg.clampOnRest) {
        this._value = this._target;
        this._velocity = 0;
      }
      this._atRest = true;
      return false;
    }

    return true;
  }

  // ─── Accessors ────────────────────────────────────────────────
  get value(): number { return this._value; }
  get target(): number { return this._target; }
  get velocity(): number { return this._velocity; }
  get atRest(): boolean { return this._atRest; }

  /** Damping ratio — <1 bouncy, =1 critical, >1 overdamped */
  get dampingRatio(): number { return this._zeta; }

  /** Update spring config on the fly */
  updateConfig(config: Partial<SpringConfig>): void {
    // Capture current state before recomputing
    this._startValue = this._value;
    this._startVelocity = this._velocity;
    this._startTime = -1;
    
    this.cfg = { ...this.cfg, ...config };
    this.computeDerivedConstants();
  }
}

/**
 * Multi-dimensional spring (2D/3D positions, colors, etc.)
 * Efficient: single tick call updates all dimensions.
 */
export class SpringVector {
  private springs: Spring[];

  constructor(
    initialValues: number[],
    config: Partial<SpringConfig> | SpringPreset = 'default'
  ) {
    this.springs = initialValues.map(v => new Spring(v, config));
  }

  setTarget(targets: number[]): void {
    for (let i = 0; i < this.springs.length; i++) {
      this.springs[i].setTarget(targets[i]);
    }
  }

  setValue(values: number[], velocities?: number[]): void {
    for (let i = 0; i < this.springs.length; i++) {
      this.springs[i].setValue(values[i], velocities?.[i] ?? 0);
    }
  }

  addVelocity(velocities: number[]): void {
    for (let i = 0; i < this.springs.length; i++) {
      this.springs[i].addVelocity(velocities[i]);
    }
  }

  tick(now: number): boolean {
    let anyActive = false;
    for (const s of this.springs) {
      if (s.tick(now)) anyActive = true;
    }
    return anyActive;
  }

  get values(): number[] {
    return this.springs.map(s => s.value);
  }

  get atRest(): boolean {
    return this.springs.every(s => s.atRest);
  }

  get velocities(): number[] {
    return this.springs.map(s => s.velocity);
  }
}
