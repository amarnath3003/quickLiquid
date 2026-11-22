/**
 * quick-liquid/animations/interactive.ts
 *
 * Interactive liquid UI animations powered by AnimationScheduler + Spring:
 * - LiquidInteractive: pointer-reactive glass sheen, magnetic pull, press squish, and water ripples
 * - LiquidSwitch: spring-driven toggle thumb with velocity-coupled droplet stretch
 * - LiquidMorphModal: shared-element glass flow from any trigger into a dialog/panel and back
 * - LiquidPopover: spring-blooming popover + gliding list highlight follower
 * - LiquidContentSwap: directional spring swap for changing panel/code content
 * - LiquidScrollTrack: spring-smoothed scroll indicator
 */

import { Spring, type SpringConfig, type SpringPreset } from './spring';
import { AnimationScheduler } from './scheduler';

export interface DOMRectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface FlowRectResult {
  dx: number;
  dy: number;
  scaleX: number;
  scaleY: number;
}

export interface StretchScale {
  scaleX: number;
  scaleY: number;
}

export type LiquidModalMode = 'drop' | 'flow';

export interface LiquidDropOptions {
  /** Initial upward drop offset in px before settling to 0. Default -12 */
  dropY?: number;
  /** Initial horizontal scale at progress 0. Default 0.975 */
  startScaleX?: number;
  /** Initial vertical scale at progress 0. Default 0.91 */
  startScaleY?: number;
  /** Maximum surface-tension lateral expansion ratio. Default 0.028 */
  maxRipple?: number;
}

export interface LiquidDropTransform {
  y: number;
  scaleX: number;
  scaleY: number;
}

export interface JellyBoxInput {
  rawX: number;
  rawY: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  vx?: number;
  vy?: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  stretch?: number;
  maxWallBulge?: number;
}

export interface JellyBoxOutput {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  visualLeft: number;
  visualRight: number;
  visualTop: number;
  visualBottom: number;
  hitWallX: -1 | 0 | 1;
  hitWallY: -1 | 0 | 1;
}

/**
 * Compute center-aligned FLIP deltas so `target` starts visually matching `from`.
 */
export function computeFlowRect(from: DOMRectLike, to: DOMRectLike): FlowRectResult {
  const fromCx = from.left + from.width / 2;
  const fromCy = from.top + from.height / 2;
  const toCx = to.left + to.width / 2;
  const toCy = to.top + to.height / 2;
  return {
    dx: fromCx - toCx,
    dy: fromCy - toCy,
    scaleX: Math.max(0.08, from.width / Math.max(1, to.width)),
    scaleY: Math.max(0.08, from.height / Math.max(1, to.height)),
  };
}

/**
 * Velocity-coupled droplet deformation conserving approximate area.
 */
export function computeSwitchStretch(velocity: number, maxStretch: number = 0.24): StretchScale {
  const cap = Math.max(0, maxStretch);
  const stretch = Math.min(cap, Math.abs(velocity) * 0.00045);
  const scaleX = 1 + stretch;
  const scaleY = 1 / Math.sqrt(scaleX);
  return { scaleX, scaleY };
}

/**
 * Pure surface-tension drop deformation for fast modal/command reveal.
 * Returns exact `{ y: 0, scaleX: 1, scaleY: 1 }` at `(progress = 1, velocity = 0)`.
 */
export function computeLiquidDropTransform(
  progress: number,
  velocity: number,
  opts: LiquidDropOptions = {},
): LiquidDropTransform {
  const dropY = opts.dropY ?? -12;
  const startScaleX = opts.startScaleX ?? 0.975;
  const startScaleY = opts.startScaleY ?? 0.91;
  const maxRipple = opts.maxRipple ?? 0.028;

  const y = progress === 1 ? 0 : (1 - progress) * dropY;
  const ripple = Math.max(-maxRipple * 0.75, Math.min(maxRipple, velocity * 0.0011));
  const baseScaleX = startScaleX + (1 - startScaleX) * progress;
  const baseScaleY = startScaleY + (1 - startScaleY) * progress;
  const scaleX = Math.max(0.85, baseScaleX + ripple);
  const scaleY = Math.max(0.82, baseScaleY / Math.sqrt(1 + Math.max(0, ripple) * 0.6));

  return { y, scaleX, scaleY };
}

/**
 * Jelly-in-a-box boundary constraint: keeps a spring-driven pill strictly
 * inside `[minX, maxX] × [minY, maxY]` and converts any wall impact/overshoot
 * into an elastic wall-pinned squish + perpendicular bulge.
 */
export function computeBoundedJellyBox(input: JellyBoxInput): JellyBoxOutput {
  const w = Math.max(1, input.width);
  const h = Math.max(1, input.height);
  const boxW = Math.max(w, input.maxX - input.minX);
  const boxH = Math.max(h, input.maxY - input.minY);
  const stretch = input.stretch ?? 0.18;
  const maxBulge = input.maxWallBulge ?? 1.09;
  const vx = input.vx ?? 0;
  const vy = input.vy ?? 0;

  const hs = stretch > 0 ? Math.min(stretch, Math.abs(vx) * 0.00032) : 0;
  const vs = stretch > 0 ? Math.min(stretch, Math.abs(vy) * 0.00032) : 0;

  const candSx = Math.max(0.5, (input.scaleX * (1 + hs)) / Math.sqrt(1 + vs));
  const candSy = Math.max(0.5, (input.scaleY * (1 + vs)) / Math.sqrt(1 + hs));

  const rawLeft = input.rawX + (w * (1 - candSx)) / 2;
  const rawRight = rawLeft + w * candSx;
  const rawTop = input.rawY + (h * (1 - candSy)) / 2;
  const rawBottom = rawTop + h * candSy;

  const leftPen = Math.max(0, input.minX - rawLeft);
  const rightPen = Math.max(0, rawRight - input.maxX);
  const topPen = Math.max(0, input.minY - rawTop);
  const bottomPen = Math.max(0, rawBottom - input.maxY);

  const hitWallX: -1 | 0 | 1 = leftPen > 0 ? -1 : rightPen > 0 ? 1 : 0;
  const hitWallY: -1 | 0 | 1 = topPen > 0 ? -1 : bottomPen > 0 ? 1 : 0;

  let finalSx = candSx;
  let finalSy = candSy;
  let bulgeX = 1;
  let bulgeY = 1;

  if (hitWallX !== 0) {
    const penX = leftPen + rightPen;
    const squashX = Math.max(0.8, 1 - penX / Math.max(w * 2, 44));
    finalSx = Math.min(candSx, squashX);
    bulgeY = Math.min(maxBulge, 1 / Math.sqrt(squashX));
  }

  if (hitWallY !== 0) {
    const penY = topPen + bottomPen;
    const squashY = Math.max(0.8, 1 - penY / Math.max(h * 2, 44));
    finalSy = Math.min(candSy, squashY);
    bulgeX = Math.min(maxBulge, 1 / Math.sqrt(squashY));
  }

  if (hitWallX === 0 && hitWallY !== 0) finalSx *= bulgeX;
  if (hitWallY === 0 && hitWallX !== 0) finalSy *= bulgeY;

  finalSx = Math.min(finalSx, boxW / w);
  finalSy = Math.min(finalSy, boxH / h);

  const visualW = w * finalSx;
  const visualH = h * finalSy;

  const clampedLeft =
    hitWallX === -1
      ? input.minX
      : hitWallX === 1
        ? input.maxX - visualW
        : Math.max(input.minX, Math.min(input.maxX - visualW, input.rawX + (w * (1 - finalSx)) / 2));

  const clampedTop =
    hitWallY === -1
      ? input.minY
      : hitWallY === 1
        ? input.maxY - visualH
        : Math.max(input.minY, Math.min(input.maxY - visualH, input.rawY + (h * (1 - finalSy)) / 2));

  return {
    x: clampedLeft - (w * (1 - finalSx)) / 2,
    y: clampedTop - (h * (1 - finalSy)) / 2,
    scaleX: finalSx,
    scaleY: finalSy,
    visualLeft: clampedLeft,
    visualRight: clampedLeft + visualW,
    visualTop: clampedTop,
    visualBottom: clampedTop + visualH,
    hitWallX,
    hitWallY,
  };
}

