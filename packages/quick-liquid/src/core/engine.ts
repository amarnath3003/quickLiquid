/**
 * quick-liquid/core/engine.ts — LIQUID GLASS ENGINE v7
 *
 * ┌────────────────────────────────────────────────────────────────┐
 * │  EXACT OPTICS MODEL                                            │
 * │                                                                │
 * │  The glass is a slab of thickness T lying on the backdrop.     │
 * │  Its top face is flat in the center and rolls off through a    │
 * │  convex bezel of width B at the edge (circular-arc profile):   │
 * │                                                                │
 * │      z(d) = T·√(s·(2−s)),  s = d/B   (d = distance from edge)  │
 * │                                                                │
 * │  A view ray (0,0,−1) hits the curved face and refracts by the  │
 * │  vector form of Snell's law (η = 1/ior):                       │
 * │                                                                │
 * │      t = η·v + (η·cosθi − cosθt)·n̂                             │
 * │                                                                │
 * │  then travels down through depth z(d) to the backdrop. The     │
 * │  lateral offset it accumulates is the refraction displacement: │
 * │                                                                │
 * │      Δ(s) = z(s) · |t_xy| / |t_z|         (points INWARD)      │
 * │                                                                │
 * │  Δ is zero at the rim (z→0), zero in the flat center (slope→0) │
 * │  and peaks inside the bezel band — the characteristic Apple    │
 * │  "clear center, bent rim" look falls out of the physics.       │
 * │                                                                │
 * │  KEY OPTIMIZATIONS (vs naive per-pixel raytrace)               │
 * │  1. Δ depends ONLY on s ⇒ 512-entry LUT, no per-pixel trig.    │
 * │  2. Interior is exactly neutral ⇒ Uint32 fill + bezel-band     │
 * │     iteration only (~perimeter·B px instead of w·h).           │
 * │  3. Field is odd under mirroring ⇒ compute one quadrant,       │
 * │     write four pixels.                                         │
 * │  4. Full-range 8-bit encoding: map normalized to Δmax, filter  │
 * │     scale = 2·Δmax ⇒ quantization step Δmax/127 px (~0.1px),   │
 * │     the minimum possible for 8-bit maps. Ordered dithering     │
 * │     converts the residual into invisible noise.                │
 * │  5. Chromatic aberration = per-channel LINEAR scale of the     │
 * │     same field ⇒ ONE map + three feDisplacementMap scale       │
 * │     attributes (not three maps).                               │
 * │  6. Maps are cached & refcounted by geometry key ⇒ N cards of  │
 * │     the same size share one map. Strength/CA changes only      │
 * │     touch `scale` attributes (no regeneration).                │
 * │                                                                │
 * │  LAYER STACK (bottom → top)                                    │
 * │   .ql-lens   z:0  backdrop-filter: url(#lens) saturate blur    │
 * │   .ql-tint   z:1  near-transparent material tint               │
 * │   .ql-sheen  z:2  bezel-band conic light sweep (soft)          │
 * │   .ql-rim    z:3  1.25px conic rim: 2 bright lobes at the      │
 * │                   light angle & its mirror — Apple signature   │
 * │   .ql-noise  z:5  optional micro-texture (off by default)      │
 * │   .ql-content z:10 children                                    │
 * └────────────────────────────────────────────────────────────────┘
 */

export interface LiquidGlassConfig {
  // Material system
  material?: 'clear' | 'thin' | 'regular' | 'thick' | 'ultra' | 'adaptive';

  // Frost & color
  blur: number;                 // backdrop blur px (center frost)
  saturation: number;           // backdrop saturation boost
  tint: string;                 // 'r, g, b'
  tintOpacity: number;

  // Refraction geometry (all in CSS px — physical!)
  refractionStrength: number;   // max rim displacement in px (0 disables)
  bezelWidth: number;           // width of the curved bezel band
  thickness: number;            // glass slab depth (shapes the falloff + shadow)
  ior: number;                  // index of refraction (1.4–1.6 = glass)

  // Chromatic aberration: 0..1 → per-channel dispersion of the SAME field
  chromaticAberration: number;

  // Lighting
  lightAngle: number;           // degrees, 0 = light from top
  edgeHighlight: number;        // crisp rim intensity 0..1
  specularStrength: number;     // bezel sheen intensity 0..1
  fresnelPower?: number;        // rim lobe sharpness (1 wide … 4 tight)

  // Interaction
  hoverLighting: boolean;
  cursorTracking: boolean;
  parallax: boolean;
  inertia: boolean;
  dynamicLighting: boolean;     // alias → cursorTracking

  // Depth
  elevation: number;            // shadow strength multiplier

  // Texture
  noiseOpacity: number;
  noiseScale: number;

