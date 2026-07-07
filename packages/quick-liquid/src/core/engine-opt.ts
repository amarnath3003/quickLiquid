/**
 * quick-liquid/core/engine-opt.ts — LIQUID GLASS ENGINE v8 (optimized candidate)
 *
 * Same optics model and public API as ./engine.ts (v7). What changes is the
 * PER-FRAME cost — every transform is derived, with error bounds, in
 * ../../OPTIMIZATION.md. Cross-references below use its section numbers:
 *
 *   [§1] Perceptual CA gating: the chromatic-aberration sub-graph is built
 *        only when its fringe survives the appended frost blur
 *        (split = 0.24·ca·S ≥ 0.35·σ). Frosted materials collapse from
 *        9 filter primitives / 3 displacement taps to 2 / 1.
 *   [§2] Fringe algebra: when CA is visible, the red channel is a linear
 *        extrapolation of the green/blue taps (λ = 5/7), so dispersion needs
 *        2 displacement taps instead of 3. `caMode: 'exact'` restores v7's
 *        3-tap graph bit-for-bit for A/B comparison.
 *   [§3] Filter region: pad follows the blur (⌈2.5σ⌉+2, bucketed), not the
 *        refraction strength; the map carries a baked neutral border so the
 *        pad ring displaces by exactly zero (fixes v7's shifted-ring +
 *        under-padded-blur edge artifacts).
 *   [§4] The two-lobe rim/sheen light is rotation-equivariant: baked once
 *        into oversized child disks, animated with compositor-only
 *        transform: rotate(). No per-frame gradient rebuilds, no per-frame
 *        blur(3px) (2° stops make it unnecessary).
 *   [§5] Tint gradient folds into the lens element's own background
 *        (pixel-exact compositing identity); noise layer is lazy.
 *   [§6] Map cell size from sampling theory (c = min(1.5, B/10) at high) and
 *        4-px element-size quantization of the map cache key.
 *
 * Chromium quirk workarounds from v7 are preserved verbatim: no z-index on
 *  glass layers, fresh lens node whenever the url() reference changes, no
 * isolation/filter/opacity/mask on the host.
 */

import {
  DEFAULT_CONFIG,
  MATERIAL_PRESETS,
  type LiquidGlassConfig,
} from './engine';

export interface LiquidGlassOptConfig extends LiquidGlassConfig {
  /** 'fast' = 2-tap fringe-algebra CA [§2]; 'exact' = v7 3-tap graph. */
  caMode?: 'fast' | 'exact';
  /** Perceptual gates [§1]. Set false to force v7 behavior. */
  autoGate?: boolean;
  /** Map cell size override in CSS px (lower = denser map) [§6]. */
  mapDensity?: number;
}

const OPT_DEFAULTS: Required<Pick<LiquidGlassOptConfig, 'caMode' | 'autoGate'>> = {
  caMode: 'fast',
  autoGate: true,
};

/** Dark-appearance material tint — deep smoke, not gray (kept from v7). */
const DARK_TINT = '20, 24, 34';
const LUMA_LIGHT = 0.80;
const LUMA_DARK = 0.10;

let uid = 0;

/* ════════════════════════════════════════════════════════════════
   [§1] PERCEPTUAL GATES
   ════════════════════════════════════════════════════════════════ */

/** Max R↔B channel split in px: (S_B − S_R)·Δ̂max = 0.24·ca·S. */
function caSplitPx(cfg: LiquidGlassOptConfig): number {
  return 0.24 * cfg.chromaticAberration * cfg.refractionStrength;
}

/** Fringe survives the appended blur iff split ≥ 0.35·σ (masked-JND bound). */
function caVisible(cfg: LiquidGlassOptConfig): boolean {
  if (cfg.chromaticAberration <= 0.01 || cfg.quality === 'low') return false;
  if (cfg.autoGate === false) return true;
  return caSplitPx(cfg) >= 0.35 * cfg.blur;
}

/** The refraction warp itself is sub-threshold below ~0.12σ (vernier bound). */
function refractionVisible(cfg: LiquidGlassOptConfig): boolean {
  if (cfg.refractionStrength <= 0) return false;
  if (cfg.autoGate === false) return true;
  return cfg.refractionStrength >= Math.max(1.5, 0.12 * cfg.blur);
}

/* ════════════════════════════════════════════════════════════════
   [§3] FILTER-REGION PAD — sized by the appended blur's Gaussian
   reach (missing mass ½·erfc(p/σ√2) < 0.6% ⇒ p ≥ 2.5σ), bucketed so
   blur sliders never force a filter/map rebuild mid-drag.
   ════════════════════════════════════════════════════════════════ */
const PAD_BUCKETS = [2, 8, 16, 24, 32, 40, 48, 64, 80];

function padForBlur(blur: number): number {
  const need = Math.ceil(2.5 * blur) + 2;
  for (const b of PAD_BUCKETS) if (b >= need) return b;
  return PAD_BUCKETS[PAD_BUCKETS.length - 1];
}

/* ════════════════════════════════════════════════════════════════
   REFRACTION LUT — identical physics to v7 (see PHYSICS.md §1–3),
   plus a small memo cache keyed by (T, B, ior).
   ════════════════════════════════════════════════════════════════ */
const LUT_N = 512;
const lutCache = new Map<string, { lut: Float32Array; maxDisp: number }>();

function buildRefractionLUT(T: number, B: number, ior: number): { lut: Float32Array; maxDisp: number } {
  const key = `${T.toFixed(2)}|${B.toFixed(2)}|${ior.toFixed(3)}`;
  const hit = lutCache.get(key);
  if (hit) return hit;

  const lut = new Float32Array(LUT_N + 1);
  const eta = 1 / ior;
  let maxDisp = 0;

  for (let i = 0; i <= LUT_N; i++) {
    const s = i / LUT_N;
    if (s <= 0 || s >= 1) { lut[i] = 0; continue; }

    const root = Math.sqrt(s * (2 - s));
    const z = T * root;
    const slope = (T / B) * ((1 - s) / root);

    const invL = 1 / Math.sqrt(1 + slope * slope);
    const cosI = invL;
    const sinI = slope * invL;
    const sinT = eta * sinI;
    const cosT = Math.sqrt(Math.max(0, 1 - sinT * sinT));
    const k = eta * cosI - cosT;
    const tXY = k * sinI;
    const tZ = -eta + k * cosI;
    const disp = z * Math.abs(tXY / tZ);

    lut[i] = disp;
    if (disp > maxDisp) maxDisp = disp;
  }

  if (maxDisp > 0) {
    for (let i = 0; i <= LUT_N; i++) lut[i] /= maxDisp;
  }
  const out = { lut, maxDisp };
  if (lutCache.size > 64) lutCache.clear();
  lutCache.set(key, out);
  return out;
}

/* 4×4 Bayer matrix, pre-scaled to ±0.5 LSB — ordered dithering */
const BAYER4 = (() => {
  const m = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  return new Float32Array(m.map(v => v / 16 - 0.46875));
})();