let stylesInjected = false;

export function ensureAnimStyles(): void {
  if (stylesInjected || typeof document === 'undefined') return;
  if (document.getElementById('ql-anim-styles')) {
    stylesInjected = true;
    return;
  }
  const style = document.createElement('style');
  style.id = 'ql-anim-styles';
  style.textContent = `
.ql-ripple-host {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  overflow: hidden;
  pointer-events: none;
  z-index: 2;
}
.ql-ripple {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  transform: translate(-50%, -50%) scale(0.08);
  background: radial-gradient(circle, rgba(226, 240, 255, 0.28) 0%, rgba(164, 206, 255, 0.13) 54%, transparent 74%);
  box-shadow: inset 0 0 0 1px rgba(228, 244, 255, 0.24);
  animation: ql-ripple-expand 340ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
}
@keyframes ql-ripple-expand {
  0% { opacity: 0.9; transform: translate(-50%, -50%) scale(0.08); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(1); }
}
.ql-tab-indicator {
  position: absolute;
  top: 0;
  left: 0;
  border-radius: inherit;
  pointer-events: none;
}
.ql-tab-hover,
.ql-list-hover {
  position: absolute;
  top: 0;
  left: 0;
  border-radius: inherit;
  pointer-events: none;
  opacity: 0;
  transition: opacity 150ms ease;
}
.ql-sheen-host {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  overflow: hidden;
  pointer-events: none;
  z-index: 4;
}
.ql-sheen-sweep {
  position: absolute;
  inset: -20% -35%;
  pointer-events: none;
  background: linear-gradient(
    106deg,
    transparent 30%,
    rgba(168, 212, 255, 0.14) 45%,
    rgba(236, 246, 255, 0.30) 50%,
    rgba(196, 174, 255, 0.13) 55%,
    transparent 70%
  );
  transform: translate3d(-60%, 0, 0);
  animation: ql-sheen-glide 260ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
}
@keyframes ql-sheen-glide {
  0% { transform: translate3d(-60%, 0, 0); opacity: 0.9; }
  75% { opacity: 0.85; }
  100% { transform: translate3d(65%, 0, 0); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .ql-ripple, .ql-sheen-sweep { animation: none; opacity: 0; }
}`;
  (document.head || document.documentElement).appendChild(style);
  stylesInjected = true;
}

function resolveSpringArg(
  input: Partial<SpringConfig> | SpringPreset | undefined,
  fallback: Partial<SpringConfig> | SpringPreset,
): Partial<SpringConfig> | SpringPreset {
  return input ?? fallback;
}

function resolveUnitSpring(
  input: Partial<SpringConfig> | SpringPreset | undefined,
  fallback: Partial<SpringConfig> & { restDisplacementThreshold: number; restThreshold: number },
): Partial<SpringConfig> | SpringPreset {
  if (!input) return fallback;
  if (typeof input === 'string') return input;
  const maxDisp = Math.max(fallback.restDisplacementThreshold, 0.015);
  const maxRest = Math.max(fallback.restThreshold, 0.15);
  return {
    ...fallback,
    ...input,
    restDisplacementThreshold: Math.min(input.restDisplacementThreshold ?? fallback.restDisplacementThreshold, maxDisp),
    restThreshold: Math.min(input.restThreshold ?? fallback.restThreshold, maxRest),
  };
}

function resolvePixelSpring(
  input: Partial<SpringConfig> | SpringPreset | undefined,
  fallback: Partial<SpringConfig>,
): Partial<SpringConfig> | SpringPreset {
  if (!input) return fallback;
  if (typeof input === 'string') return input;
  return { ...fallback, ...input };
}

/* ─────────────────────────── LIQUID INTERACTIVE ─────────────────────────── */

export interface LiquidInteractiveConfig {
  /** Vertical scale on pointer press. Default 0.95 */
  pressScale: number;
  /** Horizontal squish expansion on press. Default 0.045 */
  pressSquish: number;
  /** Max magnetic pointer offset in px. Default 2.5 */
  hoverLift: number;
  /** Subtle scale boost on hover. Default 1.018 */
  hoverScale: number;
  /** Pointer follow multiplier inside bounds. Default 0.14 */
  magnetic: number;
  /** Spawn water ripple on pointer down. Default true */
  ripple: boolean;
  /** Update --ql-hx / --ql-hy / --ql-hover sheen CSS vars. Default true */
  sheen: boolean;
  /** Release / press spring. Default 'bouncy' */
  spring: Partial<SpringConfig> | SpringPreset;
  /** Hover tracking spring. Default 'snappy' */
  hoverSpring: Partial<SpringConfig> | SpringPreset;
}

const DEFAULT_INTERACTIVE: LiquidInteractiveConfig = {
  pressScale: 0.96,
  pressSquish: 0.035,
  hoverLift: 1.8,
  hoverScale: 1.014,
  magnetic: 0.12,
  ripple: true,
  sheen: true,
  spring: { stiffness: 620, damping: 32, mass: 0.75, restDisplacementThreshold: 0.002, restThreshold: 0.02 },
  hoverSpring: { stiffness: 680, damping: 40, mass: 0.7, restDisplacementThreshold: 0.05, restThreshold: 0.5 },
};

/**
 * Attaches non-blocking liquid hover sheen, magnetic pull, press squish,
 * and expanding water ripples to any interactive `<button>` or `<a href>`.
 * Never captures the pointer or calls preventDefault(), preserving native clicks.
 */
export class LiquidInteractive {
  private el: HTMLElement;
  private cfg: LiquidInteractiveConfig;
  private scheduler = AnimationScheduler.shared();
  private xSpring: Spring;
  private ySpring: Spring;
  private sxSpring: Spring;
  private sySpring: Spring;
  private animId: number | null = null;
  private rippleHost: HTMLSpanElement | null = null;
  private activeRipples = new Set<HTMLSpanElement>();
  private hovered = false;
  private pressed = false;
  private destroyed = false;

