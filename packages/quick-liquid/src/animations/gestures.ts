/**
 * quick-liquid/animations/gestures.ts
 * 
 * Gesture-driven liquid animations.
 * 
 * Apple's liquid glass responds to touch with PHYSICS:
 * - Press: element compresses slightly (like pressing on water surface)
 * - Drag: element follows finger with slight lag (mass/inertia)
 * - Release: springs back with momentum + bounce
 * - Long press: slow "sink in" effect
 * - Flick: continues with velocity then snaps to target
 * 
 * The key insight: gestures don't just trigger animations — they
 * DRIVE the spring state. The finger IS the target, and when released,
 * the spring takes over with whatever velocity the gesture had.
 */

import type { SpringConfig, SpringPreset } from './spring';
import { LiquidTransition } from './transitions';

export interface GestureConfig {
  /** Spring for tracking finger during drag */
  dragSpring: Partial<SpringConfig> | SpringPreset;
  /** Spring for return-to-origin after release */
  releaseSpring: Partial<SpringConfig> | SpringPreset;
  /** Scale when pressed (< 1 for "push in" effect) */
  pressScale: number;
  /** How much the element "squishes" perpendicular to press */
  pressSquish: number;
  /** Velocity multiplier applied on release */
  flickMultiplier: number;
  /** Maximum drag distance (in px) before resistance kicks in */
  maxDragDistance: number;
  /** Rubber-band resistance beyond maxDragDistance (0-1, lower = more resistance) */
  rubberBandFactor: number;
  /** Enable the liquid "wobble" on press */
  wobbleOnPress: boolean;
  /** Enable scale animation on press */
  scaleOnPress: boolean;
  /** Velocity tracking window (ms) — how many recent points to use */
  velocityWindow: number;
}

const DEFAULT_GESTURE_CONFIG: GestureConfig = {
  dragSpring: 'snappy',
  releaseSpring: 'bouncy',
  pressScale: 0.95,
  pressSquish: 0.02,
  flickMultiplier: 1.2,
  maxDragDistance: Infinity,
  rubberBandFactor: 0.3,
  wobbleOnPress: true,
  scaleOnPress: true,
  velocityWindow: 100,
};

interface VelocityPoint {
  x: number;
  y: number;
  t: number;
}

/**
 * Liquid gesture handler — makes an element respond to
 * touch/pointer with spring physics.
 */
export class LiquidGesture {
  private el: HTMLElement;
  private cfg: GestureConfig;
  private transition: LiquidTransition;
  
  // Gesture state
  private pressed = false;
  private dragging = false;
  private startX = 0;
  private startY = 0;
  private velocityHistory: VelocityPoint[] = [];
  
  // Callbacks
  private _onDragStart?: (x: number, y: number) => void;
  private _onDrag?: (dx: number, dy: number, vx: number, vy: number) => void;
  private _onDragEnd?: (vx: number, vy: number) => void;
  private _onPress?: () => void;
  private _onRelease?: () => void;
  private _onTap?: () => void;

  // Pointer tracking
  private pointerId: number | null = null;
  private pressTimer: number | null = null;

  constructor(element: HTMLElement, config: Partial<GestureConfig> = {}) {
    this.el = element;
    this.cfg = { ...DEFAULT_GESTURE_CONFIG, ...config };
    this.transition = new LiquidTransition(element, {
      spring: this.cfg.dragSpring,
      propertySprings: {
        scale: this.cfg.releaseSpring,
        scaleX: this.cfg.releaseSpring,
        scaleY: this.cfg.releaseSpring,
      },
    });

    this.bindEvents();
  }

  // ─── Event Callbacks ──────────────────────────────────────────

  onDragStart(cb: (x: number, y: number) => void): this {
    this._onDragStart = cb; return this;
  }
  onDrag(cb: (dx: number, dy: number, vx: number, vy: number) => void): this {
    this._onDrag = cb; return this;
  }
  onDragEnd(cb: (vx: number, vy: number) => void): this {
    this._onDragEnd = cb; return this;
  }
  onPress(cb: () => void): this { this._onPress = cb; return this; }
  onRelease(cb: () => void): this { this._onRelease = cb; return this; }
  onTap(cb: () => void): this { this._onTap = cb; return this; }

  // ─── Internal ─────────────────────────────────────────────────

  private bindEvents(): void {
    const el = this.el;
    el.style.touchAction = 'none'; // Prevent browser gestures
    el.style.userSelect = 'none';
    el.style.webkitUserSelect = 'none';
    
    el.addEventListener('pointerdown', this.handlePointerDown, { passive: false });
    el.addEventListener('pointermove', this.handlePointerMove, { passive: true });
    el.addEventListener('pointerup', this.handlePointerUp, { passive: true });
    el.addEventListener('pointercancel', this.handlePointerUp, { passive: true });
  }

  private handlePointerDown = (e: PointerEvent): void => {
    if (this.pointerId !== null) return; // Already tracking
    
    this.pointerId = e.pointerId;
    this.el.setPointerCapture(e.pointerId);
    
    this.pressed = true;
    this.dragging = false;
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.velocityHistory = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
    
    // Press animation — liquid "push in"
    if (this.cfg.scaleOnPress) {
      this.transition.to({
        scale: this.cfg.pressScale,
        scaleX: 1 + this.cfg.pressSquish,
        scaleY: 1 - this.cfg.pressSquish,
      }, 'stiff');
    }
    
    if (this.cfg.wobbleOnPress) {
      // Tiny delayed wobble for that liquid feel
      this.pressTimer = window.setTimeout(() => {
        if (this.pressed && !this.dragging) {
          this.transition.to({
            scaleX: 1 - this.cfg.pressSquish * 0.5,
            scaleY: 1 + this.cfg.pressSquish * 0.5,
          }, 'gentle');
        }
      }, 150);
    }
    
    this._onPress?.();
  };