interface LensMap {
  url: string;
  maxDisp: number;
  refs: number;
  genMs: number;
  pixelsComputed: number;
  /** buffer dims incl. neutral border, and border widths in map px [§3.2] */
  bw: number; bh: number; padMx: number; padMy: number;
  /** content dims in map px */
  mw: number; mh: number;
}

const mapCache = new Map<string, LensMap | Promise<LensMap>>();

function releaseMap(key: string): void {
  const entry = mapCache.get(key);
  if (entry && !(entry instanceof Promise)) {
    entry.refs--;
    if (entry.refs <= 0) {
      URL.revokeObjectURL(entry.url);
      mapCache.delete(key);
    }
  }
}

/**
 * [§6] Map cell size (CSS px per map px) per quality tier. The bilinear rim
 * error grows only as √c while map traffic falls as 1/c².
 */
function mapCell(cfg: LiquidGlassOptConfig): number {
  if (cfg.mapDensity && cfg.mapDensity > 0) return cfg.mapDensity;
  const B = Math.max(4, cfg.bezelWidth);
  if (cfg.quality === 'medium') return Math.min(3, B / 5);
  return Math.min(1.5, B / 10); // high
}

function acquireLensMap(
  cfg: LiquidGlassOptConfig,
  w: number, h: number, radius: number, padCss: number,
): Promise<{ map: LensMap; key: string }> {
  // [§6] quantize element size for the cache key: a ≤4px map stretch is far
  // below the rim-onset error bound, and resize drags stop churning maps.
  const qW = Math.max(8, Math.round(w / 4) * 4);
  const qH = Math.max(8, Math.round(h / 4) * 4);

  let rho: number;
  if (cfg.quality === 'low') {
    rho = Math.min(1, 128 / Math.max(qW, qH));
  } else {
    rho = Math.min(1, 1 / mapCell(cfg), 1024 / Math.max(qW, qH));
  }
  const mw = Math.max(4, Math.round(qW * rho));
  const mh = Math.max(4, Math.round(qH * rho));
  // Neutral border in map px covering ≥ padCss [§3.2]
  const padMx = Math.ceil(padCss * (mw / qW));
  const padMy = Math.ceil(padCss * (mh / qH));

  const key = `${mw}x${mh}|p${padMx},${padMy}|${qW}x${qH}|r${radius}|b${cfg.bezelWidth}|t${cfg.thickness}|n${cfg.ior}`;

  const hit = mapCache.get(key);
  if (hit) {
    if (hit instanceof Promise) return hit.then(m => { m.refs++; return { map: m, key }; });
    hit.refs++;
    return Promise.resolve({ map: hit, key });
  }

  const promise = generateLensMap(mw, mh, padMx, padMy, qW, qH, radius, cfg.bezelWidth, cfg.thickness, cfg.ior)
    .then(m => { mapCache.set(key, m); return m; });
  mapCache.set(key, promise);
  return promise.then(m => { m.refs++; return { map: m, key }; });
}

function generateLensMap(
  mw: number, mh: number, padMx: number, padMy: number,
  elW: number, elH: number,
  radiusEl: number, bezelEl: number, thicknessEl: number, ior: number,
): Promise<LensMap> {
  const t0 = performance.now();

  const sx = mw / elW;
  const sy = mh / elH;
  const s = Math.min(sx, sy);
  const minDim = Math.min(elW, elH);
  const rd = Math.min(radiusEl, minDim / 2) * s;
  const B = Math.min(bezelEl, minDim / 2) * s;
  const T = thicknessEl * s;

  const { lut, maxDisp } = buildRefractionLUT(T, B, ior);

  // [§3.2] buffer = content + neutral border on all sides
  const bw = mw + 2 * padMx;
  const bh = mh + 2 * padMy;

  const canvas = document.createElement('canvas');
  canvas.width = bw;
  canvas.height = bh;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(bw, bh);
  const buf32 = new Uint32Array(img.data.buffer);

  // Fill EVERYTHING neutral (128,128,·,255) — border ring included, so the
  // pad region displaces by exactly zero instead of v7's (−S/2, −S/2).
  buf32.fill(0xff008080);

  const band = B + 1.5;
  const qw = Math.ceil(mw / 2);
  const qh = Math.ceil(mh / 2);
  let computed = 0;

  const cornerSpan = Math.max(band, rd);
  for (let py = 0; py < qh; py++) {
    const ey = py + 0.5;
    const rowInBand = ey <= band;
    const xLimit = rowInBand ? qw : Math.min(qw, Math.ceil(ey <= cornerSpan ? cornerSpan : band));

    for (let px = 0; px < xLimit; px++) {
      const ex = px + 0.5;

      // Analytic rounded-rect SDF + gradient (outward unit normal m̂),
      // top-left quadrant — identical to v7.
      const qx = rd - ex;
      const qy = rd - ey;
      let d: number;
      let mx: number;
      let my: number;
      if (qx > 0 && qy > 0) {
        const len = Math.hypot(qx, qy);
        d = rd - len;
        if (len > 1e-6) { mx = -qx / len; my = -qy / len; }
        else { mx = -0.7071; my = -0.7071; }
      } else if (qx > qy) {
        d = rd - qx; mx = -1; my = 0;
      } else {
        d = rd - qy; mx = 0; my = -1;
      }

      if (d <= 0 || d >= B) continue;

      computed++;

      const fs = (d / B) * LUT_N;
      const i0 = fs | 0;
      const frac = fs - i0;
      const disp = lut[i0] + (lut[i0 + 1] - lut[i0]) * frac;

      const dx = -mx * disp;
      const dy = -my * disp;

      const dth = BAYER4[(px & 3) + ((py & 3) << 2)];
      const r1 = clamp8(128 + dx * 127 + dth);
      const g1 = clamp8(128 + dy * 127 + dth);
      const r2 = clamp8(128 - dx * 127 + dth);
      const g2 = clamp8(128 - dy * 127 + dth);

      // 4-fold symmetry, offset into the bordered buffer
      const x0 = padMx + px;
      const y0 = padMy + py;
      const xm = padMx + mw - 1 - px;
      const ym = padMy + mh - 1 - py;
      buf32[y0 * bw + x0] = 0xff000000 | (g1 << 8) | r1;
      buf32[y0 * bw + xm] = 0xff000000 | (g1 << 8) | r2;
      buf32[ym * bw + x0] = 0xff000000 | (g2 << 8) | r1;
      buf32[ym * bw + xm] = 0xff000000 | (g2 << 8) | r2;
    }
  }

  ctx.putImageData(img, 0, 0);
  const genMs = performance.now() - t0;

  return new Promise<LensMap>((resolve) => {
    canvas.toBlob((blob) => {
      const url = blob ? URL.createObjectURL(blob) : canvas.toDataURL('image/png');
      resolve({ url, maxDisp, refs: 0, genMs, pixelsComputed: computed, bw, bh, padMx, padMy, mw, mh });
    }, 'image/png');
  });
}

function clamp8(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v | 0;
}

/* ════════════════════════════════════════════════════════════════
   ENGINE (v8)
   ════════════════════════════════════════════════════════════════ */