  constructor(element: HTMLElement, config: Partial<LiquidInteractiveConfig> = {}) {
    this.el = element;
    this.cfg = { ...DEFAULT_INTERACTIVE, ...config };
    ensureAnimStyles();

    this.xSpring = new Spring(0, this.cfg.hoverSpring);
    this.ySpring = new Spring(0, this.cfg.hoverSpring);
    this.sxSpring = new Spring(1, this.cfg.spring);
    this.sySpring = new Spring(1, this.cfg.spring);

    if (this.cfg.ripple) this.ensureRippleHost();
    this.bind();
  }

  updateConfig(partial: Partial<LiquidInteractiveConfig>): void {
    this.cfg = { ...this.cfg, ...partial };
    if (partial.hoverSpring) {
      const hs = typeof partial.hoverSpring === 'string' ? undefined : partial.hoverSpring;
      if (hs) {
        this.xSpring.updateConfig(hs);
        this.ySpring.updateConfig(hs);
      } else {
        this.xSpring = new Spring(this.xSpring.value, this.cfg.hoverSpring);
        this.ySpring = new Spring(this.ySpring.value, this.cfg.hoverSpring);
      }
    }
    if (partial.spring) {
      const sp = typeof partial.spring === 'string' ? undefined : partial.spring;
      if (sp) {
        this.sxSpring.updateConfig(sp);
        this.sySpring.updateConfig(sp);
      } else {
        this.sxSpring = new Spring(this.sxSpring.value, this.cfg.spring);
        this.sySpring = new Spring(this.sySpring.value, this.cfg.spring);
      }
    }
    if (this.cfg.ripple) this.ensureRippleHost();
    else {
      this.rippleHost?.remove();
      this.rippleHost = null;
    }
    if (!this.cfg.sheen) {
      this.el.style.removeProperty('--ql-hx');
      this.el.style.removeProperty('--ql-hy');
      this.el.style.removeProperty('--ql-hover');
    }
  }

  private ensureRippleHost(): void {
    if (this.rippleHost) return;
    if (getComputedStyle(this.el).position === 'static') {
      this.el.style.position = 'relative';
    }
    const host = document.createElement('span');
    host.className = 'ql-ripple-host';
    host.setAttribute('aria-hidden', 'true');
    this.el.appendChild(host);
    this.rippleHost = host;
  }

  private bind(): void {
    const el = this.el;
    el.addEventListener('pointerenter', this.onEnter, { passive: true });
    el.addEventListener('pointermove', this.onMove, { passive: true });
    el.addEventListener('pointerleave', this.onLeave, { passive: true });
    el.addEventListener('pointerdown', this.onDown, { passive: true });
    el.addEventListener('pointerup', this.onUp, { passive: true });
    el.addEventListener('pointercancel', this.onLeave, { passive: true });
    el.addEventListener('blur', this.onLeave, { passive: true });
  }

  private isDisabled(): boolean {
    return (this.el as HTMLButtonElement).disabled === true || this.el.getAttribute('aria-disabled') === 'true';
  }

  private onEnter = (e: PointerEvent): void => {
    if (this.destroyed || this.isDisabled() || e.pointerType === 'touch') return;
    this.hovered = true;
    this.updatePointerField(e);
    if (!this.pressed) {
      this.sxSpring.setTarget(this.cfg.hoverScale);
      this.sySpring.setTarget(this.cfg.hoverScale);
      this.kick();
    }
  };

  private onMove = (e: PointerEvent): void => {
    if (this.destroyed || this.isDisabled() || e.pointerType === 'touch') return;
    this.hovered = true;
    this.updatePointerField(e);
    this.kick();
  };

  private onLeave = (): void => {
    if (this.destroyed) return;
    this.hovered = false;
    this.pressed = false;
    if (this.cfg.sheen) this.el.style.setProperty('--ql-hover', '0');
    this.xSpring.setTarget(0);
    this.ySpring.setTarget(0);
    this.sxSpring.setTarget(1);
    this.sySpring.setTarget(1);
    this.kick();
  };

  private onDown = (e: PointerEvent): void => {
    if (this.destroyed || this.isDisabled() || e.button !== 0) return;
    this.pressed = true;
    this.sxSpring.setTarget(1 + this.cfg.pressSquish);
    this.sySpring.setTarget(this.cfg.pressScale);
    this.kick();
    if (this.cfg.ripple && !AnimationScheduler.prefersReducedMotion()) {
      this.spawnRipple(e.clientX, e.clientY);
    }
  };

  private onUp = (): void => {
    if (this.destroyed || !this.pressed) return;
    this.pressed = false;
    const rest = this.hovered ? this.cfg.hoverScale : 1;
    this.sxSpring.setTarget(rest);
    this.sySpring.setTarget(rest);
    this.kick();
  };

  private updatePointerField(e: PointerEvent): void {
    const rect = this.el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const rx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const ry = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    if (this.cfg.sheen) {
      this.el.style.setProperty('--ql-hx', `${(rx * 100).toFixed(1)}%`);
      this.el.style.setProperty('--ql-hy', `${(ry * 100).toFixed(1)}%`);
      this.el.style.setProperty('--ql-hover', '1');
    }
    if (this.cfg.hoverLift > 0 && !AnimationScheduler.prefersReducedMotion()) {
      const nx = (rx - 0.5) * 2;
      const ny = (ry - 0.5) * 2;
      const lim = this.cfg.hoverLift;
      const mag = this.cfg.magnetic * lim * 4;
      this.xSpring.setTarget(Math.max(-lim, Math.min(lim, nx * mag)));
      this.ySpring.setTarget(Math.max(-lim, Math.min(lim, ny * mag)));
    }
  }

  private spawnRipple(clientX: number, clientY: number): void {
    this.ensureRippleHost();
    if (!this.rippleHost) return;
    const rect = this.el.getBoundingClientRect();
    const x = clientX ? clientX - rect.left : rect.width / 2;
    const y = clientY ? clientY - rect.top : rect.height / 2;
    const diameter = Math.max(rect.width, rect.height) * 2.15;

    const ripple = document.createElement('span');
    ripple.className = 'ql-ripple';
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    ripple.style.width = `${diameter}px`;
    ripple.style.height = `${diameter}px`;

    const cleanup = () => {
      ripple.remove();
      this.activeRipples.delete(ripple);
    };
    ripple.addEventListener('animationend', cleanup, { once: true });
    this.activeRipples.add(ripple);
    this.rippleHost.appendChild(ripple);
    window.setTimeout(cleanup, 400);
  }