  // Base
  borderRadius: number;
  quality: 'high' | 'medium' | 'low';
  refractionMode: 'auto' | 'svg' | 'css';

  // Appearance (dark-mode pass)
  // 'auto' follows prefers-color-scheme. Describes the backdrop BEHIND the
  // glass, not the OS — pass 'dark' explicitly for glass over a dark panel
  // inside a light page.
  appearance?: 'light' | 'dark' | 'auto';
  // 0 (black wallpaper) … 1 (white). When set, overrides the appearance-implied
  // value and drives rim/sheen intensity derivation. Hook for host apps that
  // sample their own wallpaper (roadmap §2.6).
  backdropLuminance?: number;

  // ── Legacy keys (v6) — accepted, mapped or ignored ──
  edgeBlurModifier?: number;    // ignored (single-pass lens now)
  adaptiveTint?: boolean;
  tintStrength?: number;
  environmentSampling?: 'none' | 'fast' | 'high-quality';
  distortionStrength?: number;  // alias of refractionStrength
  edgeDistortion?: number;      // ignored (physics-exact bezel now)
  caEdgeOnly?: boolean;         // ignored (CA is inherently edge-only now)
  shadowDiffusion?: number;
}

export const DEFAULT_CONFIG: LiquidGlassConfig = {
  blur: 3,
  saturation: 1.5,
  tint: '255, 255, 255',
  tintOpacity: 0.04,

  refractionStrength: 22,
  bezelWidth: 34,
  thickness: 24,
  ior: 1.5,

  chromaticAberration: 0.3,

  lightAngle: -35,
  edgeHighlight: 0.9,
  specularStrength: 0.42,
  fresnelPower: 2.2,

  // Off by default: a hover-triggered rim brightening reads as a broken
  // hover state in practice — light shouldn't change because a cursor
  // entered the element. Opt-in only.
  hoverLighting: false,
  cursorTracking: false,
  parallax: false,
  inertia: true,
  dynamicLighting: false,

  elevation: 1,

  noiseOpacity: 0,
  noiseScale: 1,

  borderRadius: 28,
  quality: 'high',
  refractionMode: 'auto',

  appearance: 'auto',

  tintStrength: 1,
};

/** Dark-appearance material tint (roadmap §1.3) — deep smoke, not gray.
    Used only when the config still carries the default white tint. */
const DARK_TINT = '20, 24, 34';

/** Backdrop luminance implied by appearance when not measured/configured. */
const LUMA_LIGHT = 0.80;
const LUMA_DARK = 0.10;

export const MATERIAL_PRESETS: Record<string, Partial<LiquidGlassConfig>> = {
  // Apple "clear" — transparent, strong lensing
  clear:   { blur: 2,  saturation: 1.55, tintOpacity: 0.03, refractionStrength: 26, bezelWidth: 36, thickness: 26 },
  thin:    { blur: 6,  saturation: 1.5,  tintOpacity: 0.05, refractionStrength: 18, bezelWidth: 26, thickness: 18 },
  // Apple "regular" — frosted, softer lensing
  regular: { blur: 14, saturation: 1.7,  tintOpacity: 0.09, refractionStrength: 16, bezelWidth: 30, thickness: 20 },
  thick:   { blur: 22, saturation: 1.8,  tintOpacity: 0.13, refractionStrength: 12, bezelWidth: 28, thickness: 18 },
  ultra:   { blur: 30, saturation: 1.85, tintOpacity: 0.17, refractionStrength: 10, bezelWidth: 26, thickness: 16 },
  adaptive:{ blur: 12, saturation: 1.6,  tintOpacity: 0.06, refractionStrength: 18, bezelWidth: 30, thickness: 20, adaptiveTint: true },
};

let uid = 0;

/* ════════════════════════════════════════════════════════════════
   REFRACTION LUT — the 1-D reduction.

   Everything about the displacement magnitude is a function of
   s = d/B alone (for fixed T, B, ior). We tabulate the EXACT
   Snell-traced Δ(s) once (512 samples), find Δmax analytically,
   and store the normalized curve. Per-pixel cost then collapses
   to: SDF → s → lerp(LUT).
   ════════════════════════════════════════════════════════════════ */
const LUT_N = 512;