type FilterGraph = 'none' | 'single' | 'fastCA' | 'exactCA';

export class LiquidGlassEngineOpt {
  private el: HTMLElement;
  private cfg: LiquidGlassOptConfig;
  public id: string;

  private lensLayer: HTMLDivElement | null = null;
  private tintLayer: HTMLDivElement | null = null; // only for legacy adaptiveTint [§5]
  private sheenLayer: HTMLDivElement | null = null;
  private rimLayer: HTMLDivElement | null = null;
  private sheenDisk: HTMLDivElement | null = null;
  private rimDisk: HTMLDivElement | null = null;
  private noiseLayer: HTMLDivElement | null = null;

  private svgEl: SVGSVGElement | null = null;
  private dispNodes: SVGFEDisplacementMapElement[] = [];
  private mapRefKey: string | null = null;
  private lensMap: LensMap | null = null;
  private activeGraph: FilterGraph = 'none';
  private regionCssPx = 0;
  private lastBakedGlow = 1;

  private resizeObs: ResizeObserver | null = null;
  private resizeRaf: number | null = null;
  private lastW = 0;
  private lastH = 0;
  private destroyed = false;
  private rafId: number | null = null;
  private animatingLight = false;
  private lensBuildVersion = 0;

  private currentAngle: number;
  private targetAngle: number;
  private angleVelocity = 0;
  private currentParallaxX = 0; private targetParallaxX = 0; private parallaxXVelocity = 0;
  private currentParallaxY = 0; private targetParallaxY = 0; private parallaxYVelocity = 0;
  private currentHoverGlow = 0; private targetHoverGlow = 0; private hoverGlowVelocity = 0;

  private _frameCount = 0;
  private _totalTime = 0;
  private _lastTime = 0;
  private _mapGenMs = 0;
  private _mapPixels = 0;

  private static _svgOk: boolean | null = null;
  private pressHandlers: { down: () => void; up: () => void; leave: () => void } | null = null;

  private schemeQuery: MediaQueryList | null = null;
  private schemeListener: (() => void) | null = null;

  private static _registry = new Set<LiquidGlassEngineOpt>();

  static collectMetrics() {
    const engines = [...LiquidGlassEngineOpt._registry].map(e => ({
      id: e.id,
      size: `${e.lastW}x${e.lastH}`,
      mapGenMs: e._mapGenMs,
      mapPixelsComputed: e._mapPixels,
      mapKey: e.mapRefKey,
      quality: e.cfg.quality,
      graph: e.activeGraph,
      dispTaps: e.dispNodes.length,
      regionCssPx: e.regionCssPx,
    }));
    return {
      engineCount: engines.length,
      uniqueMaps: mapCache.size,
      engines,
    };
  }

  constructor(element: HTMLElement, config: Partial<LiquidGlassOptConfig> = {}) {
    this.el = element;
    this.cfg = LiquidGlassEngineOpt.resolveConfig(config);
    this.id = `qlo${++uid}`;
    this.currentAngle = this.cfg.lightAngle;
    this.targetAngle = this.cfg.lightAngle;
    LiquidGlassEngineOpt._registry.add(this);
    if (typeof globalThis !== 'undefined' && !(globalThis as any).__QUICK_LIQUID_OPT__) {
      (globalThis as any).__QUICK_LIQUID_OPT__ = { metrics: () => LiquidGlassEngineOpt.collectMetrics() };
    }
    this.mount();
  }

  private static resolveConfig(config: Partial<LiquidGlassOptConfig>): LiquidGlassOptConfig {
    let merged: LiquidGlassOptConfig = { ...DEFAULT_CONFIG, ...OPT_DEFAULTS, ...config };
    if (merged.material && MATERIAL_PRESETS[merged.material]) {
      merged = { ...DEFAULT_CONFIG, ...OPT_DEFAULTS, ...MATERIAL_PRESETS[merged.material], ...config };
    }
    if (config.distortionStrength !== undefined && config.refractionStrength === undefined) {
      merged.refractionStrength = config.distortionStrength;
    }
    if (merged.dynamicLighting) merged.cursorTracking = true;
    return merged;
  }

  /* ─────────────────────────── MOUNT ─────────────────────────── */
  private mount(): void {
    const el = this.el;
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    el.style.borderRadius = `${this.cfg.borderRadius}px`;
    el.style.overflow = 'hidden';
    // CRITICAL (v7 quirk): never set isolation/filter/opacity/mask on the host.

    this.lastW = el.offsetWidth;
    this.lastH = el.offsetHeight;

    this.createLayers();
    this.applyDepth();
    void this.rebuildLensFilter();

    this.resizeObs = new ResizeObserver(() => this.onResize());
    this.resizeObs.observe(el);

    this.syncPointerListeners();
    this.syncSchemeListener();
  }

  /* ─────────────────── APPEARANCE (dark mode) ─────────────────── */
  private isDark(): boolean {
    const a = this.cfg.appearance ?? 'auto';
    if (a === 'dark') return true;
    if (a === 'light') return false;
    if (this.schemeQuery) return this.schemeQuery.matches;
    return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
  }

  private backdropLuma(): number {
    const L = this.cfg.backdropLuminance;
    if (L !== undefined && Number.isFinite(L)) return Math.min(1, Math.max(0, L));
    return this.isDark() ? LUMA_DARK : LUMA_LIGHT;
  }

  private syncSchemeListener(): void {
    const wanted = (this.cfg.appearance ?? 'auto') === 'auto' && typeof matchMedia === 'function';
    if (wanted && !this.schemeQuery) {
      this.schemeQuery = matchMedia('(prefers-color-scheme: dark)');
      this.schemeListener = () => {
        if (this.destroyed) return;
        this.updateTint();
        this.bakeLight();
        this.applyDepth();
      };
      this.schemeQuery.addEventListener('change', this.schemeListener);
    } else if (!wanted && this.schemeQuery) {
      if (this.schemeListener) this.schemeQuery.removeEventListener('change', this.schemeListener);
      this.schemeQuery = null;
      this.schemeListener = null;
    }
  }

  private onResize(): void {
    if (this.destroyed) return;
    const w = this.el.offsetWidth;
    const h = this.el.offsetHeight;
    if (Math.abs(w - this.lastW) < 1 && Math.abs(h - this.lastH) < 1) return;
    this.lastW = w;
    this.lastH = h;
    if (this.resizeRaf) cancelAnimationFrame(this.resizeRaf);
    this.resizeRaf = requestAnimationFrame(() => {
      this.resizeRaf = null;
      this.updateRingGeometry();
      void this.rebuildLensFilter();
    });
  }