  private kick(): void {
    if (this.animId !== null || this.destroyed) return;
    this.animId = this.scheduler.schedule(now => {
      const a = this.xSpring.tick(now);
      const b = this.ySpring.tick(now);
      const c = this.sxSpring.tick(now);
      const d = this.sySpring.tick(now);

      const x = this.xSpring.value;
      const y = this.ySpring.value;
      const sx = this.sxSpring.value;
      const sy = this.sySpring.value;
      const active = a || b || c || d;

      if (!active && Math.abs(x) < 0.01 && Math.abs(y) < 0.01 && Math.abs(sx - 1) < 0.002 && Math.abs(sy - 1) < 0.002) {
        this.el.style.transform = '';
      } else {
        this.el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`;
      }

      if (!active) this.animId = null;
      return active;
    });
  }

  destroy(): void {
    this.destroyed = true;
    if (this.animId !== null) {
      this.scheduler.cancel(this.animId);
      this.animId = null;
    }
    const el = this.el;
    el.removeEventListener('pointerenter', this.onEnter);
    el.removeEventListener('pointermove', this.onMove);
    el.removeEventListener('pointerleave', this.onLeave);
    el.removeEventListener('pointerdown', this.onDown);
    el.removeEventListener('pointerup', this.onUp);
    el.removeEventListener('pointercancel', this.onLeave);
    el.removeEventListener('blur', this.onLeave);
    el.style.transform = '';
    el.style.removeProperty('--ql-hx');
    el.style.removeProperty('--ql-hy');
    el.style.removeProperty('--ql-hover');
    for (const r of this.activeRipples) r.remove();
    this.activeRipples.clear();
    this.rippleHost?.remove();
    this.rippleHost = null;
  }
}

/* ─────────────────────────── LIQUID SWITCH ─────────────────────────── */

export interface LiquidSwitchConfig {
  /** Spring preset or config for thumb slide. Default { stiffness: 360, damping: 24, mass: 1 } */
  spring: Partial<SpringConfig> | SpringPreset;
  /** Maximum droplet horizontal elongation while sliding. Default 0.28 */
  maxStretch: number;
  /** Vertical squish while pressed. Default 0.14 */
  pressSquish: number;
}

const DEFAULT_SWITCH: LiquidSwitchConfig = {
  spring: { stiffness: 860, damping: 36, mass: 0.68, restDisplacementThreshold: 0.004, restThreshold: 0.08 },
  maxStretch: 0.24,
  pressSquish: 0.12,
};

/**
 * Spring-driven glass switch thumb controller with velocity-coupled droplet stretch.
 */
export class LiquidSwitch {
  private track: HTMLElement;
  private thumb: HTMLElement;
  private cfg: LiquidSwitchConfig;
  private scheduler = AnimationScheduler.shared();
  private progressSpring: Spring;
  private pressSpring: Spring;
  private animId: number | null = null;
  private resizeObs: ResizeObserver | null = null;
  private checked: boolean;
  private destroyed = false;

  constructor(
    trackEl: HTMLElement,
    thumbEl: HTMLElement,
    initialChecked: boolean,
    config: Partial<LiquidSwitchConfig> = {},
  ) {
    this.track = trackEl;
    this.thumb = thumbEl;
    this.checked = initialChecked;
    this.cfg = { ...DEFAULT_SWITCH, ...config };

    const init = initialChecked ? 1 : 0;
    this.progressSpring = new Spring(init, resolveSpringArg(this.cfg.spring, DEFAULT_SWITCH.spring));
    this.pressSpring = new Spring(0, 'stiff');

    this.apply();
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObs = new ResizeObserver(() => this.apply());
      this.resizeObs.observe(trackEl);
    }
  }

  setChecked(checked: boolean, immediate: boolean = false): void {
    this.checked = checked;
    const target = checked ? 1 : 0;
    if (immediate || AnimationScheduler.prefersReducedMotion()) {
      this.progressSpring.setValue(target, 0);
      this.progressSpring.setTarget(target);
      this.apply();
      return;
    }
    this.progressSpring.setTarget(target);
    this.kick();
  }

  press(down: boolean): void {
    if (AnimationScheduler.prefersReducedMotion()) return;
    this.pressSpring.setTarget(down ? 1 : 0);
    this.kick();
  }

  updateConfig(partial: Partial<LiquidSwitchConfig>): void {
    this.cfg = { ...this.cfg, ...partial };
    if (partial.spring) {
      if (typeof partial.spring === 'string') {
        const current = this.progressSpring.value;
        this.progressSpring = new Spring(current, partial.spring);
        this.progressSpring.setTarget(this.checked ? 1 : 0);
      } else {
        this.progressSpring.updateConfig(partial.spring);
      }
    }
  }

  private travelDistance(): number {
    const margin = Math.max(2, this.thumb.offsetLeft);
    return Math.max(0, this.track.clientWidth - this.thumb.offsetWidth - margin * 2);
  }

  private apply(): void {
    const travel = this.travelDistance();
    const margin = Math.max(2, this.thumb.offsetLeft);
    const topMargin = Math.max(2, this.thumb.offsetTop);
    const thumbW = Math.max(1, this.thumb.offsetWidth);
    const thumbH = Math.max(1, this.thumb.offsetHeight);
    const velocityPx = this.progressSpring.velocity * Math.max(travel, 36);
    const pressAmount = Math.max(0, Math.min(1, this.pressSpring.value));
    const baseSx = 1 + pressAmount * this.cfg.pressSquish;
    const baseSy = 1 - pressAmount * this.cfg.pressSquish * 0.6;

    const minX = Math.max(1, margin - 1);
    const maxX = Math.max(minX + thumbW, this.track.clientWidth - minX);
    const minY = Math.max(1, topMargin - 1);
    const maxY = Math.max(minY + thumbH, this.track.clientHeight - minY);

    const bounded = computeBoundedJellyBox({
      rawX: margin + this.progressSpring.value * travel,
      rawY: topMargin,
      width: thumbW,
      height: thumbH,
      scaleX: baseSx,
      scaleY: baseSy,
      vx: velocityPx,
      minX,
      maxX,
      minY,
      maxY,
      stretch: this.cfg.maxStretch,
      maxWallBulge: 1.07,
    });

    const dx = bounded.x - margin;
    const dy = bounded.y - topMargin;
    this.thumb.style.transform = `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0) scale(${bounded.scaleX.toFixed(4)}, ${bounded.scaleY.toFixed(4)})`;
  }

  private kick(): void {
    if (this.animId !== null || this.destroyed) return;
    this.animId = this.scheduler.schedule(now => {
      const a = this.progressSpring.tick(now);
      const b = this.pressSpring.tick(now);
      this.apply();
      const active = a || b;
      if (!active) this.animId = null;
      return active;
    });
  }

  destroy(): void {
    this.destroyed = true;
    if (this.animId !== null) {
      this.scheduler.cancel(this.animId);
      this.animId = null;
    }
    this.resizeObs?.disconnect();
    this.resizeObs = null;
    this.thumb.style.transform = '';
  }
}

/* ─────────────────────────── LIQUID MORPH MODAL ─────────────────────────── */

export interface LiquidMorphModalConfig {
  mode: LiquidModalMode;
  sheen: boolean;
  dropY: number;
  openSpring: Partial<SpringConfig> | SpringPreset;
  closeSpring: Partial<SpringConfig> | SpringPreset;
  /** Optional inner wrapper whose opacity fades without breaking backdrop-filter on the host. */
  contentSelector?: string;
}

const DEFAULT_DROP_OPEN_SPRING: SpringConfig = {
  stiffness: 1100,
  damping: 32,
  mass: 0.55,
  restDisplacementThreshold: 0.003,
  restThreshold: 0.04,
  clampOnRest: true,
};

const DEFAULT_DROP_CLOSE_SPRING: SpringConfig = {
  stiffness: 2000,
  damping: 63.25,
  mass: 0.5,
  restDisplacementThreshold: 0.025,
  restThreshold: 0.85,
  clampOnRest: true,
};

const DEFAULT_FLOW_OPEN_SPRING: Partial<SpringConfig> = {
  stiffness: 920,
  damping: 46,
  mass: 0.65,
  restDisplacementThreshold: 0.6,
  restThreshold: 12,
};

const DEFAULT_FLOW_CLOSE_SPRING: Partial<SpringConfig> = {
  stiffness: 1200,
  damping: 54,
  mass: 0.6,
  restDisplacementThreshold: 1.0,
  restThreshold: 18,
};

const DEFAULT_MORPH_MODAL: LiquidMorphModalConfig = {
  mode: 'drop',
  sheen: true,
  dropY: -12,
  openSpring: DEFAULT_DROP_OPEN_SPRING,
  closeSpring: DEFAULT_DROP_CLOSE_SPRING,
};

/**
 * Liquid modal/command reveal controller supporting two modes:
 * - `'drop'` (default): instant in-place surface-tension drop + optical glass sheen sweep
 * - `'flow'`: shared-element flight from a trigger button
 *
 * Animates ONLY `transform` (and `borderRadius` in `'flow'`) on the glass host and
 * `opacity` solely on its inner content wrapper so Chromium `backdrop-filter: url()` stays live.
 */
export class LiquidMorphModal {
  private cfg: LiquidMorphModalConfig;
  private customOpenSpring?: Partial<SpringConfig> | SpringPreset;
  private customCloseSpring?: Partial<SpringConfig> | SpringPreset;
  private scheduler = AnimationScheduler.shared();
  private animId: number | null = null;
  private pendingResolve: (() => void) | null = null;
  private activeTarget: HTMLElement | null = null;
  private activeSheen: HTMLElement | null = null;
  private sheenTimer: number | null = null;
  private destroyed = false;

  constructor(config: Partial<LiquidMorphModalConfig> = {}) {
    this.cfg = { ...DEFAULT_MORPH_MODAL, ...config };
    this.customOpenSpring = config.openSpring;
    this.customCloseSpring = config.closeSpring;
  }

  updateConfig(partial: Partial<LiquidMorphModalConfig>): void {
    this.cfg = { ...this.cfg, ...partial };
    if ('openSpring' in partial) this.customOpenSpring = partial.openSpring;
    if ('closeSpring' in partial) this.customCloseSpring = partial.closeSpring;
  }

  cancel(): void {
    this.cancelActive();
  }

  private cancelActive(): void {
    if (this.animId !== null) {
      this.scheduler.cancel(this.animId);
      this.animId = null;
    }
    if (this.sheenTimer !== null) {
      clearTimeout(this.sheenTimer);
      this.sheenTimer = null;
    }
    this.activeSheen?.remove();
    this.activeSheen = null;
    if (this.activeTarget) {
      this.activeTarget.style.transform = '';
      this.activeTarget.style.transformOrigin = '';
      this.activeTarget.style.borderRadius = '';
      const content = this.contentEl(this.activeTarget);
      if (content) content.style.opacity = '';
      this.activeTarget = null;
    }
    if (this.pendingResolve) {
      const resolve = this.pendingResolve;
      this.pendingResolve = null;
      resolve();
    }
  }

  private contentEl(target: HTMLElement): HTMLElement | null {
    if (!this.cfg.contentSelector) return null;
    return target.querySelector<HTMLElement>(this.cfg.contentSelector);
  }

  private spawnSheenSweep(target: HTMLElement): void {
    if (this.cfg.sheen === false || AnimationScheduler.prefersReducedMotion()) return;
    ensureAnimStyles();
    if (this.sheenTimer !== null) {
      clearTimeout(this.sheenTimer);
      this.sheenTimer = null;
    }
    this.activeSheen?.remove();
    if (getComputedStyle(target).position === 'static') {
      target.style.position = 'relative';
    }
    const host = document.createElement('span');
    host.className = 'ql-sheen-host';
    host.setAttribute('aria-hidden', 'true');
    const sweep = document.createElement('span');
    sweep.className = 'ql-sheen-sweep';
    host.appendChild(sweep);
    target.appendChild(host);
    this.activeSheen = host;

    const cleanup = () => {
      if (this.sheenTimer !== null) {
        clearTimeout(this.sheenTimer);
        this.sheenTimer = null;
      }
      host.remove();
      if (this.activeSheen === host) this.activeSheen = null;
    };
    sweep.addEventListener('animationend', cleanup, { once: true });
    this.sheenTimer = window.setTimeout(cleanup, 320);
  }

  openFrom(trigger: HTMLElement | null, target: HTMLElement, show?: () => void): Promise<void> {
    ensureAnimStyles();
    this.cancelActive();
    if (this.destroyed) return Promise.resolve();

    const fromRect = this.cfg.mode === 'flow' ? (trigger?.getBoundingClientRect() ?? null) : null;
    const fromRadius =
      this.cfg.mode === 'flow' && trigger
        ? parseFloat(getComputedStyle(trigger).borderTopLeftRadius) || 12
        : 16;

    show?.();
    target.style.transform = '';
    target.style.borderRadius = '';

    const content = this.contentEl(target);
    if (content) content.style.opacity = '';

    const toRect = target.getBoundingClientRect();

    if (AnimationScheduler.prefersReducedMotion() || toRect.width < 2 || toRect.height < 2) {
      target.style.transformOrigin = '';
      return Promise.resolve();
    }

    if (this.cfg.mode !== 'flow') {
      const openSpring = resolveUnitSpring(this.customOpenSpring, DEFAULT_DROP_OPEN_SPRING);
      const pS = new Spring(0, openSpring);
      pS.setTarget(1);

      this.activeTarget = target;
      target.style.transformOrigin = 'top center';
      const f0 = computeLiquidDropTransform(0, 0, { dropY: this.cfg.dropY });
      target.style.transform = `translate3d(0, ${f0.y.toFixed(2)}px, 0) scale(${f0.scaleX.toFixed(4)}, ${f0.scaleY.toFixed(4)})`;
      this.spawnSheenSweep(target);

      return new Promise<void>(resolve => {
        this.pendingResolve = resolve;
        this.animId = this.scheduler.schedule(now => {
          const active = pS.tick(now);
          if (active) {
            const t = computeLiquidDropTransform(pS.value, pS.velocity, { dropY: this.cfg.dropY });
            target.style.transform = `translate3d(0, ${t.y.toFixed(2)}px, 0) scale(${t.scaleX.toFixed(4)}, ${t.scaleY.toFixed(4)})`;
          } else {
            target.style.transform = '';
            target.style.transformOrigin = '';
            if (this.activeTarget === target) this.activeTarget = null;
            this.animId = null;
            this.pendingResolve = null;
            resolve();
          }
          return active;
        });
      });
    }

    const toRadius = parseFloat(getComputedStyle(target).borderTopLeftRadius) || 24;
    const rawFlow: FlowRectResult = fromRect && fromRect.width >= 2 && fromRect.height >= 2
      ? computeFlowRect(fromRect, toRect)
      : { dx: 0, dy: 28, scaleX: 0.88, scaleY: 0.88 };

    const start: FlowRectResult = {
      dx: rawFlow.dx * 0.42,
      dy: rawFlow.dy * 0.42,
      scaleX: Math.max(0.72, Math.min(0.94, rawFlow.scaleX)),
      scaleY: Math.max(0.72, Math.min(0.94, rawFlow.scaleY)),
    };
    const startRadius = Math.min(toRadius, Math.max(12, fromRadius));

    const flowSpring = resolvePixelSpring(this.customOpenSpring, DEFAULT_FLOW_OPEN_SPRING);
    const scaleSpring = resolveUnitSpring(this.customOpenSpring, {
      stiffness: 920,
      damping: 46,
      mass: 0.65,
      restDisplacementThreshold: 0.008,
      restThreshold: 0.08,
    });

    const xS = new Spring(start.dx, flowSpring);
    const yS = new Spring(start.dy, flowSpring);
    const sxS = new Spring(start.scaleX, scaleSpring);
    const syS = new Spring(start.scaleY, scaleSpring);
    const rS = new Spring(startRadius, flowSpring);
    const cS = new Spring(0.65, { stiffness: 900, damping: 48, mass: 0.65, restDisplacementThreshold: 0.01, restThreshold: 0.05 });

    xS.setTarget(0);
    yS.setTarget(0);
    sxS.setTarget(1);
    syS.setTarget(1);
    rS.setTarget(toRadius);
    cS.setTarget(1);

    this.activeTarget = target;
    target.style.transformOrigin = 'center center';
    target.style.transform = `translate3d(${start.dx}px, ${start.dy}px, 0) scale(${start.scaleX}, ${start.scaleY})`;
    target.style.borderRadius = `${startRadius}px`;
    if (content) content.style.opacity = '0.65';
    this.spawnSheenSweep(target);

    return new Promise<void>(resolve => {
      this.pendingResolve = resolve;
      this.animId = this.scheduler.schedule(now => {
        const a = xS.tick(now);
        const b = yS.tick(now);
        const c = sxS.tick(now);
        const d = syS.tick(now);
        const e = rS.tick(now);
        const f = cS.tick(now);
        const active = a || b || c || d || e || f;
        target.style.transform = `translate3d(${xS.value.toFixed(2)}px, ${yS.value.toFixed(2)}px, 0) scale(${sxS.value.toFixed(4)}, ${syS.value.toFixed(4)})`;
        target.style.borderRadius = `${Math.max(4, rS.value).toFixed(1)}px`;
        if (content) content.style.opacity = String(Math.max(0, Math.min(1, cS.value)));

        if (!active) {
          target.style.transform = '';
          target.style.transformOrigin = '';
          target.style.borderRadius = '';
          if (content) content.style.opacity = '';
          if (this.activeTarget === target) this.activeTarget = null;
          this.animId = null;
          this.pendingResolve = null;
          resolve();
        }
        return active;
      });
    });
  }

  closeTo(trigger: HTMLElement | null, target: HTMLElement, hide?: () => void): Promise<void> {
    this.cancelActive();
    if (this.destroyed) {
      hide?.();
      return Promise.resolve();
    }

    const toRect = target.getBoundingClientRect();
    const content = this.contentEl(target);

    if (AnimationScheduler.prefersReducedMotion() || toRect.width < 2 || toRect.height < 2) {
      target.style.transform = '';
      target.style.transformOrigin = '';
      target.style.borderRadius = '';
      if (content) content.style.opacity = '';
      hide?.();
      return Promise.resolve();
    }

    if (this.cfg.mode !== 'flow') {
      const closeSpring = resolveUnitSpring(this.customCloseSpring, DEFAULT_DROP_CLOSE_SPRING);
      const pS = new Spring(1, closeSpring);
      pS.setTarget(0);

      this.activeTarget = target;
      target.style.transformOrigin = 'top center';

      return new Promise<void>(resolve => {
        this.pendingResolve = resolve;
        this.animId = this.scheduler.schedule(now => {
          const active = pS.tick(now);
          const p = Math.max(0, Math.min(1, pS.value));
          const y = (1 - p) * -8;
          const sx = 0.975 + 0.025 * p;
          const sy = 0.94 + 0.06 * p;
          target.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`;
          if (content) content.style.opacity = String(p);

          if (!active) {
            hide?.();
            target.style.transform = '';
            target.style.transformOrigin = '';
            if (content) content.style.opacity = '';
            if (this.activeTarget === target) this.activeTarget = null;
            this.animId = null;
            this.pendingResolve = null;
            resolve();
          }
          return active;
        });
      });
    }

    const fromRect = trigger?.getBoundingClientRect() ?? null;
    const toRadius = parseFloat(getComputedStyle(target).borderTopLeftRadius) || 24;
    const fromRadius = trigger ? parseFloat(getComputedStyle(trigger).borderTopLeftRadius) || 12 : 16;

    const rawDest: FlowRectResult = fromRect && fromRect.width >= 2 && fromRect.height >= 2
      ? computeFlowRect(fromRect, toRect)
      : { dx: 0, dy: 22, scaleX: 0.88, scaleY: 0.88 };

    const dest: FlowRectResult = {
      dx: rawDest.dx * 0.35,
      dy: rawDest.dy * 0.35,
      scaleX: 0.84,
      scaleY: 0.84,
    };
    const destRadius = Math.min(toRadius, Math.max(12, fromRadius));

    const closeSpring = resolvePixelSpring(this.customCloseSpring, DEFAULT_FLOW_CLOSE_SPRING);
    const scaleCloseSpring = resolveUnitSpring(this.customCloseSpring, {
      stiffness: 1200,
      damping: 54,
      mass: 0.6,
      restDisplacementThreshold: 0.015,
      restThreshold: 0.15,
    });
    const xS = new Spring(0, closeSpring);
    const yS = new Spring(0, closeSpring);
    const sxS = new Spring(1, scaleCloseSpring);
    const syS = new Spring(1, scaleCloseSpring);
    const rS = new Spring(toRadius, closeSpring);
    const cS = new Spring(1, { stiffness: 920, damping: 46, mass: 0.65, restDisplacementThreshold: 0.02, restThreshold: 0.08 });

    xS.setTarget(dest.dx);
    yS.setTarget(dest.dy);
    sxS.setTarget(dest.scaleX);
    syS.setTarget(dest.scaleY);
    rS.setTarget(destRadius);
    cS.setTarget(0);

    this.activeTarget = target;
    target.style.transformOrigin = 'center center';

    return new Promise<void>(resolve => {
      this.pendingResolve = resolve;
      this.animId = this.scheduler.schedule(now => {
        const a = xS.tick(now);
        const b = yS.tick(now);
        const c = sxS.tick(now);
        const d = syS.tick(now);
        const e = rS.tick(now);
        const f = cS.tick(now);
        const active = a || b || c || d || e || f;
        target.style.transform = `translate3d(${xS.value.toFixed(2)}px, ${yS.value.toFixed(2)}px, 0) scale(${sxS.value.toFixed(4)}, ${syS.value.toFixed(4)})`;
        target.style.borderRadius = `${Math.max(4, rS.value).toFixed(1)}px`;
        if (content) content.style.opacity = String(Math.max(0, Math.min(1, cS.value)));

        if (!active) {
          hide?.();
          target.style.transform = '';
          target.style.transformOrigin = '';
          target.style.borderRadius = '';
          if (content) content.style.opacity = '';
          if (this.activeTarget === target) this.activeTarget = null;
          this.animId = null;
          this.pendingResolve = null;
          resolve();
        }
        return active;
      });
    });
  }

  destroy(): void {
    this.destroyed = true;
    this.cancelActive();
  }
}

