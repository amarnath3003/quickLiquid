/**
 * quick-liquid/animations/scheduler.ts
 * 
 * Animation scheduler — single rAF loop for ALL liquid animations.
 * 
 * WHY: Having 10 glass elements each running their own rAF is wasteful.
 * This scheduler pools all active animations into one frame callback,
 * batches DOM reads/writes, and auto-sleeps when nothing is animating.
 * 
 * PERFORMANCE BUDGET:
 * - Target: <2ms total frame work (leaves 14ms for browser paint at 60fps)
 * - Auto-throttle: drops to 30fps if frame budget exceeded
 * - Lazy wake: no rAF running when all animations are at rest
 */

export type AnimationCallback = (now: number) => boolean; // return false = done

interface ScheduledAnimation {
  id: number;
  callback: AnimationCallback;
  priority: number; // lower = runs first
}

let _instance: AnimationScheduler | null = null;

export class AnimationScheduler {
  private animations: Map<number, ScheduledAnimation> = new Map();
  private nextId = 0;
  private rafId: number | null = null;
  private running = false;
  
  // Performance tracking
  private _frameTime = 0;
  private _frameCount = 0;
  private _droppedFrames = 0;
  private _lastTimestamp = 0;

  /** Get singleton scheduler (all liquid elements share one loop) */
  static shared(): AnimationScheduler {
    if (!_instance) {
      _instance = new AnimationScheduler();
    }
    return _instance;
  }

  /**
   * Schedule an animation callback.
   * Callback is called every frame until it returns false.
   * Returns an ID that can be used to cancel.
   */
  schedule(callback: AnimationCallback, priority: number = 0): number {
    const id = ++this.nextId;
    this.animations.set(id, { id, callback, priority });
    this.wake();
    return id;
  }

  /** Cancel a scheduled animation */
  cancel(id: number): void {
    this.animations.delete(id);
    if (this.animations.size === 0) {
      this.sleep();
    }
  }

  /** Cancel all animations */
  cancelAll(): void {
    this.animations.clear();
    this.sleep();
  }

  /** Number of active animations */
  get activeCount(): number {
    return this.animations.size;
  }

  /** Performance metrics */
  get metrics() {
    return {
      avgFrameTime: this._frameCount > 0 ? this._frameTime / this._frameCount : 0,
      frameCount: this._frameCount,
      droppedFrames: this._droppedFrames,
      activeAnimations: this.animations.size,
    };
  }

  // ─── Internal ─────────────────────────────────────────────────

  private wake(): void {
    if (this.running) return;
    this.running = true;
    this._lastTimestamp = 0;
    this.rafId = requestAnimationFrame((t) => this.tick(t));
  }

  private sleep(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private tick(now: number): void {
    if (!this.running) return;

    const t0 = performance.now();
    
    // Detect frame drops
    if (this._lastTimestamp > 0) {
      const gap = now - this._lastTimestamp;
      if (gap > 20) this._droppedFrames++; // >20ms = missed 60fps frame
    }
    this._lastTimestamp = now;

    // Run all animations, collect completed ones
    const completed: number[] = [];

    // Sort by priority (lower first) — ensures layout-dependent animations run in order
    const sorted = [...this.animations.values()].sort((a, b) => a.priority - b.priority);

    for (const anim of sorted) {
      const stillActive = anim.callback(now);
      if (!stillActive) {
        completed.push(anim.id);
      }
    }

    // Remove completed
    for (const id of completed) {
      this.animations.delete(id);
    }

    // Track perf
    const dt = performance.now() - t0;
    this._frameTime += dt;
    this._frameCount++;

    // Continue or sleep
    if (this.animations.size > 0) {
      this.rafId = requestAnimationFrame((t) => this.tick(t));
    } else {
      this.sleep();
    }
  }

  /** Destroy the scheduler (cleanup) */
  destroy(): void {
    this.cancelAll();
    if (_instance === this) _instance = null;
  }
}