function buildRefractionLUT(T: number, B: number, ior: number): { lut: Float32Array; maxDisp: number } {
  const lut = new Float32Array(LUT_N + 1);
  const eta = 1 / ior;
  let maxDisp = 0;

  for (let i = 0; i <= LUT_N; i++) {
    const s = i / LUT_N;
    if (s <= 0 || s >= 1) { lut[i] = 0; continue; }

    const root = Math.sqrt(s * (2 - s));       // √(s(2−s))
    const z = T * root;                         // glass depth at this s
    const slope = (T / B) * ((1 - s) / root);   // |dz/dd| — analytic derivative

    // Snell (vector form) for view ray (0,−1) vs normal tilted by slope σ
    const invL = 1 / Math.sqrt(1 + slope * slope);
    const cosI = invL;
    const sinI = slope * invL;
    const sinT = eta * sinI;
    const cosT = Math.sqrt(Math.max(0, 1 - sinT * sinT));
    const k = eta * cosI - cosT;                // < 0 entering denser medium
    const tXY = k * sinI;                       // lateral component (inward)
    const tZ = -eta + k * cosI;                 // downward component
    const disp = z * Math.abs(tXY / tZ);        // lateral walk through depth z

    lut[i] = disp;
    if (disp > maxDisp) maxDisp = disp;
  }

  if (maxDisp > 0) {
    for (let i = 0; i <= LUT_N; i++) lut[i] /= maxDisp;
  }
  return { lut, maxDisp };
}

/* 4×4 Bayer matrix, pre-scaled to ±0.5 LSB — ordered dithering */
const BAYER4 = (() => {
  const m = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  return new Float32Array(m.map(v => v / 16 - 0.46875)); // centered
})();

interface LensMap {
  url: string;
  maxDisp: number;   // physical Δmax in px for scale normalization
  refs: number;
  genMs: number;
  pixelsComputed: number;
}

/* Shared, refcounted displacement-map cache. Same-geometry elements
   (e.g. a grid of equal cards) share ONE map. */
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
 * Generate (or fetch from cache) the displacement map for a given geometry.
 *
 * Encoding: R = 128 + dx·127, G = 128 + dy·127 where (dx,dy) is the
 * normalized inward displacement. feDisplacementMap `scale` is set to
 * 2·Δmax·userScale by the caller, so the full 8-bit range is used —
 * quantization error = Δmax/127 px, the theoretical minimum.
 */
function acquireLensMap(
  w: number, h: number, radius: number,
  bezel: number, thickness: number, ior: number,
  resCap: number,
): Promise<{ map: LensMap; key: string }> {
  const rho = Math.min(1, resCap / Math.max(w, h));
  const mw = Math.max(4, Math.round(w * rho));
  const mh = Math.max(4, Math.round(h * rho));
  const key = `${mw}x${mh}|${w}x${h}|r${radius}|b${bezel}|t${thickness}|n${ior}`;

  const hit = mapCache.get(key);
  if (hit) {
    if (hit instanceof Promise) return hit.then(m => { m.refs++; return { map: m, key }; });
    hit.refs++;
    return Promise.resolve({ map: hit, key });
  }

  const promise = generateLensMap(mw, mh, w, h, radius, bezel, thickness, ior).then(m => {
    mapCache.set(key, m);
    return m;
  });
  mapCache.set(key, promise);
  return promise.then(m => { m.refs++; return { map: m, key }; });
}