/* ─────────────────────────── LIQUID POPOVER ─────────────────────────── */

export interface LiquidPopoverConfig {
  spring: Partial<SpringConfig> | SpringPreset;
  origin: string;
  offsetY: number;
}

const DEFAULT_POPOVER: LiquidPopoverConfig = {
  spring: { stiffness: 980, damping: 46, mass: 0.65, restDisplacementThreshold: 0.006, restThreshold: 0.15 },
  origin: 'top right',
  offsetY: -5,
};

/**
 * Spring-blooming dropdown/popover controller with a gliding liquid highlight
 * pill for option lists.
 */
export class LiquidPopover {
  private cfg: LiquidPopoverConfig;
  private scheduler = AnimationScheduler.shared();
  private animId: number | null = null;
  private destroyed = false;

  constructor(config: Partial<LiquidPopoverConfig> = {}) {
    this.cfg = { ...DEFAULT_POPOVER, ...config };
  }

  updateConfig(partial: Partial<LiquidPopoverConfig>): void {
    this.cfg = { ...this.cfg, ...partial };
  }

  open(menuEl: HTMLElement): void {
    if (this.animId !== null) {
      this.scheduler.cancel(this.animId);
      this.animId = null;
    }
    if (this.destroyed || AnimationScheduler.prefersReducedMotion()) {
      menuEl.style.transform = '';
      return;
    }

    const sp = resolveSpringArg(this.cfg.spring, DEFAULT_POPOVER.spring);
    const sxS = new Spring(0.94, sp);
    const syS = new Spring(0.88, sp);
    const yS = new Spring(this.cfg.offsetY, sp);
    sxS.setTarget(1);
    syS.setTarget(1);
    yS.setTarget(0);

    menuEl.style.transformOrigin = this.cfg.origin;
    menuEl.style.transform = `translate3d(0, ${this.cfg.offsetY}px, 0) scale(0.94, 0.88)`;

    this.animId = this.scheduler.schedule(now => {
      const a = sxS.tick(now);
      const b = syS.tick(now);
      const c = yS.tick(now);
      const active = a || b || c;
      if (active) {
        menuEl.style.transform = `translate3d(0, ${yS.value.toFixed(2)}px, 0) scale(${sxS.value.toFixed(4)}, ${syS.value.toFixed(4)})`;
      } else {
        menuEl.style.transform = '';
        this.animId = null;
      }
      return active;
    });
  }