  private createLayers(): void {
    [this.lensLayer, this.tintLayer, this.sheenLayer, this.rimLayer, this.noiseLayer]
      .forEach(l => l?.remove());
    this.tintLayer = this.noiseLayer = null;

    // v7 quirk: NO z-index on any glass layer — DOM order only.
    const mk = (cls: string): HTMLDivElement => {
      const div = document.createElement('div');
      div.className = cls;
      Object.assign(div.style, {
        position: 'absolute',
        inset: '0',
        borderRadius: 'inherit',
        pointerEvents: 'none',
      });
      return div;
    };

    this.lensLayer = mk('ql-lens');
    // [§5] legacy adaptiveTint uses mix-blend-mode: overlay, which cannot be
    // expressed as the lens's own background — only then keep a tint layer.
    if (this.cfg.adaptiveTint) this.tintLayer = mk('ql-tint');
    this.sheenLayer = mk('ql-sheen');
    this.rimLayer = mk('ql-rim');

    // [§4] oversized light disks — the rotating baked templates
    const mkDisk = (cls: string): HTMLDivElement => {
      const div = document.createElement('div');
      div.className = cls;
      Object.assign(div.style, {
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%,-50%)',
        pointerEvents: 'none',
      });
      return div;
    };
    this.sheenDisk = mkDisk('ql-sheen-disk');
    this.rimDisk = mkDisk('ql-rim-disk');
    this.sheenLayer.appendChild(this.sheenDisk);
    this.rimLayer.appendChild(this.rimDisk);

    const content = this._contentEl();
    const layers = [this.lensLayer, this.tintLayer, this.sheenLayer, this.rimLayer]
      .filter((l): l is HTMLDivElement => !!l);
    for (const layer of layers) this.el.insertBefore(layer, content);

