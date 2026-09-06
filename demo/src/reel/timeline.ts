/**
 * timeline.ts — the film clock for the QuickLiquid intro.
 *
 * Every visual in the reel is a PURE FUNCTION of `t` (milliseconds). Nothing
 * integrates, nothing accumulates, nothing depends on frame delta. That buys
 * three things at once:
 *
 *   1. scrubbing — drag the transport bar and the whole scene, backdrop CSS
 *      animations included, lands exactly where it should;
 *   2. recording — a capture script can step t in fixed increments and get a
 *      perfect 60fps sequence with no dropped or duplicated frames;
 *   3. review — you can read the shot list below and know what the film does.
 *
 * The backdrop's CSS animations stay deterministic too: they are permanently
 * `animation-play-state: paused` and offset with `animation-delay: -t ms`, so
 * they render at exactly time t rather than free-running on wall clock.
 */

/* ─────────────────────────── shot list ─────────────────────────── */

export interface Beat {
  a: number;
  b: number;
}

const beat = (a: number, b: number): Beat => ({ a, b });

export const BEATS = {
  /** Black. A point of light flares and a wave of colour floods the frame. */
  ignite: beat(0, 1300),
  /** Five droplets of glass rain down onto the light seam, each with a ripple. */
  rain: beat(1300, 3100),
  /** They slide together into a row, then fuse into one bar in a single snap. */
  fuse: beat(3100, 4900),
  /** The bar winds back, then crosses frame developing the wordmark. */
  title: beat(4900, 7300),
  /** The lockup resolves: title up, install pill, and a glass dock. */
  settle: beat(7300, 9400),
  /** A light bar rakes across; every surface refracts it at once. */
  flare: beat(9400, 10800),
  /** The end composition breathes and holds. */
  hold: beat(10800, 12600),
} as const;

export type BeatName = keyof typeof BEATS;

export const DURATION = 12600;

/** Human-readable label for whatever is on screen at t — used by the transport bar. */
export function beatAt(t: number): BeatName {
  let current: BeatName = 'ignite';
  for (const name of Object.keys(BEATS) as BeatName[]) {
    if (t >= BEATS[name].a) current = name;
  }
  return current;
}

/* ─────────────────────────── math ─────────────────────────── */

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

export const lerp = (from: number, to: number, p: number): number => from + (to - from) * p;

/** Progress of t through the window [a, b], clamped to 0..1. */
export const inv = (t: number, a: number, b: number): number => clamp01((t - a) / (b - a || 1));

/** 0 → 1 → 0 over the window. Good for blooms and one-shot flashes. */
export const pulse = (p: number): number => Math.sin(clamp01(p) * Math.PI);

export const smoothstep = (p: number): number => p * p * (3 - 2 * p);
export const easeOutCubic = (p: number): number => 1 - Math.pow(1 - p, 3);
export const easeInOutCubic = (p: number): number =>
  p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
export const easeOutExpo = (p: number): number => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p));
/** Gravity. Things that fall accelerate; they do not ease out on the way down. */
export const easeInQuad = (p: number): number => p * p;
export const easeInOutSine = (p: number): number => -(Math.cos(Math.PI * p) - 1) / 2;
export const easeInCubic = (p: number): number => p * p * p;

/**
 * A struck accent that decays: 1 at `at`, falling to 0 over `dur`.
 *
 * Impacts are what give a film rhythm. Flashes, screen-shake and ring-downs all
 * hang off this, so every hit in the reel decays on the same curve.
 */
export function spike(t: number, at: number, dur: number, power = 3): number {
  if (t < at) return 0;
  return Math.pow(1 - inv(t, at, at + dur), power);
}

/** A struck accent that also oscillates — squash that rings down. */
export function ring(t: number, at: number, dur: number, cycles = 3.4, decay = 5.5): number {
  if (t < at) return 0;
  const u = inv(t, at, at + dur);
  return Math.exp(-decay * u) * Math.cos(u * Math.PI * cycles);
}

/**
 * Closed-form underdamped spring, 0 → 1 over a normalized window.
 *
 * The library ships a real integrating `Spring` for interaction; a film needs
 * the analytic form instead so that frame N always looks the same no matter
 * how it was reached.
 *
 *   x(p) = 1 − e^(−ζωp)·(cos(ω_d·p) + (ζω/ω_d)·sin(ω_d·p))
 */
export function spring(p: number, freq = 1.1, damping = 0.55): number {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  const w = freq * Math.PI * 2;
  const z = clamp01(damping);
  const wd = w * Math.sqrt(Math.max(1e-6, 1 - z * z));
  return 1 - Math.exp(-z * w * p) * (Math.cos(wd * p) + ((z * w) / wd) * Math.sin(wd * p));
}

/** Interpolate `from` → `to` across the window [a, b] of the film clock. */
export function seg(
  t: number,
  a: number,
  b: number,
  from: number,
  to: number,
  ease: (p: number) => number = smoothstep,
): number {
  return lerp(from, to, ease(inv(t, a, b)));
}

/**
 * Quantize to a step.
 *
 * Layout-affecting values (glass width/height/radius) and engine config values
 * are snapped before they reach the engine. A displacement map is cached by
 * geometry, so a value that changes every single frame would rebuild the map
 * ~60×/second and blow out the cache; a 4px step is invisible in motion and
 * cuts that to a handful of rebuilds per shot.
 */
export const q = (value: number, step: number): number => Math.round(value / step) * step;

export const formatTime = (ms: number): string => (ms / 1000).toFixed(2).padStart(5, '0') + 's';
