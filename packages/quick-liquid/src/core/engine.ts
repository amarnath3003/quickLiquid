import { DEFAULT_CONFIG, resolveGlassConfig, type LiquidGlassConfig } from './config';
import { rasterizeLens, usesDispersion, filterPadding } from './optics';
export { DEFAULT_CONFIG, MATERIAL_PRESETS, type LiquidGlassConfig } from './config';
const DARK_TINT = '20, 24, 34';
const LUMA_LIGHT = 0.80, LUMA_DARK = 0.10;

let uid = 0;

/* ════════════════════════════════════════════════════════════════
   REFRACTION LUT — the 1-D reduction.

   Everything about the displacement magnitude is a function of
   s = d/B alone (for fixed T, B, ior). We tabulate the
   Snell-traced Δ(s) once (512 samples), normalize by its sampled peak,
   and store the normalized curve. Per-pixel cost then collapses
   to: SDF → s → lerp(LUT).
   ════════════════════════════════════════════════════════════════ */
interface LensMap {
  url: string; genMs: number; encodeMs: number; pixelsComputed: number;
  width: number; height: number; padX: number; padY: number; mapWidth: number; mapHeight: number;
}
interface MapEntry { refs: number; promise: Promise<LensMap>; map?: LensMap }
const mapCache = new Map<string, MapEntry>();
let cacheHits = 0, mapsGenerated = 0;
function releaseMap(key: string): void {
  const entry = mapCache.get(key);
  if (!entry) return;
  entry.refs--;
  if (entry.refs === 0 && entry.map) {
    URL.revokeObjectURL(entry.map.url);
    mapCache.delete(key);
  }
}
function acquireLensMap(
  w: number, h: number, radius: number, bezel: number, thickness: number, ior: number,
  resCap: number, blur: number,
): Promise<{ map: LensMap; key: string }> {
  // Keep high quality pixel-dense; medium intentionally trades resolution for cost.
  const rho = Math.min(1, resCap / Math.max(w, h));
  const mw = Math.max(4, Math.round(w * rho)), mh = Math.max(4, Math.round(h * rho));
  const padding = filterPadding(blur);
  const key = [w, h, mw, mh, radius, bezel, thickness, ior, padding].join('|');
  let entry = mapCache.get(key);
  if (entry) { entry.refs++; cacheHits++; }
  else {
    const t0 = performance.now();
    const raster = rasterizeLens({ width: w, height: h, radius, bezel, thickness, ior, mapWidth: mw, mapHeight: mh, padding });
    const canvas = document.createElement('canvas');
    canvas.width = raster.width; canvas.height = raster.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return Promise.reject(new Error('Canvas 2D unavailable'));
    ctx.putImageData(new ImageData(raster.data, raster.width, raster.height), 0, 0);
    const genMs = performance.now() - t0, encodeStart = performance.now();
    mapsGenerated++;
    entry = { refs: 1, promise: new Promise<LensMap>((resolve, reject) => {
      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('Unable to encode refraction map')); return; }
        const { data: _data, ...dimensions } = raster;
        resolve({ ...dimensions, url: URL.createObjectURL(blob), genMs, encodeMs: performance.now() - encodeStart });
      }, 'image/png');
    }) };
    const owned = entry;
    entry.promise = entry.promise.then(map => {
      owned.map = map;
      // Reservations are made BEFORE awaiting, so a stale waiter cannot revoke
      // a URL that another pending consumer still owns.
      return map;
    }, error => { if (mapCache.get(key) === owned) mapCache.delete(key); throw error; });
    mapCache.set(key, entry);
  }
  return entry.promise.then(map => ({ map, key }));
}