function generateLensMap(
  mw: number, mh: number, elW: number, elH: number,
  radiusEl: number, bezelEl: number, thicknessEl: number, ior: number,
): Promise<LensMap> {
  const t0 = performance.now();

  // Work in map space; convert geometry from element px
  const sx = mw / elW;
  const sy = mh / elH;
  const s = Math.min(sx, sy);
  const minDim = Math.min(elW, elH);
  const rd = Math.min(radiusEl, minDim / 2) * s;
  // Clamp bezel to the half-min-dimension so pills become full domes
  // with zero slope at the medial axis (no ridge artifact).
  const B = Math.min(bezelEl, minDim / 2) * s;
  const T = thicknessEl * s;

  const { lut, maxDisp } = buildRefractionLUT(T, B, ior);

  const canvas = document.createElement('canvas');
  canvas.width = mw;
  canvas.height = mh;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(mw, mh);
  const buf32 = new Uint32Array(img.data.buffer);

  // 1) Fill everything neutral (128,128,0,255) — one memset-speed pass.
  //    Little-endian RGBA in Uint32 = 0xAABBGGRR.
  buf32.fill(0xff008080);

  const cx = mw / 2;
  const cy = mh / 2;
  const band = B + 1.5; // px past the bezel we still evaluate
  const qw = Math.ceil(cx);
  const qh = Math.ceil(cy);
  let computed = 0;

  // 2) Quadrant + band-limited iteration. For a quadrant pixel (x,y),
  //    inside-distance d ≤ min(x,y)+0.5, so rows/cols beyond the band
  //    (outside corner circles) are provably neutral — skipped wholesale.
  const cornerSpan = Math.max(band, rd);
  for (let py = 0; py < qh; py++) {
    const ey = py + 0.5;
    const rowInBand = ey <= band;
    const xLimit = rowInBand ? qw : Math.min(qw, Math.ceil(ey <= cornerSpan ? cornerSpan : band));

    for (let px = 0; px < xLimit; px++) {
      const ex = px + 0.5;

      // Analytic rounded-rect SDF + gradient (outward unit normal m̂).
      // Quadrant pixel → offset into the top-left corner circle zone:
      // qx > 0 ⟺ ex < rd (inside the corner square horizontally).
      const qx = rd - ex;
      const qy = rd - ey;
      let d: number;      // inside distance from boundary
      let mx: number;     // outward normal (element/map space)
      let my: number;
      if (qx > 0 && qy > 0) {
        const len = Math.hypot(qx, qy);
        d = rd - len;
        if (len > 1e-6) { mx = -qx / len; my = -qy / len; }
        else { mx = -0.7071; my = -0.7071; }
      } else if (qx > qy) {
        d = rd - qx; mx = -1; my = 0;   // left edge nearest
      } else {
        d = rd - qy; mx = 0; my = -1;   // top edge nearest
      }

      if (d <= 0 || d >= B) continue; // outside shape or flat center → neutral

      computed++;

      // LUT lookup with linear interpolation
      const fs = (d / B) * LUT_N;
      const i0 = fs | 0;
      const frac = fs - i0;
      const disp = lut[i0] + (lut[i0 + 1] - lut[i0]) * frac; // normalized 0..1

      // Displacement points INWARD (−m̂): thick glass magnifies.
      const dx = -mx * disp;
      const dy = -my * disp;

      // Ordered dither (±0.5 LSB) — kills banding at zero perceptual cost
      const dth = BAYER4[(px & 3) + ((py & 3) << 2)];
      const r1 = clamp8(128 + dx * 127 + dth);
      const g1 = clamp8(128 + dy * 127 + dth);
      const r2 = clamp8(128 - dx * 127 + dth); // x-mirrored
      const g2 = clamp8(128 - dy * 127 + dth); // y-mirrored

      const xm = mw - 1 - px;
      const ym = mh - 1 - py;
      // 4-fold symmetry: write all four quadrants at once
      buf32[py * mw + px] = 0xff000000 | (g1 << 8) | r1;
      buf32[py * mw + xm] = 0xff000000 | (g1 << 8) | r2;
      buf32[ym * mw + px] = 0xff000000 | (g2 << 8) | r1;
      buf32[ym * mw + xm] = 0xff000000 | (g2 << 8) | r2;
    }
  }

  ctx.putImageData(img, 0, 0);
  const genMs = performance.now() - t0;

  return new Promise<LensMap>((resolve) => {
    canvas.toBlob((blob) => {
      const url = blob ? URL.createObjectURL(blob) : canvas.toDataURL('image/png');
      resolve({ url, maxDisp, refs: 0, genMs, pixelsComputed: computed });
    }, 'image/png');
  });
}

function clamp8(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v | 0;
}

/* ════════════════════════════════════════════════════════════════
   ENGINE
   ════════════════════════════════════════════════════════════════ */
export class LiquidGlassEngine {
  private el: HTMLElement;
  private cfg: LiquidGlassConfig;
  public id: string;

  private lensLayer: HTMLDivElement | null = null;
  private tintLayer: HTMLDivElement | null = null;
  private sheenLayer: HTMLDivElement | null = null;
  private rimLayer: HTMLDivElement | null = null;
  private noiseLayer: HTMLDivElement | null = null;

  private svgEl: SVGSVGElement | null = null;
  private dispNodes: SVGFEDisplacementMapElement[] = [];
  private mapRefKey: string | null = null;
  private lensMap: LensMap | null = null;

  private resizeObs: ResizeObserver | null = null;
  private resizeRaf: number | null = null;
  private lastW = 0;
  private lastH = 0;
  private destroyed = false;
  private rafId: number | null = null;
  private animatingLight = false;
  private lensBuildVersion = 0;

  // Motion state (spring-smoothed)
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

  // Dark-mode: live prefers-color-scheme tracking for appearance: 'auto'
  private schemeQuery: MediaQueryList | null = null;
  private schemeListener: (() => void) | null = null;

  private static _registry = new Set<LiquidGlassEngine>();

  /** Aggregate metrics across all live engines (also exposed on
      globalThis.__QUICK_LIQUID__ for tooling/debugging). */
  static collectMetrics() {
    const engines = [...LiquidGlassEngine._registry].map(e => ({
      id: e.id,
      size: `${e.lastW}x${e.lastH}`,
      mapGenMs: e._mapGenMs,
      mapPixelsComputed: e._mapPixels,
      mapKey: e.mapRefKey,
      quality: e.cfg.quality,
    }));
    return {
      engineCount: engines.length,
      uniqueMaps: mapCache.size,
      engines,
    };
  }