  close(menuEl: HTMLElement): Promise<void> {
    if (this.animId !== null) {
      this.scheduler.cancel(this.animId);
      this.animId = null;
    }
    if (this.destroyed || AnimationScheduler.prefersReducedMotion()) {
      menuEl.style.transform = '';
      return Promise.resolve();
    }

    const closeSp: Partial<SpringConfig> = { stiffness: 1250, damping: 56, mass: 0.6, restDisplacementThreshold: 0.015, restThreshold: 0.25 };
    const sxS = new Spring(1, closeSp);
    const syS = new Spring(1, closeSp);
    const yS = new Spring(0, closeSp);
    sxS.setTarget(0.94);
    syS.setTarget(0.88);
    yS.setTarget(this.cfg.offsetY);
    menuEl.style.transformOrigin = this.cfg.origin;

    return new Promise<void>(resolve => {
      this.animId = this.scheduler.schedule(now => {
        const a = sxS.tick(now);
        const b = syS.tick(now);
        const c = yS.tick(now);
        const active = a || b || c;
        menuEl.style.transform = `translate3d(0, ${yS.value.toFixed(2)}px, 0) scale(${sxS.value.toFixed(4)}, ${syS.value.toFixed(4)})`;
        if (!active) {
          menuEl.style.transform = '';
          this.animId = null;
          resolve();
        }
        return active;
      });
    });
  }