export class LiquidGlassEngine {
  private el: HTMLElement;
  private cfg: LiquidGlassConfig;
  private overrides: Partial<LiquidGlassConfig>;
  private originalStyle: Map<string, [string, string]>;
  private ownedContent: HTMLDivElement | null = null;
  private rimDisk: HTMLDivElement | null = null;
  private sheenDisk: HTMLDivElement | null = null;
  private motionQuery: MediaQueryList | null = null;
  private transparencyQuery: MediaQueryList | null = null;
  private animations = new Set<Animation>();
  private animationTimers = new Set<ReturnType<typeof setTimeout>>();
  private lastLightTick = 0;
  private _lightBakes = 0;
  private _filterBuilds = 0;
  private _mapError: string | null = null;
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
  private pressHandlers: { down: (event: PointerEvent) => void; up: () => void; leave: () => void; reset: () => void } | null = null;

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
      dispTaps: e.dispNodes.length,
      mapEncodeMs: e.lensMap?.encodeMs ?? 0,
      mapBytes: e.lensMap ? e.lensMap.width * e.lensMap.height * 4 : 0,
      lightBakes: e._lightBakes, filterBuilds: e._filterBuilds,
      mapError: e._mapError,
    }));
    return {
      engineCount: engines.length,
      uniqueMaps: mapCache.size,
      cacheHits, mapsGenerated,
      engines,
    };
  }

  constructor(element: HTMLElement, config: Partial<LiquidGlassConfig> = {}) {
    this.el = element;
    this.overrides = { ...config };
    this.cfg = resolveGlassConfig(this.overrides);
    this.originalStyle = new Map(['position', 'border-radius', 'overflow', 'box-shadow', 'transform', 'opacity', 'animation', 'transition', 'visibility']
      .map(key => [key, [element.style.getPropertyValue(key), element.style.getPropertyPriority(key)]]));
    this.id = `ql${++uid}`;
    this.currentAngle = this.cfg.lightAngle;
    this.targetAngle = this.cfg.lightAngle;
    LiquidGlassEngine._registry.add(this);
    if (typeof globalThis !== 'undefined' && !(globalThis as any).__QUICK_LIQUID__) {
      (globalThis as any).__QUICK_LIQUID__ = { metrics: () => LiquidGlassEngine.collectMetrics() };
    }
    this.mount();
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

    // React supplies this wrapper; vanilla users get the same content stacking.
    if (!this._contentEl()) {
      this.ownedContent = document.createElement('div');
      this.ownedContent.className = 'ql-content';
      this.ownedContent.style.cssText = 'position:relative;z-index:10';
      this.ownedContent.append(...Array.from(el.childNodes));
      el.append(this.ownedContent);
    }
    this.motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
    this.transparencyQuery = matchMedia('(prefers-reduced-transparency: reduce)');
    this.motionQuery.addEventListener('change', this.onPreferences);
    this.transparencyQuery.addEventListener('change', this.onPreferences);
    this.createLayers();
    this.applyDepth();
    this.queueRebuild();

    this.resizeObs = new ResizeObserver(() => this.onResize());
    this.resizeObs.observe(el);
    document.addEventListener('visibilitychange', this.onVisibility);

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
        this.bakeLight();
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

  private reduceMotion(): boolean { return this.cfg.respectPreferences !== false && !!this.motionQuery?.matches; }
  private reduceTransparency(): boolean { return this.cfg.respectPreferences !== false && !!this.transparencyQuery?.matches; }
  private onVisibility = (): void => {
    if (document.hidden) this.stopLight();
  };
  private onPreferences = (): void => {
    if (this.destroyed) return;
    if (this.reduceMotion()) {
      this.stopLight();
      this.cancelAnimations();
      this.currentAngle = this.targetAngle = this.cfg.lightAngle;
      this.currentHoverGlow = this.targetHoverGlow = 0;
      this.el.style.transform = this.originalStyle.get('transform')![0];
      this.el.style.visibility = this.originalStyle.get('visibility')![0];
    }
    this.syncPointerListeners();
    this.queueRebuild();
    this.updateTint(); this.bakeLight(); this.updateRings();
  };
  private stopLight(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null; this.animatingLight = false; this.lastLightTick = 0;
    this.angleVelocity = this.parallaxXVelocity = this.parallaxYVelocity = this.hoverGlowVelocity = 0;
  }
  private queueRebuild(): void {
    ++this.lensBuildVersion; // invalidate an in-flight encode immediately
    if (this.resizeRaf !== null || this.destroyed) return;
    this.resizeRaf = requestAnimationFrame(() => {
      this.resizeRaf = null;
      if (this.destroyed) return;
      this.sizeLight(); this.bakeLight(); this.updateRings();
      void this.rebuildLensFilter().catch(error => {
        if (this.destroyed) return;
        this._mapError = String(error);
        this.teardownFilter(); this.updateLensStyle();
      });
    });
  }
  private onResize(): void {
    if (this.destroyed) return;
    const w = this.el.offsetWidth, h = this.el.offsetHeight;
    if (w === this.lastW && h === this.lastH) return;
    this.lastW = w; this.lastH = h;
    this.queueRebuild();
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
      div.setAttribute('aria-hidden', 'true');
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
    this.noiseLayer = null;
    this.rimDisk = document.createElement('div');
    this.sheenDisk = document.createElement('div');
    this.rimLayer.append(this.rimDisk);
    this.sheenLayer.append(this.sheenDisk);

    const content = this._contentEl();
    for (const layer of [this.lensLayer, this.tintLayer, this.sheenLayer, this.rimLayer, this.noiseLayer]) {
      if (layer) this.el.insertBefore(layer, content);
    }

    this.updateLensStyle();
    this.updateTint();
    this.sizeLight(); this.bakeLight(); this.updateRings();
    this.updateNoise();
  }

  private _contentEl(): Element | null {
    return this.el.querySelector(':scope > .ql-content');
  }

  /* ─────────────────── LAYER 0: LENS (backdrop) ─────────────────── */
  private lensFilterRef: string | null = null;

  private lensFilterString(): string {
    const cfg = this.cfg;
    if (this.reduceTransparency()) return 'none';
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
    const ref = this.svgEl && !this.reduceTransparency() ? this.id : null;

    if (ref !== this.lensFilterRef) {
      const fresh = document.createElement('div');
      fresh.className = 'ql-lens';
      fresh.setAttribute('aria-hidden', 'true');
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
    const op = this.reduceTransparency() ? 1 : cfg.tintOpacity * (cfg.tintStrength ?? 1) * (autoDark ? 1.75 : 1);
    if (op <= 0) {
      this.tintLayer.style.background = 'none';
      return;
    }
    // Flat material tint + a whisper of vertical light falloff.
    this.tintLayer.style.background = [
      `linear-gradient(180deg,
        rgba(${tint}, ${(this.reduceTransparency() ? 1 : op * 1.2).toFixed(4)}) 0%,
        rgba(${tint}, ${(this.reduceTransparency() ? 1 : op * 0.85).toFixed(4)}) 100%)`,
    ].join(', ');
    this.tintLayer.style.mixBlendMode = cfg.adaptiveTint && !this.reduceTransparency() ? 'overlay' : 'normal';
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
    const STEP = 4;
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

  private sizeLight(): void {
    const diameter = Math.ceil(Math.hypot(this.lastW, this.lastH)) + 4;
    const bezel = Math.min(this.cfg.bezelWidth, this.lastW / 2, this.lastH / 2);
    if (this.rimLayer) Object.assign(this.rimLayer.style, this.ringMask(1), { overflow: 'hidden' });
    if (this.sheenLayer) Object.assign(this.sheenLayer.style, this.ringMask(Math.max(2, bezel * 0.45)), { overflow: 'hidden', filter: 'none' });
    for (const disk of [this.rimDisk, this.sheenDisk]) if (disk) {
      Object.assign(disk.style, { position: 'absolute', width: diameter + 'px', height: diameter + 'px', left: '50%', top: '50%' });
    }
  }
  /** Rotation-equivariant lighting: bake gradients only when the material changes. */
  private bakeLight(): void {
    this._lightBakes++;
    const cfg = this.cfg, L = this.backdropLuma();
    const p = cfg.fresnelPower ?? 2.2;
    if (this.rimDisk) {
      const hi = cfg.edgeHighlight * (0.65 + 0.44 * L);
      this.rimDisk.style.background = this.conicStops(0, p, hi * 0.86, hi * 0.075, hi * 0.035);
    }
    if (this.sheenDisk) {
      const sp = cfg.specularStrength * (0.4 + 0.65 * L);
      this.sheenDisk.style.background = this.conicStops(0, p, sp * 0.23, 0, sp * 0.16);
    }
  }
  private updateRings(): void {
    const rot = `translate(-50%,-50%) rotate(${this.currentAngle}deg)`;
    for (const disk of [this.rimDisk, this.sheenDisk]) if (disk) disk.style.transform = rot;
    // Reserve intensity headroom, then animate opacity, not gradient strings.
    const opacity = String(this.reduceTransparency() ? 0 : 0.82 + 0.18 * this.currentHoverGlow);
    if (this.rimLayer) this.rimLayer.style.opacity = opacity;
    if (this.sheenLayer) this.sheenLayer.style.opacity = opacity;
  }

  /* ─────────────────── NOISE ─────────────────── */
  private updateNoise(): void {
    const cfg = this.cfg;
    if (cfg.noiseOpacity <= 0) {
      this.noiseLayer?.remove(); this.noiseLayer = null;
      return;
    }
    if (!this.noiseLayer) {
      this.noiseLayer = document.createElement('div');
      this.noiseLayer.className = 'ql-noise';
      this.noiseLayer.setAttribute('aria-hidden', 'true');
      Object.assign(this.noiseLayer.style, { position: 'absolute', inset: '0', borderRadius: 'inherit', pointerEvents: 'none' });
      this.el.insertBefore(this.noiseLayer, this._contentEl());
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
    // Computed-style probe, not proof of rendered support. Applications can
    // force CSS fallback; visual QA must also verify actual displacement.
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
    const M = this.cfg.ior > 1 ? 1 : 0;
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

    if (!this.shouldUseSVG() || cfg.refractionStrength <= 0 || cfg.ior <= 1 || this.reduceTransparency()) {
      this.teardownFilter();
      this.updateLensStyle();
      return;
    }

    const w = this.el.offsetWidth;
    const h = this.el.offsetHeight;
    if (w < 8 || h < 8) return;

    const resCap = cfg.quality === 'low' ? 128 : cfg.quality === 'medium' ? 384 : 1024;
    const radius = Math.min(cfg.borderRadius, Math.min(w, h) / 2);

    const { map, key } = await acquireLensMap(w, h, radius, cfg.bezelWidth, cfg.thickness, cfg.ior, resCap, cfg.blur);
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

    this._mapError = null;
    this.buildFilterDOM(w, h, map);
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

  private buildFilterDOM(w: number, h: number, map: LensMap): void {
    this._filterBuilds++;
    if (this.svgEl) { this.svgEl.remove(); this.svgEl = null; }
    this.dispNodes = [];

    const { r, g, b } = this.channelScales();
    const useCA = usesDispersion(this.cfg.refractionStrength, this.cfg.chromaticAberration, this.cfg.blur, this.cfg.quality, this.cfg.dispersionMode);
    const pad = filterPadding(this.cfg.blur);
    const px = map.padX * w / map.mapWidth, py = map.padY * h / map.mapHeight;
    const mapImage = `<feImage href="${map.url}" result="encoded" preserveAspectRatio="none" x="${-px}" y="${-py}" width="${w + 2 * px}" height="${h + 2 * py}"/>
      <feComponentTransfer in="encoded" result="map">
        <feFuncR type="linear" slope="${255 / 254}" intercept="${-1 / 254}"/>
        <feFuncG type="linear" slope="${255 / 254}" intercept="${-1 / 254}"/>
      </feComponentTransfer>`;

    let content: string;
    if (useCA) {
      // ONE map, three scales — dispersion is linear in the field.
      content = `
        ${mapImage}
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
        ${mapImage}
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
    if (this._pointerMoveHandler) return;

    this._pointerEnterHandler = () => {
      if (this.cfg.hoverLighting) {
        this.targetHoverGlow = 1;
        this.kickLight();
      }
    };

    this._pointerMoveHandler = (e: PointerEvent) => {
      const rect = this.el.getBoundingClientRect();
      if (!rect.width || !rect.height || e.pointerType === 'touch') return;
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
    if (this.animatingLight || this.destroyed || this.reduceMotion() || document.hidden) return;
    this.animatingLight = true;
    this.lastLightTick = performance.now();
    this.rafId = requestAnimationFrame(() => this.tickLight());
  }

  private tickLight(): void {
    if (this.destroyed || this.reduceMotion() || document.hidden) { this.stopLight(); return; }
    const t0 = performance.now();
    const dt = Math.min(0.05, Math.max(0.001, (t0 - this.lastLightTick) / 1000));
    this.lastLightTick = t0;
    let moving = false;
    // Closed-form critical damping. Equal elapsed time gives equal motion
    // on 60Hz and 120Hz displays, unlike the old per-frame Euler constants.
    const step = (value: number, target: number, velocity: number, threshold: number): [number, number] => {
      if (Math.abs(target - value) < threshold && Math.abs(velocity) < threshold * 10) return [target, 0];
      moving = true;
      if (!this.cfg.inertia) return [target, 0];
      const omega = 22, offset = value - target;
      const c = velocity + omega * offset, decay = Math.exp(-omega * dt);
      return [target + (offset + c * dt) * decay, (velocity - omega * c * dt) * decay];
    };
    const diff = ((this.targetAngle - this.currentAngle + 180) % 360 + 360) % 360 - 180;
    [this.currentAngle, this.angleVelocity] = step(this.currentAngle, this.currentAngle + diff, this.angleVelocity, 0.08);
    [this.currentHoverGlow, this.hoverGlowVelocity] = step(this.currentHoverGlow, this.targetHoverGlow, this.hoverGlowVelocity, 0.002);
    if (this.cfg.parallax) {
      [this.currentParallaxX, this.parallaxXVelocity] = step(this.currentParallaxX, this.targetParallaxX, this.parallaxXVelocity, 0.001);
      [this.currentParallaxY, this.parallaxYVelocity] = step(this.currentParallaxY, this.targetParallaxY, this.parallaxYVelocity, 0.001);
      this.el.style.transform = this.currentParallaxX || this.currentParallaxY
        ? `perspective(1000px) rotateY(${this.currentParallaxX * 5}deg) rotateX(${-this.currentParallaxY * 5}deg)`
        : this.originalStyle.get('transform')![0];
    }
    this.updateRings();
    this._lastTime = performance.now() - t0;
    this._totalTime += this._lastTime;
    this._frameCount++;
    if (moving) this.rafId = requestAnimationFrame(() => this.tickLight());
    else this.stopLight();
  }

  /* ─────────────────── ANIMATIONS (public) ─────────────────── */
  private cancelAnimations(): void {
    for (const timer of this.animationTimers) clearTimeout(timer);
    this.animationTimers.clear();
    for (const animation of this.animations) animation.cancel();
    this.animations.clear();
  }
  private async play(keyframes: Keyframe[], duration: number): Promise<boolean> {
    if (this.destroyed || this.reduceMotion()) return false;
    this.cancelAnimations();
    const animation = this.el.animate(keyframes, { duration, easing: 'cubic-bezier(.2,.8,.2,1)' });
    this.animations.add(animation);
    try { await animation.finished; return true; } catch { return false; }
    finally { this.animations.delete(animation); }
  }
  enableLiquidPress(config?: { scale?: number; squish?: number }): void {
    this.disableLiquidPress();
    const scale = config?.scale ?? 0.96, squish = config?.squish ?? 0.018;
    let pressed = false;
    const onDown = (event: PointerEvent) => {
      if (event.button !== 0 || this.destroyed || this.reduceMotion()) return;
      pressed = true; this.cancelAnimations();
      this.el.style.transform = `scale(${1 + squish}, ${scale})`;
    };
    const onUp = () => {
      if (!pressed || this.destroyed) return;
      pressed = false;
      const from = this.el.style.transform;
      this.el.style.transform = this.originalStyle.get('transform')![0];
      void this.play([{ transform: from }, { transform: 'scale(.99,1.015)', offset: .5 }, { transform: 'scale(1)' }], 380);
    };
    this.pressHandlers = { down: onDown, up: onUp, leave: onUp, reset: () => {
      if (pressed) this.el.style.transform = this.originalStyle.get('transform')![0];
      pressed = false;
    } };
    this.el.addEventListener('pointerdown', onDown, { passive: true });
    this.el.addEventListener('pointerup', onUp, { passive: true });
    this.el.addEventListener('pointerleave', onUp, { passive: true });
    this.el.addEventListener('pointercancel', onUp, { passive: true });
  }
  disableLiquidPress(): void {
    if (!this.pressHandlers) return;
    this.pressHandlers.reset();
    this.el.removeEventListener('pointerdown', this.pressHandlers.down);
    this.el.removeEventListener('pointerup', this.pressHandlers.up);
    this.el.removeEventListener('pointerleave', this.pressHandlers.leave);
    this.el.removeEventListener('pointercancel', this.pressHandlers.up);
    this.pressHandlers = null;
  }
  animateIn(delay = 0): void {
    if (this.destroyed) return;
    this.cancelAnimations();
    this.el.style.visibility = this.originalStyle.get('visibility')![0];
    if (this.reduceMotion()) return;
    const start = () => {
      if (this.destroyed) return;
      // No host opacity: it would cut the lens off from the page backdrop.
      void this.play([{ transform: 'scale(.94)' }, { transform: 'scale(1.012)', offset: .65 }, { transform: 'scale(1)' }], 420);
    };
    if (delay > 0) {
      const timer = setTimeout(() => { this.animationTimers.delete(timer); start(); }, delay);
      this.animationTimers.add(timer);
    } else start();
  }
  async animateOut(): Promise<void> {
    if (this.destroyed) return;
    const completed = this.reduceMotion() || await this.play([{ transform: 'scale(1)' }, { transform: 'scale(.94)' }], 180);
    if (completed && !this.destroyed) this.el.style.visibility = 'hidden';
  }
  jiggle(intensity = 1): void {
    const i = Math.max(0, Math.min(3, intensity));
    void this.play([
      { transform: 'scale(1)' },
      { transform: `scale(${1 + .025 * i},${1 - .018 * i})`, offset: .2 },
      { transform: `scale(${1 - .016 * i},${1 + .012 * i})`, offset: .5 },
      { transform: 'scale(1)' },
    ], 480);
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
      mapEncodeMs: this.lensMap?.encodeMs ?? 0,
      displacementTaps: this.dispNodes.length,
      lightBakes: this._lightBakes,
      filterBuilds: this._filterBuilds,
      mapError: this._mapError,
    };
  }

  /** Patch explicit overrides. Pass undefined to remove an override. */
  updateConfig(config: Partial<LiquidGlassConfig>): void {
    this.setConfig({ ...this.overrides, ...config });
  }
  /** Replace the declaration (used by React); omitted keys revert to the preset/default. */
  setConfig(config: Partial<LiquidGlassConfig>): void {
    if (this.destroyed) return;
    const oldCfg = this.cfg;
    this.overrides = { ...config };
    const cfg = this.cfg = resolveGlassConfig(this.overrides);
    const changed = (...keys: (keyof LiquidGlassConfig)[]) => keys.some(k => oldCfg[k] !== cfg[k]);
    if (!Object.keys({ ...oldCfg, ...cfg }).some(k => oldCfg[k as keyof LiquidGlassConfig] !== cfg[k as keyof LiquidGlassConfig])) return;
    const graph = (c: LiquidGlassConfig) => usesDispersion(c.refractionStrength, c.chromaticAberration, c.blur, c.quality, c.dispersionMode);
    const geometryChanged = changed('borderRadius', 'bezelWidth', 'thickness', 'ior', 'quality', 'refractionMode', 'respectPreferences')
      || (oldCfg.refractionStrength <= 0) !== (cfg.refractionStrength <= 0)
      || filterPadding(oldCfg.blur) !== filterPadding(cfg.blur) || graph(oldCfg) !== graph(cfg);
    if (changed('borderRadius')) this.el.style.borderRadius = cfg.borderRadius + 'px';
    if (geometryChanged) this.queueRebuild();
    else if (changed('refractionStrength', 'chromaticAberration')) this.updateFilterScales();
    if (changed('lightAngle')) {
      this.targetAngle = cfg.lightAngle;
      this.currentAngle = cfg.lightAngle; this.angleVelocity = 0;
      this.updateRings();
    }
    if (changed('blur', 'saturation', 'respectPreferences')) this.updateLensStyle();
    if (changed('tint', 'tintOpacity', 'tintStrength', 'adaptiveTint', 'appearance', 'respectPreferences')) this.updateTint();
    if (changed('edgeHighlight', 'specularStrength', 'fresnelPower', 'appearance', 'backdropLuminance', 'hoverLighting', 'respectPreferences')) {
      this.bakeLight(); this.updateRings();
    }
    if (changed('noiseOpacity', 'noiseScale')) this.updateNoise();
    if (changed('elevation', 'thickness', 'appearance')) this.applyDepth();
    if (changed('cursorTracking', 'parallax', 'hoverLighting', 'respectPreferences')) {
      this.targetHoverGlow = 0;
      if (!cfg.parallax) this.el.style.transform = this.originalStyle.get('transform')![0];
      this.syncPointerListeners();
    }
    if (changed('appearance')) this.syncSchemeListener();
    if (changed('respectPreferences')) this.onPreferences();
  }
  getConfig(): Readonly<LiquidGlassConfig> { return { ...this.cfg }; }

  private syncPointerListeners(): void {
    if (!this.reduceMotion() && (this.cfg.cursorTracking || this.cfg.hoverLighting || this.cfg.parallax)) {
      this.setupPointer();
    } else {
      this.teardownPointer();
      this.stopLight();
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.cancelAnimations();
    this.disableLiquidPress();
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.motionQuery?.removeEventListener('change', this.onPreferences);
    this.transparencyQuery?.removeEventListener('change', this.onPreferences);
    LiquidGlassEngine._registry.delete(this);
    this.lensBuildVersion++;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.resizeRaf) cancelAnimationFrame(this.resizeRaf);
    this.resizeObs?.disconnect();
    this.teardownFilter();
    [this.lensLayer, this.tintLayer, this.sheenLayer, this.rimLayer, this.noiseLayer]
      .forEach(l => l?.remove());
    this.lensLayer = this.tintLayer = this.sheenLayer = this.rimLayer = this.noiseLayer = null;

    this.teardownPointer();
    if (this.schemeQuery && this.schemeListener) {
      this.schemeQuery.removeEventListener('change', this.schemeListener);
    }
    this.schemeQuery = null;
    this.schemeListener = null;

    if (this.ownedContent) {
      this.ownedContent.replaceWith(...Array.from(this.ownedContent.childNodes));
      this.ownedContent = null;
    }
    for (const [property, [value, priority]] of this.originalStyle) {
      if (value) this.el.style.setProperty(property, value, priority);
      else this.el.style.removeProperty(property);
    }
  }
}