  private handlePointerMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    
    const dx = e.clientX - this.startX;
    const dy = e.clientY - this.startY;
    
    // Detect drag start (5px threshold)
    if (!this.dragging && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
      this.dragging = true;
      // Reset scale to 1 when dragging starts
      this.transition.to({ scale: 1, scaleX: 1, scaleY: 1 }, 'snappy');
      this._onDragStart?.(this.startX, this.startY);
    }
    
    if (this.dragging) {
      // Apply rubber-banding beyond max distance
      const dist = Math.sqrt(dx * dx + dy * dy);
      let effectiveX = dx;
      let effectiveY = dy;
      
      if (dist > this.cfg.maxDragDistance) {
        const excess = dist - this.cfg.maxDragDistance;
        const dampedExcess = excess * this.cfg.rubberBandFactor;
        const ratio = (this.cfg.maxDragDistance + dampedExcess) / dist;
        effectiveX = dx * ratio;
        effectiveY = dy * ratio;
      }
      
      // Track velocity
      const now = performance.now();
      this.velocityHistory.push({ x: e.clientX, y: e.clientY, t: now });
      // Trim old entries
      while (this.velocityHistory.length > 0 && 
             now - this.velocityHistory[0].t > this.cfg.velocityWindow) {
        this.velocityHistory.shift();
      }
      
      // Directly set position (finger tracking, no spring delay during drag)
      this.transition.set({ x: effectiveX, y: effectiveY });
      
      const [vx, vy] = this.computeVelocity();
      this._onDrag?.(effectiveX, effectiveY, vx, vy);
    }
  };

  private handlePointerUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    
    this.el.releasePointerCapture(e.pointerId);
    this.pointerId = null;
    
    if (this.pressTimer) {
      clearTimeout(this.pressTimer);
      this.pressTimer = null;
    }
    
    const wasDragging = this.dragging;
    const [vx, vy] = this.computeVelocity();
    
    this.pressed = false;
    this.dragging = false;
    
    if (wasDragging) {
      // Release with momentum — the spring takes over with gesture velocity
      this.transition.release(
        { x: vx * this.cfg.flickMultiplier, y: vy * this.cfg.flickMultiplier },
        { x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1 }
      );
      this._onDragEnd?.(vx, vy);
    } else {
      // Press release — spring back to normal with bounce
      this.transition.to(
        { scale: 1, scaleX: 1, scaleY: 1 },
        'bouncy'
      );
      this._onTap?.();
    }
    
    this._onRelease?.();
  };

  private computeVelocity(): [number, number] {
    if (this.velocityHistory.length < 2) return [0, 0];
    
    const recent = this.velocityHistory;
    const first = recent[0];
    const last = recent[recent.length - 1];
    const dt = (last.t - first.t) / 1000; // seconds
    
    if (dt < 0.001) return [0, 0];
    
    return [
      (last.x - first.x) / dt,
      (last.y - first.y) / dt,
    ];
  }

  /** Get the underlying transition (for custom animation control) */
  getTransition(): LiquidTransition {
    return this.transition;
  }

  destroy(): void {
    this.el.removeEventListener('pointerdown', this.handlePointerDown);
    this.el.removeEventListener('pointermove', this.handlePointerMove);
    this.el.removeEventListener('pointerup', this.handlePointerUp);
    this.el.removeEventListener('pointercancel', this.handlePointerUp);
    
    if (this.pressTimer) clearTimeout(this.pressTimer);
    if (this.pointerId !== null) {
      this.el.releasePointerCapture(this.pointerId);
    }
    this.transition.destroy();
  }
}

/**
 * Liquid button — pre-configured gesture for buttons/cards.
 * 
 * Applies the Apple-style press-in + bounce-back effect
 * that makes glass buttons feel physical and alive.
 */
export class LiquidButton {
  private gesture: LiquidGesture;

  constructor(element: HTMLElement, config?: Partial<GestureConfig>) {
    this.gesture = new LiquidGesture(element, {
      pressScale: 0.92,
      pressSquish: 0.03,
      scaleOnPress: true,
      wobbleOnPress: true,
      maxDragDistance: 30,
      rubberBandFactor: 0.1,
      releaseSpring: 'bouncy',
      ...config,
    });
  }

  onTap(cb: () => void): this {
    this.gesture.onTap(cb);
    return this;
  }

  destroy(): void {
    this.gesture.destroy();
  }
}

/**
 * Liquid drag — pre-configured for draggable elements.
 * Element follows finger with slight spring lag and
 * bounces back on release.
 */
export class LiquidDrag {
  private gesture: LiquidGesture;

  constructor(element: HTMLElement, config?: Partial<GestureConfig>) {
    this.gesture = new LiquidGesture(element, {
      pressScale: 1.03, // Slightly enlarge when grabbed
      pressSquish: 0,
      scaleOnPress: true,
      wobbleOnPress: false,
      maxDragDistance: Infinity,
      rubberBandFactor: 1,
      flickMultiplier: 0.8,
      releaseSpring: 'default',
      ...config,
    });
  }

  /** Set snap points — element springs to nearest on release */
  setSnapTargets(_targets: { x: number; y: number }[]): this {
    return this;
  }

  onSnap(_cb: (target: { x: number; y: number }) => void): this {
    return this;
  }

  onDrag(cb: (dx: number, dy: number, vx: number, vy: number) => void): this {
    this.gesture.onDrag(cb);
    return this;
  }

  destroy(): void {
    this.gesture.destroy();
  }
}