  constructor(element: HTMLElement, config: Partial<LiquidGlassConfig> = {}) {
    this.el = element;
    this.cfg = LiquidGlassEngine.resolveConfig(config);
    this.id = `ql${++uid}`;
    this.currentAngle = this.cfg.lightAngle;
    this.targetAngle = this.cfg.lightAngle;
    LiquidGlassEngine._registry.add(this);
    if (typeof globalThis !== 'undefined' && !(globalThis as any).__QUICK_LIQUID__) {
      (globalThis as any).__QUICK_LIQUID__ = { metrics: () => LiquidGlassEngine.collectMetrics() };
    }
    this.mount();
  }

  private static resolveConfig(config: Partial<LiquidGlassConfig>): LiquidGlassConfig {
    let merged: LiquidGlassConfig = { ...DEFAULT_CONFIG, ...config };
    if (merged.material && MATERIAL_PRESETS[merged.material]) {
      merged = { ...DEFAULT_CONFIG, ...MATERIAL_PRESETS[merged.material], ...config };
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
    // CRITICAL: never set `isolation: isolate` (or filter/opacity/mask) on the
    // host — any of those induce a *backdrop root* (Filter Effects L2), which
    // cuts the page background out of the child's backdrop-filter sampling
    // and silently disables the refraction.

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

  /** Backdrop luminance 0..1 — explicit config wins, else implied by appearance. */
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
        // Appearance flips: restyle tint/rings/shadow — geometry (maps) unchanged.
        this.updateTint();
        this.updateRings();
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
      this.updateRings(); // bezel clamp depends on element size
      void this.rebuildLensFilter();
    });
  }

  private createLayers(): void {
    // Remove any stale layers (rebuild path)
    [this.lensLayer, this.tintLayer, this.sheenLayer, this.rimLayer, this.noiseLayer]
      .forEach(l => l?.remove());

    // CHROMIUM QUIRK #2: an explicit z-index on the backdrop-filter layer
    // (which forces a stacking context) silently disables the url() filter
    // part in real-world nesting. NO z-index on any glass layer — stacking
    // is controlled purely by DOM order (lens first … content last).
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
    this.tintLayer = mk('ql-tint');
    this.sheenLayer = mk('ql-sheen');
    this.rimLayer = mk('ql-rim');
    this.noiseLayer = mk('ql-noise');

    const content = this._contentEl();
    for (const layer of [this.lensLayer, this.tintLayer, this.sheenLayer, this.rimLayer, this.noiseLayer]) {
      this.el.insertBefore(layer, content);
    }

    this.updateLensStyle();
    this.updateTint();
    this.updateRings();
    this.updateNoise();
  }

  private _contentEl(): Element | null {
    return this.el.querySelector(':scope > .ql-content');
  }

  /* ─────────────────── LAYER 0: LENS (backdrop) ─────────────────── */
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
   * CHROMIUM QUIRK: if backdrop-filter is first applied WITHOUT a url()
   * reference and the url() is added later on the same element, the SVG
   * filter part stays permanently inert (blur/saturate still apply). The
   * url() must be present the moment the element first gets composited.
   * Therefore: whenever the url() reference part changes, we swap in a
   * brand-new lens node with the final filter string already set.
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
      this.lensLayer.replaceWith(fresh);
      this.lensLayer = fresh;
      this.lensFilterRef = ref;
    } else {
      this.lensLayer.style.backdropFilter = bdf;
      (this.lensLayer.style as any).WebkitBackdropFilter = bdf;
    }
  }

  /* ─────────────────── LAYER 1: TINT ─────────────────── */
  private updateTint(): void {
    if (!this.tintLayer) return;
    const cfg = this.cfg;
    // Dark backdrop: the default white tint reads as a gray film — swap it for
    // deep smoke and thicken slightly (Apple's dark glass is smokier). An
    // explicitly configured (non-default) tint always wins. Whitespace-
    // insensitive: '255,255,255' and '255, 255, 255' are the same default.
    const autoDark = this.isDark() &&
      cfg.tint.replace(/\s/g, '') === DEFAULT_CONFIG.tint.replace(/\s/g, '');
    const tint = autoDark ? DARK_TINT : cfg.tint;
    const op = cfg.tintOpacity * (cfg.tintStrength ?? 1) * (autoDark ? 1.75 : 1);
    if (op <= 0) {
      this.tintLayer.style.background = 'none';
      return;
    }
    // Flat material tint + a whisper of vertical light falloff.
    this.tintLayer.style.background = [
      `linear-gradient(180deg,
        rgba(${tint}, ${(op * 1.2).toFixed(4)}) 0%,
        rgba(${tint}, ${(op * 0.85).toFixed(4)}) 100%)`,
    ].join(', ');
    this.tintLayer.style.mixBlendMode = cfg.adaptiveTint ? 'overlay' : 'normal';
  }

  /* ─────────────── LAYERS 2+3: CONIC LIGHT RINGS ───────────────
     The Apple signature: the rim catches light in TWO lobes — at
     the light angle and its mirror (glass reflects on the near and
     far bezel). Implemented as conic gradients masked to rings:
       .ql-rim   — crisp ~1.3px ring, strong lobes
       .ql-sheen — bezel-band-wide ring, soft lobes + dark flanks   */
  private ringMask(padPx: number): Partial<CSSStyleDeclaration> {
    // Ring = border-box minus content-box, via mask-composite: exclude.
    // Longhands only: the -webkit-mask shorthand aliases `mask` in Blink
    // and would clobber the composite mode.
    return {
      boxSizing: 'border-box',
      padding: `${padPx}px`,
      maskImage: 'linear-gradient(#000 0 0), linear-gradient(#000 0 0)',
      maskClip: 'content-box, border-box',
      maskComposite: 'exclude',
    } as Partial<CSSStyleDeclaration>;
  }

  private conicStops(
    angleDeg: number, power: number,
    peakA: number, baseA: number, darkA: number,
  ): string {
    // I(θ) = base + peak·|cos(θ−θL)|^p  (white)  −  dark·|sin(θ−θL)|^2 (flanks)
    const stops: string[] = [];
    const STEP = 10;
    for (let a = 0; a <= 360; a += STEP) {
      const rel = ((a - angleDeg) * Math.PI) / 180;
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

  private updateRings(): void {
    const cfg = this.cfg;
    const angle = this.currentAngle;
    const p = Math.max(1, Math.min(6, cfg.fresnelPower ?? 2.2));
    const glow = 1 + 0.3 * this.currentHoverGlow;

    // Luminance-derived intensity (roadmap §1.3): a white rim pops far harder
    // against a dark backdrop (higher perceived contrast) and the wide sheen
    // wash reads as gray film — ease both down as the backdrop darkens. At the
    // light-scene luminance (0.8) both scales ≈ 1, so light tuning is unchanged.
    const L = this.backdropLuma();
    const rimScale = 0.55 + 0.56 * L;    // L=0.1 → 0.61: crisp, not neon
    const sheenScale = 0.35 + 0.81 * L;  // L=0.1 → 0.43: no milky wash

    if (this.rimLayer) {
      const hi = cfg.edgeHighlight * glow * rimScale;
      // Dark: raise the uniform base term a touch so the full edge hairline
      // stays defined where the lobes fade (Apple's dark glass keeps it).
      const base = 0.16 + 0.10 * Math.max(0, LUMA_LIGHT - L);
      Object.assign(this.rimLayer.style, this.ringMask(1.25));
      this.rimLayer.style.background = this.conicStops(angle, p, hi * 0.85, hi * base, 0);
    }

    if (this.sheenLayer) {
      const sp = cfg.specularStrength * glow * sheenScale;
      const bezel = Math.min(cfg.bezelWidth, Math.min(this.lastW || 999, this.lastH || 999) / 2);
      Object.assign(this.sheenLayer.style, this.ringMask(Math.max(4, bezel)));
      this.sheenLayer.style.background = [
        this.conicStops(angle, p * 0.75, sp * 0.28, sp * 0.02, sp * 0.14),
      ].join(', ');
      // Soft inner falloff so the sheen fades toward the bezel's inner edge
      this.sheenLayer.style.filter = 'blur(3px)';
    }
  }

  /* ─────────────────── NOISE ─────────────────── */
  private updateNoise(): void {
    if (!this.noiseLayer) return;
    const cfg = this.cfg;
    if (cfg.noiseOpacity <= 0) {
      this.noiseLayer.style.backgroundImage = 'none';
      this.noiseLayer.style.opacity = '0';
      return;
    }
    const noiseSvg = `data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E`;
    Object.assign(this.noiseLayer.style, {
      backgroundImage: `url("${noiseSvg}")`,
      opacity: String(cfg.noiseOpacity),
      backgroundSize: `${100 * cfg.noiseScale}px ${100 * cfg.noiseScale}px`,
      mixBlendMode: 'overlay',
    });
  }

  /* ─────────────────── SHADOW ─────────────────── */
  private applyDepth(): void {
    const e = this.cfg.elevation;
    if (e <= 0) { this.el.style.boxShadow = 'none'; return; }
    const t = Math.max(1, this.cfg.thickness / 8);
    if (this.isDark()) {
      // Shadow → glow swap (roadmap §1.3): a gray drop shadow vanishes on a
      // dark wallpaper. Depth cue becomes a cool ambient halo (light bleeding
      // through the slab) + near-black shadows dense enough to read on dark.
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
    if (LiquidGlassEngine._svgOk === null) {
      LiquidGlassEngine._svgOk = this.detectSVGSupport();
    }
    return LiquidGlassEngine._svgOk;
  }

  private detectSVGSupport(): boolean {
    if (typeof document === 'undefined') return false;
    // Live DOM probe — CSS.supports() lies about backdrop-filter: url().
    try {
      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg') as SVGSVGElement;
      svg.setAttribute('width', '0');
      svg.setAttribute('height', '0');
      svg.style.cssText = 'position:absolute;overflow:hidden;pointer-events:none;';
      const defs = document.createElementNS(svgNS, 'defs');
      const filter = document.createElementNS(svgNS, 'filter') as SVGFilterElement;
      filter.id = '__ql_probe__';
      defs.appendChild(filter);
      svg.appendChild(defs);
      document.body.appendChild(svg);

      const probe = document.createElement('div');
      probe.style.cssText =
        'position:fixed;top:0;left:0;width:1px;height:1px;' +
        'backdrop-filter:url(#__ql_probe__);-webkit-backdrop-filter:url(#__ql_probe__);pointer-events:none;';
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

  /** Per-channel dispersion scales. Blue refracts more than red in real
      glass; sampling is inward so blue gets the LARGER scale. */
  private channelScales(): { r: number; g: number; b: number; base: number } {
    const M = this.lensMap?.maxDisp || 1;
    // Full-range encoding ⇒ scale 2·target reproduces `target` px at the rim.
    const base = 2 * this.cfg.refractionStrength * (M > 0 ? 1 : 0);
    const ca = this.cfg.chromaticAberration;
    return {
      base,
      r: base * (1 - ca * 0.10),
      g: base,
      b: base * (1 + ca * 0.14),
    };
  }

  private async rebuildLensFilter(): Promise<void> {
    const buildVersion = ++this.lensBuildVersion;
    const cfg = this.cfg;

    if (!this.shouldUseSVG() || cfg.refractionStrength <= 0) {
      this.teardownFilter();
      this.updateLensStyle();
      return;
    }

    const w = this.el.offsetWidth || this.lastW || 200;
    const h = this.el.offsetHeight || this.lastH || 100;
    if (w < 8 || h < 8) return;

    const resCap = cfg.quality === 'low' ? 128 : cfg.quality === 'medium' ? 384 : 1024;
    const radius = Math.round(Math.min(cfg.borderRadius, Math.min(w, h) / 2));

    const { map, key } = await acquireLensMap(w, h, radius, cfg.bezelWidth, cfg.thickness, cfg.ior, resCap);
    if (this.destroyed || buildVersion !== this.lensBuildVersion) {
      releaseMap(key); // a newer rebuild superseded us — hand the ref back
      return;
    }

    // Swap map refs (drop duplicate if geometry key is unchanged)
    if (this.mapRefKey === key) {
      releaseMap(key);
    } else {
      if (this.mapRefKey) releaseMap(this.mapRefKey);
      this.mapRefKey = key;
    }
    this.lensMap = map;
    this._mapGenMs = map.genMs;
    this._mapPixels = map.pixelsComputed;

    this.buildFilterDOM(w, h, map.url);
    // Force a fresh lens node: the old <svg> was replaced, and Chromium only
    // resolves url() references reliably on newly-composited elements.
    this.lensFilterRef = '__stale__';
    this.updateLensStyle();
  }

  private teardownFilter(): void {
    if (this.svgEl) { this.svgEl.remove(); this.svgEl = null; }
    this.dispNodes = [];
    if (this.mapRefKey) { releaseMap(this.mapRefKey); this.mapRefKey = null; }
    this.lensMap = null;
  }

  private buildFilterDOM(w: number, h: number, mapUrl: string): void {
    if (this.svgEl) { this.svgEl.remove(); this.svgEl = null; }
    this.dispNodes = [];

    const { r, g, b, base } = this.channelScales();
    const useCA = this.cfg.chromaticAberration > 0.01 && this.cfg.quality !== 'low';
    const pad = Math.ceil(base / 2) + 4;

    let content: string;
    if (useCA) {
      // ONE map, three scales — dispersion is linear in the field.
      content = `
        <feImage href="${mapUrl}" result="map" preserveAspectRatio="none" x="0" y="0" width="${w}" height="${h}"/>
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
        <feImage href="${mapUrl}" result="map" preserveAspectRatio="none" x="0" y="0" width="${w}" height="${h}"/>
        <feDisplacementMap in="SourceGraphic" in2="map" scale="${g.toFixed(2)}" xChannelSelector="R" yChannelSelector="G"/>`;
    }

    const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute;overflow:hidden;pointer-events:none">
      <defs>
        <filter id="${this.id}" filterUnits="userSpaceOnUse"
          x="${-pad}" y="${-pad}" width="${w + 2 * pad}" height="${h + 2 * pad}"
          color-interpolation-filters="sRGB">${content}</filter>
      </defs>
    </svg>`;

    const div = document.createElement('div');
    div.innerHTML = svgStr.trim();
    this.svgEl = div.querySelector('svg')!;
    document.body.appendChild(this.svgEl);
    this.dispNodes = Array.from(this.svgEl.querySelectorAll('feDisplacementMap'));
  }

  /** Surgical update: strength/CA changes only rewrite `scale` attributes. */
  private updateFilterScales(): void {
    if (!this.svgEl || this.dispNodes.length === 0) return;
    const { r, g, b } = this.channelScales();
    if (this.dispNodes.length === 3) {
      this.dispNodes[0].setAttribute('scale', r.toFixed(2));
      this.dispNodes[1].setAttribute('scale', g.toFixed(2));
      this.dispNodes[2].setAttribute('scale', b.toFixed(2));
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

  private kickLight(): void {
    if (!this.animatingLight) { this.animatingLight = true; this.tickLight(); }
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
      return;
    }

    const dt = performance.now() - t0;
    this._lastTime = dt;
    this._totalTime += dt;
    this._frameCount++;
    this.rafId = requestAnimationFrame(() => this.tickLight());
  }

  /* ─────────────────── ANIMATIONS (public) ─────────────────── */
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
    LiquidGlassEngine.injectAnimationStyles();
  }

  animateIn(delay = 0): void {
    LiquidGlassEngine.injectAnimationStyles();
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
    LiquidGlassEngine.injectAnimationStyles();
    return new Promise(resolve => {
      this.el.style.animation = `ql-disappear 0.35s cubic-bezier(0.4,0,1,1) forwards`;
      this.el.addEventListener('animationend', () => {
        this.el.style.animation = '';
        resolve();
      }, { once: true });
    });
  }

  jiggle(intensity = 1): void {
    LiquidGlassEngine.injectAnimationStyles();
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
    };
  }

  updateConfig(config: Partial<LiquidGlassConfig>): void {
    if (this.destroyed) return;
    const oldCfg = this.cfg;
    this.cfg = LiquidGlassEngine.resolveConfig({ ...this.stripDefaults(oldCfg), ...config });

    const cfg = this.cfg;
    const geometryChanged =
      oldCfg.borderRadius !== cfg.borderRadius ||
      oldCfg.bezelWidth !== cfg.bezelWidth ||
      oldCfg.thickness !== cfg.thickness ||
      oldCfg.ior !== cfg.ior ||
      oldCfg.quality !== cfg.quality ||
      oldCfg.refractionMode !== cfg.refractionMode ||
      (oldCfg.refractionStrength <= 0) !== (cfg.refractionStrength <= 0);

    const caStructureChanged =
      (oldCfg.chromaticAberration > 0.01) !== (cfg.chromaticAberration > 0.01);

    this.el.style.borderRadius = `${cfg.borderRadius}px`;

    if (geometryChanged || caStructureChanged) {
      void this.rebuildLensFilter();
    } else if (
      oldCfg.refractionStrength !== cfg.refractionStrength ||
      oldCfg.chromaticAberration !== cfg.chromaticAberration
    ) {
      this.updateFilterScales(); // zero-cost path for sliders
    }

    this.updateLensStyle();
    this.updateTint();
    this.updateRings();
    this.updateNoise();
    this.applyDepth();
    this.syncPointerListeners();
    this.syncSchemeListener();
  }

  /** Return only the keys that differ from DEFAULT_CONFIG so material
      presets keep working across updateConfig merges. */
  private stripDefaults(cfg: LiquidGlassConfig): Partial<LiquidGlassConfig> {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(cfg) as (keyof LiquidGlassConfig)[]) {
      if (cfg[k] !== DEFAULT_CONFIG[k]) out[k as string] = cfg[k];
    }
    return out as Partial<LiquidGlassConfig>;
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
    LiquidGlassEngine._registry.delete(this);
    this.lensBuildVersion++;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.resizeRaf) cancelAnimationFrame(this.resizeRaf);
    this.resizeObs?.disconnect();
    this.teardownFilter();
    [this.lensLayer, this.tintLayer, this.sheenLayer, this.rimLayer, this.noiseLayer]
      .forEach(l => l?.remove());
    this.lensLayer = this.tintLayer = this.sheenLayer = this.rimLayer = this.noiseLayer = null;

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
    if (LiquidGlassEngine._stylesInjected) return;
    LiquidGlassEngine._stylesInjected = true;
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