    this.updateLensStyle();
    this.updateTint();
    this.updateRingGeometry();
    this.bakeLight();
    this.updateRings();
    this.updateNoise();
  }

  private _contentEl(): Element | null {
    return this.el.querySelector(':scope > .ql-content');
  }

  /* ─────────────────── LAYER 0: LENS (backdrop + tint bg) ─────────────────── */
  private lensFilterRef: string | null = null;

  private lensFilterString(): string {
    const cfg = this.cfg;
    const parts: string[] = [];
    if (this.svgEl) parts.push(`url(#${this.id})`);
    if (cfg.saturation !== 1) parts.push(`saturate(${cfg.saturation})`);
    if (cfg.blur > 0) parts.push(`blur(${cfg.blur}px)`);
    return parts.join(' ') || 'none';
  }

  /**
   * v7 quirk preserved: whenever the url() reference part changes, swap in a
   * brand-new lens node with the final filter string already set.
   * [§5] The tint gradient is this element's own background — re-applied on
   * every swap.
   */
  private updateLensStyle(): void {
    if (!this.lensLayer) return;
    const bdf = this.lensFilterString();
    const ref = this.svgEl ? this.id : null;

    if (ref !== this.lensFilterRef) {
      const fresh = document.createElement('div');
      fresh.className = 'ql-lens';
      Object.assign(fresh.style, {
        position: 'absolute',
        inset: '0',
        borderRadius: 'inherit',
        pointerEvents: 'none',
      });
      fresh.style.backdropFilter = bdf;
      (fresh.style as any).WebkitBackdropFilter = bdf;
      fresh.style.background = this.tintCss();
      this.lensLayer.replaceWith(fresh);
      this.lensLayer = fresh;
      this.lensFilterRef = ref;
    } else {
      this.lensLayer.style.backdropFilter = bdf;
      (this.lensLayer.style as any).WebkitBackdropFilter = bdf;
    }
  }

  /* ─────────────────── TINT [§5] ─────────────────── */
  private tintCss(): string {
    const cfg = this.cfg;
    const autoDark = this.isDark() &&
      cfg.tint.replace(/\s/g, '') === DEFAULT_CONFIG.tint.replace(/\s/g, '');
    const tint = autoDark ? DARK_TINT : cfg.tint;
    const op = cfg.tintOpacity * (cfg.tintStrength ?? 1) * (autoDark ? 1.75 : 1);
    if (op <= 0) return 'none';
    return `linear-gradient(180deg,
      rgba(${tint}, ${(op * 1.2).toFixed(4)}) 0%,
      rgba(${tint}, ${(op * 0.85).toFixed(4)}) 100%)`;
  }

  private updateTint(): void {
    if (this.cfg.adaptiveTint && this.tintLayer) {
      this.tintLayer.style.background = this.tintCss();
      this.tintLayer.style.mixBlendMode = 'overlay';
      if (this.lensLayer) this.lensLayer.style.background = 'none';
      return;
    }
    if (this.lensLayer) this.lensLayer.style.background = this.tintCss();
  }

  /* ─────────────── LIGHT RINGS [§4] ───────────────
     Template I(θ;θL) = I(θ−θL;0) — bake at θL = 0 once, rotate the disk.  */
  private ringMask(padPx: number): Partial<CSSStyleDeclaration> {
    return {
      boxSizing: 'border-box',
      padding: `${padPx}px`,
      maskImage: 'linear-gradient(#000 0 0), linear-gradient(#000 0 0)',
      maskClip: 'content-box, border-box',
      maskComposite: 'exclude',
      overflow: 'hidden',
    } as Partial<CSSStyleDeclaration>;
  }

  /** Angular sampling at 2° — max template error < 0.1% of peak, so the v7
      per-frame blur(3px) that hid 10°-step mach bands is unnecessary. */
  private conicStops(
    power: number,
    peakA: number, baseA: number, darkA: number,
  ): string {
    const stops: string[] = [];
    const STEP = 2;
    for (let a = 0; a <= 360; a += STEP) {
      const rel = (a * Math.PI) / 180;
      const c = Math.abs(Math.cos(rel));
      const sn = Math.abs(Math.sin(rel));
      const white = baseA + peakA * Math.pow(c, power);
      const dark = darkA * sn * sn;
      const net = white - dark;
      const col = net >= 0
        ? `rgba(255,255,255,${net.toFixed(4)})`
        : `rgba(10,14,22,${(-net).toFixed(4)})`;
      stops.push(`${col} ${a}deg`);
    }
    return `conic-gradient(from 0deg at 50% 50%, ${stops.join(', ')})`;
  }

  /** Masks + disk sizes — geometry only; called on mount/resize/config. */
  private updateRingGeometry(): void {
    const w = this.lastW || this.el.offsetWidth || 0;
    const h = this.lastH || this.el.offsetHeight || 0;
    const diag = Math.ceil(Math.hypot(w, h)) + 4;

    if (this.rimLayer) Object.assign(this.rimLayer.style, this.ringMask(1.25));
    if (this.sheenLayer) {
      const bezel = Math.min(this.cfg.bezelWidth, Math.min(w || 999, h || 999) / 2);
      Object.assign(this.sheenLayer.style, this.ringMask(Math.max(4, bezel)));
    }
    for (const disk of [this.rimDisk, this.sheenDisk]) {
      if (!disk) continue;
      disk.style.width = `${diag}px`;
      disk.style.height = `${diag}px`;
    }
  }

  /** Bake the θL = 0 template into both disks; called on config/appearance/
      glow changes only — never per animation frame. */
  private bakeLight(): void {
    const cfg = this.cfg;
    const p = Math.max(1, Math.min(6, cfg.fresnelPower ?? 2.2));
    const glow = cfg.hoverLighting ? 1 + 0.3 * this.currentHoverGlow : 1;
    this.lastBakedGlow = glow;

    const L = this.backdropLuma();
    const rimScale = 0.55 + 0.56 * L;
    const sheenScale = 0.35 + 0.81 * L;

    if (this.rimDisk) {
      const hi = cfg.edgeHighlight * glow * rimScale;
      const base = 0.16 + 0.10 * Math.max(0, LUMA_LIGHT - L);
      this.rimDisk.style.background = this.conicStops(p, hi * 0.85, hi * base, 0);
    }
    if (this.sheenDisk) {
      const sp = cfg.specularStrength * glow * sheenScale;
      this.sheenDisk.style.background = this.conicStops(p * 0.75, sp * 0.28, sp * 0.02, sp * 0.14);
    }
  }

  /** Per-frame light update: two compositor-only transform writes. */
  private updateRings(): void {
    const rot = `translate(-50%,-50%) rotate(${this.currentAngle}deg)`;
    if (this.rimDisk) this.rimDisk.style.transform = rot;
    if (this.sheenDisk) this.sheenDisk.style.transform = rot;
    // hoverLighting keeps its price (opt-in): glow changes template intensity
    // non-uniformly vs the [0,1] opacity range, so rebake when it moves.
    if (this.cfg.hoverLighting) {
      const glow = 1 + 0.3 * this.currentHoverGlow;
      if (Math.abs(glow - this.lastBakedGlow) > 0.01) this.bakeLight();
    }
  }

  /* ─────────────────── NOISE (lazy [§5]) ─────────────────── */
  private updateNoise(): void {
    const cfg = this.cfg;
    if (cfg.noiseOpacity <= 0) {
      if (this.noiseLayer) { this.noiseLayer.remove(); this.noiseLayer = null; }
      return;
    }
    if (!this.noiseLayer) {
      const div = document.createElement('div');
      div.className = 'ql-noise';
      Object.assign(div.style, {
        position: 'absolute',
        inset: '0',
        borderRadius: 'inherit',
        pointerEvents: 'none',
      });
      const content = this._contentEl();
      this.el.insertBefore(div, content);
      this.noiseLayer = div;
    }
    const noiseSvg = `data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E`;
    Object.assign(this.noiseLayer.style, {
      backgroundImage: `url("${noiseSvg}")`,
      opacity: String(cfg.noiseOpacity),
      backgroundSize: `${100 * cfg.noiseScale}px ${100 * cfg.noiseScale}px`,
      mixBlendMode: 'overlay',
    });
  }

  /* ─────────────────── SHADOW (unchanged from v7) ─────────────────── */
  private applyDepth(): void {
    const e = this.cfg.elevation;
    if (e <= 0) { this.el.style.boxShadow = 'none'; return; }
    const t = Math.max(1, this.cfg.thickness / 8);
    if (this.isDark()) {
      this.el.style.boxShadow = [
        `0 0 ${(26 * t * e).toFixed(0)}px rgba(148,176,224,${(0.10 * e).toFixed(3)})`,
        `0 ${(6 * t * e).toFixed(0)}px ${(24 * t * e).toFixed(0)}px rgba(0,0,0,${(0.36 * e).toFixed(3)})`,
        `0 ${(1.5 * e).toFixed(1)}px ${(5 * e).toFixed(0)}px rgba(0,0,0,${(0.24 * e).toFixed(3)})`,
      ].join(', ');
      return;
    }
    this.el.style.boxShadow = [
      `0 ${(6 * t * e).toFixed(0)}px ${(22 * t * e).toFixed(0)}px rgba(16,22,34,${(0.13 * e).toFixed(3)})`,
      `0 ${(1.5 * e).toFixed(1)}px ${(5 * e).toFixed(0)}px rgba(16,22,34,${(0.08 * e).toFixed(3)})`,
    ].join(', ');
  }

  /* ─────────────────── SVG LENS FILTER ─────────────────── */
  private shouldUseSVG(): boolean {
    const mode = this.cfg.refractionMode;
    if (mode === 'svg') return true;
    if (mode === 'css') return false;
    if (LiquidGlassEngineOpt._svgOk === null) {
      LiquidGlassEngineOpt._svgOk = this.detectSVGSupport();
    }
    return LiquidGlassEngineOpt._svgOk;
  }

  private detectSVGSupport(): boolean {
    if (typeof document === 'undefined') return false;
    try {
      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg') as SVGSVGElement;
      svg.setAttribute('width', '0');
      svg.setAttribute('height', '0');
      svg.style.cssText = 'position:absolute;overflow:hidden;pointer-events:none;';
      const defs = document.createElementNS(svgNS, 'defs');
      const filter = document.createElementNS(svgNS, 'filter') as SVGFilterElement;
      filter.id = '__qlo_probe__';
      defs.appendChild(filter);
      svg.appendChild(defs);
      document.body.appendChild(svg);

      const probe = document.createElement('div');
      probe.style.cssText =
        'position:fixed;top:0;left:0;width:1px;height:1px;' +
        'backdrop-filter:url(#__qlo_probe__);-webkit-backdrop-filter:url(#__qlo_probe__);pointer-events:none;';
      document.body.appendChild(probe);
      const cs = getComputedStyle(probe);
      const bf = cs.backdropFilter || (cs as any).webkitBackdropFilter || '';
      const ok = bf.includes('url(');
      probe.remove();
      svg.remove();
      return ok;
    } catch {
      return false;
    }
  }

  private channelScales(): { r: number; g: number; b: number; base: number } {
    const M = this.lensMap?.maxDisp || 1;
    const base = 2 * this.cfg.refractionStrength * (M > 0 ? 1 : 0);
    const ca = this.cfg.chromaticAberration;
    return {
      base,
      r: base * (1 - ca * 0.10),
      g: base,
      b: base * (1 + ca * 0.14),
    };
  }

  /** Which filter graph the current config wants [§1][§2]. */
  private desiredGraph(): FilterGraph {
    if (!this.shouldUseSVG() || !refractionVisible(this.cfg)) return 'none';
    if (!caVisible(this.cfg)) return 'single';
    return (this.cfg.caMode ?? 'fast') === 'exact' ? 'exactCA' : 'fastCA';
  }

  /** Everything that requires a filter/map rebuild, in one comparable key. */
  private filterSignature(): string {
    const cfg = this.cfg;
    const radius = Math.round(Math.min(cfg.borderRadius, Math.min(this.lastW || 999, this.lastH || 999) / 2));
    return [
      this.desiredGraph(),
      padForBlur(cfg.blur),
      radius, cfg.bezelWidth, cfg.thickness, cfg.ior,
      cfg.quality, cfg.mapDensity ?? 0,
    ].join('|');
  }

  private async rebuildLensFilter(): Promise<void> {
    const buildVersion = ++this.lensBuildVersion;
    const cfg = this.cfg;
    const graph = this.desiredGraph();

    if (graph === 'none') {
      this.teardownFilter();
      this.activeGraph = 'none';
      this.updateLensStyle();
      return;
    }

    const w = this.el.offsetWidth || this.lastW || 200;
    const h = this.el.offsetHeight || this.lastH || 100;
    if (w < 8 || h < 8) return;

    const radius = Math.round(Math.min(cfg.borderRadius, Math.min(w, h) / 2));
    const pad = padForBlur(cfg.blur);

    const { map, key } = await acquireLensMap(cfg, w, h, radius, pad);
    if (this.destroyed || buildVersion !== this.lensBuildVersion) {
      releaseMap(key);
      return;
    }

    if (this.mapRefKey === key) {
      releaseMap(key);
    } else {
      if (this.mapRefKey) releaseMap(this.mapRefKey);
      this.mapRefKey = key;
    }
    this.lensMap = map;
    this._mapGenMs = map.genMs;
    this._mapPixels = map.pixelsComputed;

    this.buildFilterDOM(w, h, map, graph);
    this.activeGraph = graph;
    this.lensFilterRef = '__stale__'; // force fresh lens node (v7 quirk)
    this.updateLensStyle();
  }

  private teardownFilter(): void {
    if (this.svgEl) { this.svgEl.remove(); this.svgEl = null; }
    this.dispNodes = [];
    if (this.mapRefKey) { releaseMap(this.mapRefKey); this.mapRefKey = null; }
    this.lensMap = null;
  }

  /**
   * [§2][§3] Build the filter DOM.
   *
   * Registration math: the map buffer holds the content (mw×mh) inside a
   * neutral border (padMx/padMy). feImage stretches the WHOLE buffer over
   * [−padCssX … w+padCssX] × [−padCssY … h+padCssY] with
   * padCss = padM · (element px per map px), so the content edges land
   * exactly on the element edges and the filter region equals the feImage
   * rect — no transparent-map ring anywhere in the region.
   */
  private buildFilterDOM(w: number, h: number, map: LensMap, graph: FilterGraph): void {
    if (this.svgEl) { this.svgEl.remove(); this.svgEl = null; }
    this.dispNodes = [];

    const { r, g, b } = this.channelScales();
    const padCssX = map.padMx * (w / map.mw);
    const padCssY = map.padMy * (h / map.mh);
    const rx = -padCssX;
    const ry = -padCssY;
    const rw = w + 2 * padCssX;
    const rh = h + 2 * padCssY;
    this.regionCssPx = Math.round(rw * rh);

    const feImage = `<feImage href="${map.url}" result="map" preserveAspectRatio="none" x="${rx.toFixed(2)}" y="${ry.toFixed(2)}" width="${rw.toFixed(2)}" height="${rh.toFixed(2)}"/>`;

    let content: string;
    if (graph === 'fastCA') {
      // [§2] two displacement taps; red = (1+λ)·dG − λ·dB, λ = 5/7.
      const LAMBDA = 5 / 7;
      content = `
        ${feImage}
        <feDisplacementMap in="SourceGraphic" in2="map" scale="${g.toFixed(2)}" xChannelSelector="R" yChannelSelector="G" result="dG"/>
        <feDisplacementMap in="SourceGraphic" in2="map" scale="${b.toFixed(2)}" xChannelSelector="R" yChannelSelector="G" result="dB"/>
        <feComposite in="dG" in2="dB" operator="arithmetic" k1="0" k2="${(1 + LAMBDA).toFixed(4)}" k3="${(-LAMBDA).toFixed(4)}" k4="0" result="dRx"/>
        <feColorMatrix in="dRx" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="cR"/>
        <feColorMatrix in="dG" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="cG"/>
        <feColorMatrix in="dB" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="cB"/>
        <feBlend in="cR" in2="cB" mode="screen" result="rb"/>
        <feBlend in="rb" in2="cG" mode="screen"/>`;
    } else if (graph === 'exactCA') {
      // v7's 3-tap graph, verbatim, for A/B comparison.
      content = `
        ${feImage}
        <feDisplacementMap in="SourceGraphic" in2="map" scale="${r.toFixed(2)}" xChannelSelector="R" yChannelSelector="G" result="dR"/>
        <feDisplacementMap in="SourceGraphic" in2="map" scale="${g.toFixed(2)}" xChannelSelector="R" yChannelSelector="G" result="dG"/>
        <feDisplacementMap in="SourceGraphic" in2="map" scale="${b.toFixed(2)}" xChannelSelector="R" yChannelSelector="G" result="dB"/>
        <feComponentTransfer in="dR" result="cR">
          <feFuncG type="discrete" tableValues="0"/><feFuncB type="discrete" tableValues="0"/>
        </feComponentTransfer>
        <feComponentTransfer in="dG" result="cG">
          <feFuncR type="discrete" tableValues="0"/><feFuncB type="discrete" tableValues="0"/>
        </feComponentTransfer>
        <feComponentTransfer in="dB" result="cB">
          <feFuncR type="discrete" tableValues="0"/><feFuncG type="discrete" tableValues="0"/>
        </feComponentTransfer>
        <feBlend in="cR" in2="cG" mode="screen" result="rg"/>
        <feBlend in="rg" in2="cB" mode="screen"/>`;
    } else {
      content = `
        ${feImage}
        <feDisplacementMap in="SourceGraphic" in2="map" scale="${g.toFixed(2)}" xChannelSelector="R" yChannelSelector="G"/>`;
    }

    const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute;overflow:hidden;pointer-events:none">
      <defs>
        <filter id="${this.id}" filterUnits="userSpaceOnUse"
          x="${rx.toFixed(2)}" y="${ry.toFixed(2)}" width="${rw.toFixed(2)}" height="${rh.toFixed(2)}"
          color-interpolation-filters="sRGB">${content}</filter>
      </defs>
    </svg>`;

    const div = document.createElement('div');
    div.innerHTML = svgStr.trim();
    this.svgEl = div.querySelector('svg')!;
    document.body.appendChild(this.svgEl);
    this.dispNodes = Array.from(this.svgEl.querySelectorAll('feDisplacementMap'));
  }

  /** Surgical update: strength/CA slider changes only rewrite `scale`. */
  private updateFilterScales(): void {
    if (!this.svgEl || this.dispNodes.length === 0) return;
    const { r, g, b } = this.channelScales();
    if (this.activeGraph === 'exactCA' && this.dispNodes.length === 3) {
      this.dispNodes[0].setAttribute('scale', r.toFixed(2));
      this.dispNodes[1].setAttribute('scale', g.toFixed(2));
      this.dispNodes[2].setAttribute('scale', b.toFixed(2));
    } else if (this.activeGraph === 'fastCA' && this.dispNodes.length === 2) {
      this.dispNodes[0].setAttribute('scale', g.toFixed(2));
      this.dispNodes[1].setAttribute('scale', b.toFixed(2));
    } else {
      this.dispNodes[0].setAttribute('scale', g.toFixed(2));
    }
  }

  /* ─────────────────── POINTER / MOTION ─────────────────── */
  private _pointerMoveHandler?: (e: PointerEvent) => void;
  private _pointerLeaveHandler?: () => void;
  private _pointerEnterHandler?: () => void;

  private setupPointer(): void {
    this.teardownPointer();

    this._pointerEnterHandler = () => {
      if (this.cfg.hoverLighting) {
        this.targetHoverGlow = 1;
        this.kickLight();
      }
    };

    this._pointerMoveHandler = (e: PointerEvent) => {
      const rect = this.el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      if (this.cfg.cursorTracking) {
        this.targetAngle = Math.atan2(px - 0.5, -(py - 0.5)) * (180 / Math.PI);
      }
      if (this.cfg.parallax) {
        this.targetParallaxX = (px - 0.5) * 2;
        this.targetParallaxY = (py - 0.5) * 2;
      }
      this.kickLight();
    };

    this._pointerLeaveHandler = () => {
      this.targetAngle = this.cfg.lightAngle;
      this.targetParallaxX = 0;
      this.targetParallaxY = 0;
      this.targetHoverGlow = 0;
      this.kickLight();
    };

    this.el.addEventListener('mouseenter', this._pointerEnterHandler, { passive: true });
    this.el.addEventListener('pointermove', this._pointerMoveHandler, { passive: true });
    this.el.addEventListener('pointerleave', this._pointerLeaveHandler, { passive: true });
  }

  private teardownPointer(): void {
    if (this._pointerEnterHandler) { this.el.removeEventListener('mouseenter', this._pointerEnterHandler); this._pointerEnterHandler = undefined; }
    if (this._pointerMoveHandler) { this.el.removeEventListener('pointermove', this._pointerMoveHandler); this._pointerMoveHandler = undefined; }
    if (this._pointerLeaveHandler) { this.el.removeEventListener('pointerleave', this._pointerLeaveHandler); this._pointerLeaveHandler = undefined; }
  }

  /** [§4] Promote the disks only while the light animates. */
  private setDiskWillChange(on: boolean): void {
    const v = on ? 'transform' : '';
    if (this.rimDisk) this.rimDisk.style.willChange = v;
    if (this.sheenDisk) this.sheenDisk.style.willChange = v;
  }

  private kickLight(): void {
    if (!this.animatingLight) {
      this.animatingLight = true;
      this.setDiskWillChange(true);
      this.tickLight();
    }
  }

  private tickLight(): void {
    if (this.destroyed) return;
    const t0 = performance.now();
    const cfg = this.cfg;

    let diff = this.targetAngle - this.currentAngle;
    diff = ((diff + 540) % 360) - 180;

    let isMoving = false;
    let ringsDirty = false;

    if (Math.abs(diff) > 0.1 || Math.abs(this.angleVelocity) > 0.01) {
      isMoving = true;
      ringsDirty = true;
      if (cfg.inertia) {
        this.angleVelocity = (this.angleVelocity + diff * 0.15) * 0.6;
        this.currentAngle += this.angleVelocity;
      } else {
        this.currentAngle += diff * 0.12;
      }
    } else {
      this.currentAngle = this.targetAngle;
      this.angleVelocity = 0;
    }

    if (cfg.parallax) {
      const pDiffX = this.targetParallaxX - this.currentParallaxX;
      const pDiffY = this.targetParallaxY - this.currentParallaxY;
      if (Math.abs(pDiffX) > 0.001 || Math.abs(pDiffY) > 0.001 ||
          Math.abs(this.parallaxXVelocity) > 0.001 || Math.abs(this.parallaxYVelocity) > 0.001) {
        isMoving = true;
        if (cfg.inertia) {
          this.parallaxXVelocity = (this.parallaxXVelocity + pDiffX * 0.1) * 0.7;
          this.parallaxYVelocity = (this.parallaxYVelocity + pDiffY * 0.1) * 0.7;
          this.currentParallaxX += this.parallaxXVelocity;
          this.currentParallaxY += this.parallaxYVelocity;
        } else {
          this.currentParallaxX += pDiffX * 0.2;
          this.currentParallaxY += pDiffY * 0.2;
        }
        this.el.style.transform = `perspective(1000px) rotateY(${this.currentParallaxX * 5}deg) rotateX(${-this.currentParallaxY * 5}deg)`;
      } else {
        this.currentParallaxX = this.targetParallaxX;
        this.currentParallaxY = this.targetParallaxY;
        this.parallaxXVelocity = 0;
        this.parallaxYVelocity = 0;
      }
    }

    if (cfg.hoverLighting) {
      const gDiff = this.targetHoverGlow - this.currentHoverGlow;
      if (Math.abs(gDiff) > 0.005 || Math.abs(this.hoverGlowVelocity) > 0.005) {
        isMoving = true;
        ringsDirty = true;
        this.hoverGlowVelocity = (this.hoverGlowVelocity + gDiff * 0.08) * 0.72;
        this.currentHoverGlow += this.hoverGlowVelocity;
      } else {
        this.currentHoverGlow = this.targetHoverGlow;
        this.hoverGlowVelocity = 0;
      }
    }

    if (ringsDirty) this.updateRings();

    if (!isMoving) {
      this.animatingLight = false;
      this.setDiskWillChange(false);
      return;
    }

    const dt = performance.now() - t0;
    this._lastTime = dt;
    this._totalTime += dt;
    this._frameCount++;
    this.rafId = requestAnimationFrame(() => this.tickLight());
  }

  /* ─────────────────── ANIMATIONS (public, unchanged) ─────────────────── */
  enableLiquidPress(config?: { scale?: number; squish?: number }): void {
    if (this.pressHandlers) return;
    const scale = config?.scale ?? 0.94;
    const squish = config?.squish ?? 0.025;

    const onDown = () => {
      if (this.destroyed) return;
      this.el.style.transition = 'none';
      this.el.style.transform = `scale(${1 + squish}, ${scale})`;
    };
    const onUp = () => {
      if (this.destroyed) return;
      this.el.style.transition = '';
      this.el.style.animation = `ql-bounce-back 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards`;
      this.el.addEventListener('animationend', () => {
        this.el.style.animation = '';
        this.el.style.transform = '';
      }, { once: true });
    };
    const onLeave = () => {
      if (this.destroyed) return;
      if (this.el.style.transform && this.el.style.transform !== 'none') {
        this.el.style.transition = '';
        this.el.style.animation = `ql-bounce-back 0.4s cubic-bezier(0.34,1.2,0.64,1) forwards`;
        this.el.addEventListener('animationend', () => {
          this.el.style.animation = '';
          this.el.style.transform = '';
        }, { once: true });
      }
    };
    this.pressHandlers = { down: onDown, up: onUp, leave: onLeave };
    this.el.addEventListener('pointerdown', onDown, { passive: true });
    this.el.addEventListener('pointerup', onUp, { passive: true });
    this.el.addEventListener('pointerleave', onLeave, { passive: true });
    LiquidGlassEngineOpt.injectAnimationStyles();
  }

  animateIn(delay = 0): void {
    LiquidGlassEngineOpt.injectAnimationStyles();
    this.el.style.opacity = '0';
    this.el.style.transform = 'scale(0.85)';
    setTimeout(() => {
      this.el.style.animation = `ql-appear 0.7s cubic-bezier(0.34,1.56,0.64,1) forwards`;
      this.el.addEventListener('animationend', () => {
        this.el.style.animation = '';
        this.el.style.opacity = '';
        this.el.style.transform = '';
      }, { once: true });
    }, delay);
  }

  animateOut(): Promise<void> {
    LiquidGlassEngineOpt.injectAnimationStyles();
    return new Promise(resolve => {
      this.el.style.animation = `ql-disappear 0.35s cubic-bezier(0.4,0,1,1) forwards`;
      this.el.addEventListener('animationend', () => {
        this.el.style.animation = '';
        resolve();
      }, { once: true });
    });
  }

  jiggle(intensity = 1): void {
    LiquidGlassEngineOpt.injectAnimationStyles();
    this.el.style.setProperty('--ql-jiggle-intensity', String(intensity));
    this.el.style.animation = `ql-jiggle 0.8s cubic-bezier(0.34,1.56,0.64,1) forwards`;
    this.el.addEventListener('animationend', () => { this.el.style.animation = ''; }, { once: true });
  }

  getElement(): HTMLElement { return this.el; }

  /* ─────────────────── PUBLIC API ─────────────────── */
  getPerformanceMetrics() {
    return {
      avgFrameTime: this._frameCount > 0 ? this._totalTime / this._frameCount : 0,
      lastFrameTime: this._lastTime,
      frameCount: this._frameCount,
      quality: this.cfg.quality,
      mapGenMs: this._mapGenMs,
      mapPixelsComputed: this._mapPixels,
      // v8 extras
      graph: this.activeGraph,
      dispTaps: this.dispNodes.length,
      regionCssPx: this.regionCssPx,
      caGated: this.cfg.chromaticAberration > 0.01 && !caVisible(this.cfg),
      mapBufferPx: this.lensMap ? this.lensMap.bw * this.lensMap.bh : 0,
    };
  }

  updateConfig(config: Partial<LiquidGlassOptConfig>): void {
    if (this.destroyed) return;
    const oldSig = this.filterSignature();
    const oldCfg = this.cfg;
    this.cfg = LiquidGlassEngineOpt.resolveConfig({ ...this.stripDefaults(oldCfg), ...config });
    const cfg = this.cfg;

    this.el.style.borderRadius = `${cfg.borderRadius}px`;

    if (this.filterSignature() !== oldSig) {
      void this.rebuildLensFilter();
    } else if (
      oldCfg.refractionStrength !== cfg.refractionStrength ||
      oldCfg.chromaticAberration !== cfg.chromaticAberration
    ) {
      this.updateFilterScales(); // zero-cost path for sliders
    }

    this.updateLensStyle();
    this.updateTint();
    this.updateRingGeometry();
    this.bakeLight();
    this.updateRings();
    this.updateNoise();
    this.applyDepth();
    this.syncPointerListeners();
    this.syncSchemeListener();
  }

  private stripDefaults(cfg: LiquidGlassOptConfig): Partial<LiquidGlassOptConfig> {
    const defaults = { ...DEFAULT_CONFIG, ...OPT_DEFAULTS } as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    const cfgRec = cfg as unknown as Record<string, unknown>;
    for (const k of Object.keys(cfgRec)) {
      if (cfgRec[k] !== defaults[k]) {
        out[k] = cfgRec[k];
      }
    }
    return out as Partial<LiquidGlassOptConfig>;
  }

  private syncPointerListeners(): void {
    if (this.cfg.cursorTracking || this.cfg.hoverLighting || this.cfg.parallax) {
      this.setupPointer();
    } else {
      this.teardownPointer();
    }
  }

  destroy(): void {
    this.destroyed = true;
    LiquidGlassEngineOpt._registry.delete(this);
    this.lensBuildVersion++;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.resizeRaf) cancelAnimationFrame(this.resizeRaf);
    this.resizeObs?.disconnect();
    this.teardownFilter();
    [this.lensLayer, this.tintLayer, this.sheenLayer, this.rimLayer, this.noiseLayer]
      .forEach(l => l?.remove());
    this.lensLayer = this.tintLayer = this.sheenLayer = this.rimLayer = this.noiseLayer = null;
    this.sheenDisk = this.rimDisk = null;

    if (this.pressHandlers) {
      this.el.removeEventListener('pointerdown', this.pressHandlers.down);
      this.el.removeEventListener('pointerup', this.pressHandlers.up);
      this.el.removeEventListener('pointerleave', this.pressHandlers.leave);
      this.pressHandlers = null;
    }
    this.teardownPointer();
    if (this.schemeQuery && this.schemeListener) {
      this.schemeQuery.removeEventListener('change', this.schemeListener);
    }
    this.schemeQuery = null;
    this.schemeListener = null;

    const s = this.el.style;
    s.filter = s.backdropFilter = s.boxShadow = s.backgroundColor = '';
    s.borderRadius = s.overflow = s.isolation = s.transform = s.opacity = s.animation = '';
    (s as any).WebkitFilter = (s as any).WebkitBackdropFilter = '';
  }

  private static _stylesInjected = false;
  private static injectAnimationStyles(): void {
    if (LiquidGlassEngineOpt._stylesInjected) return;
    if (document.getElementById('ql-animation-styles')) {
      LiquidGlassEngineOpt._stylesInjected = true;
      return;
    }
    LiquidGlassEngineOpt._stylesInjected = true;
    const style = document.createElement('style');
    style.id = 'ql-animation-styles';
    style.textContent = `
      @keyframes ql-bounce-back {
        0%   { transform: scale(1,1); }
        40%  { transform: scale(1.03,0.97); }
        70%  { transform: scale(0.99,1.01); }
        100% { transform: scale(1,1); }
      }
      @keyframes ql-appear {
        0%   { opacity:0; transform:scale(0.85); }
        60%  { opacity:1; transform:scale(1.04); }
        80%  { transform:scale(0.98); }
        100% { opacity:1; transform:scale(1); }
      }
      @keyframes ql-disappear {
        0%   { opacity:1; transform:scale(1); }
        100% { opacity:0; transform:scale(0.9); }
      }
      @keyframes ql-jiggle {
        0%   { transform:scale(1,1); }
        15%  { transform:scale(calc(1 + 0.04*var(--ql-jiggle-intensity,1)),calc(1 - 0.03*var(--ql-jiggle-intensity,1))); }
        30%  { transform:scale(calc(1 - 0.03*var(--ql-jiggle-intensity,1)),calc(1 + 0.025*var(--ql-jiggle-intensity,1))); }
        50%  { transform:scale(calc(1 + 0.015*var(--ql-jiggle-intensity,1)),calc(1 - 0.012*var(--ql-jiggle-intensity,1))); }
        70%  { transform:scale(calc(1 - 0.008*var(--ql-jiggle-intensity,1)),calc(1 + 0.006*var(--ql-jiggle-intensity,1))); }
        100% { transform:scale(1,1); }
      }
    `;
    document.head.appendChild(style);
  }
}