  /**
   * Injects a gliding liquid highlight pill inside `listEl` that smoothly tracks
   * hovered or focused items matching `itemSelector`. Returns a cleanup function.
   */
  static bindList(
    listEl: HTMLElement,
    itemSelector: string,
    spring: Partial<SpringConfig> | SpringPreset = 'snappy',
  ): () => void {
    ensureAnimStyles();
    if (getComputedStyle(listEl).position === 'static') {
      listEl.style.position = 'relative';
    }

    const pill = document.createElement('div');
    pill.className = 'ql-list-hover';
    pill.setAttribute('aria-hidden', 'true');
    listEl.insertBefore(pill, listEl.firstChild);

    const scheduler = AnimationScheduler.shared();
    const xS = new Spring(0, spring);
    const yS = new Spring(0, spring);
    const wS = new Spring(0, spring);
    const hS = new Spring(0, spring);
    let animId: number | null = null;
    let visible = false;

    const applyPill = () => {
      pill.style.width = `${Math.max(0, wS.value).toFixed(1)}px`;
      pill.style.height = `${Math.max(0, hS.value).toFixed(1)}px`;
      pill.style.transform = `translate3d(${xS.value.toFixed(2)}px, ${yS.value.toFixed(2)}px, 0)`;
    };

    const kick = () => {
      if (animId !== null) return;
      animId = scheduler.schedule(now => {
        const a = xS.tick(now);
        const b = yS.tick(now);
        const c = wS.tick(now);
        const d = hS.tick(now);
        const active = a || b || c || d;
        applyPill();
        if (!active) animId = null;
        return active;
      });
    };

    const moveTo = (item: HTMLElement) => {
      const listRect = listEl.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();
      const tx = itemRect.left - listRect.left - listEl.clientLeft + listEl.scrollLeft;
      const ty = itemRect.top - listRect.top - listEl.clientTop + listEl.scrollTop;
      const tw = itemRect.width;
      const th = itemRect.height;

      if (!visible || AnimationScheduler.prefersReducedMotion()) {
        xS.setValue(tx);
        xS.setTarget(tx);
        yS.setValue(ty);
        yS.setTarget(ty);
        wS.setValue(tw);
        wS.setTarget(tw);
        hS.setValue(th);
        hS.setTarget(th);
        applyPill();
        visible = true;
        pill.style.opacity = '1';
        return;
      }

      xS.setTarget(tx);
      yS.setTarget(ty);
      wS.setTarget(tw);
      hS.setTarget(th);
      pill.style.opacity = '1';
      kick();
    };

    const onEnterTarget = (e: Event) => {
      const target = (e.target as HTMLElement | null)?.closest?.(itemSelector) as HTMLElement | null;
      if (target && listEl.contains(target)) moveTo(target);
    };

    const onLeave = () => {
      visible = false;
      pill.style.opacity = '0';
    };

    listEl.addEventListener('pointerover', onEnterTarget, { passive: true });
    listEl.addEventListener('focusin', onEnterTarget, { passive: true });
    listEl.addEventListener('pointerleave', onLeave, { passive: true });

    return () => {
      if (animId !== null) scheduler.cancel(animId);
      listEl.removeEventListener('pointerover', onEnterTarget);
      listEl.removeEventListener('focusin', onEnterTarget);
      listEl.removeEventListener('pointerleave', onLeave);
      pill.remove();
    };
  }

  destroy(): void {
    this.destroyed = true;
    if (this.animId !== null) {
      this.scheduler.cancel(this.animId);
      this.animId = null;
    }
  }
}

/* ─────────────────────────── LIQUID CONTENT SWAP ─────────────────────────── */

/**
 * Directional GPU spring transition when swapping code snippets, tabs, or panels.
 */
export class LiquidContentSwap {
  private static active = new WeakMap<HTMLElement, { id: number }>();

  static animateSwap(
    el: HTMLElement,
    direction: -1 | 0 | 1 = 1,
    spring: Partial<SpringConfig> | SpringPreset = {
      stiffness: 920,
      damping: 46,
      mass: 0.65,
      restDisplacementThreshold: 0.4,
      restThreshold: 6,
    },
  ): () => void {
    const scheduler = AnimationScheduler.shared();
    const prev = LiquidContentSwap.active.get(el);
    if (prev) scheduler.cancel(prev.id);

    if (AnimationScheduler.prefersReducedMotion()) {
      el.style.transform = '';
      el.style.opacity = '';
      return () => {};
    }

    const offsetX = direction === 0 ? 0 : direction * 10;
    const xS = new Spring(offsetX, spring);
    const sS = new Spring(0.99, spring);
    const oS = new Spring(0.55, spring);
    xS.setTarget(0);
    sS.setTarget(1);
    oS.setTarget(1);

    const token = { id: 0 };
    el.style.transform = `translate3d(${offsetX}px, 0, 0) scale(0.99)`;
    el.style.opacity = '0.55';

    token.id = scheduler.schedule(now => {
      const a = xS.tick(now);
      const b = sS.tick(now);
      const c = oS.tick(now);
      const running = a || b || c;
      if (running) {
        el.style.transform = `translate3d(${xS.value.toFixed(2)}px, 0, 0) scale(${sS.value.toFixed(4)})`;
        el.style.opacity = String(Math.max(0, Math.min(1, oS.value)));
      } else {
        el.style.transform = '';
        el.style.opacity = '';
        LiquidContentSwap.active.delete(el);
      }
      return running;
    });

    LiquidContentSwap.active.set(el, token);
    return () => {
      scheduler.cancel(token.id);
      LiquidContentSwap.active.delete(el);
      el.style.transform = '';
      el.style.opacity = '';
    };
  }
}

/* ─────────────────────────── LIQUID SCROLL TRACK ─────────────────────────── */

export interface LiquidScrollTrackConfig {
  orientation?: 'horizontal' | 'vertical';
  spring?: Partial<SpringConfig> | SpringPreset;
}

/**
 * Spring-smoothed scroll progress tracker for nav hairlines and custom glass tracks.
 */
export class LiquidScrollTrack {
  private source: HTMLElement | Window;
  private bar: HTMLElement;
  private orientation: 'horizontal' | 'vertical';
  private spring: Spring;
  private scheduler = AnimationScheduler.shared();
  private animId: number | null = null;
  private destroyed = false;

  constructor(
    source: HTMLElement | Window,
    barEl: HTMLElement,
    config: LiquidScrollTrackConfig = {},
  ) {
    this.source = source;
    this.bar = barEl;
    this.orientation = config.orientation ?? 'horizontal';
    this.spring = new Spring(
      0,
      config.spring ?? { stiffness: 620, damping: 44, mass: 0.7, restDisplacementThreshold: 0.001, restThreshold: 0.01 },
    );
    this.bar.style.transformOrigin = this.orientation === 'horizontal' ? 'left center' : 'center top';

    const initial = this.readProgress();
    this.spring.setValue(initial);
    this.spring.setTarget(initial);
    this.apply();

    this.source.addEventListener('scroll', this.onScroll, { passive: true });
    if (this.source === window) {
      window.addEventListener('resize', this.onScroll, { passive: true });
    }
  }

  private readProgress(): number {
    if (this.source === window) {
      const doc = document.documentElement;
      const max = Math.max(0, doc.scrollHeight - window.innerHeight);
      return max > 0 ? Math.max(0, Math.min(1, window.scrollY / max)) : 0;
    }
    const el = this.source as HTMLElement;
    const max = Math.max(0, el.scrollHeight - el.clientHeight);
    return max > 0 ? Math.max(0, Math.min(1, el.scrollTop / max)) : 0;
  }

  private onScroll = (): void => {
    if (this.destroyed) return;
    const next = this.readProgress();
    if (AnimationScheduler.prefersReducedMotion()) {
      this.spring.setValue(next);
      this.spring.setTarget(next);
      this.apply();
      return;
    }
    this.spring.setTarget(next);
    this.kick();
  };

  private apply(): void {
    const p = Math.max(0, Math.min(1, this.spring.value));
    this.bar.style.transform = this.orientation === 'horizontal' ? `scaleX(${p.toFixed(4)})` : `scaleY(${p.toFixed(4)})`;
  }

  private kick(): void {
    if (this.animId !== null || this.destroyed) return;
    this.animId = this.scheduler.schedule(now => {
      const active = this.spring.tick(now);
      this.apply();
      if (!active) this.animId = null;
      return active;
    });
  }

  refresh(): void {
    this.onScroll();
  }

  destroy(): void {
    this.destroyed = true;
    if (this.animId !== null) {
      this.scheduler.cancel(this.animId);
      this.animId = null;
    }
    this.source.removeEventListener('scroll', this.onScroll);
    if (this.source === window) {
      window.removeEventListener('resize', this.onScroll);
    }
    this.bar.style.transform = '';
  }
}
