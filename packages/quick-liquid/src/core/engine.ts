/**
 * quick-liquid/core/engine.ts — LIQUID GLASS ENGINE v6
 *
 * Apple-quality liquid glass physics:
 *
 *  ┌──────────────────────────────────────────────────────────┐
 *  │  HOW REAL GLASS LOOKS — PHYSICS MODEL                    │
 *  │                                                          │
 *  │  1. LENS DISTORTION (THE CORE)                           │
 *  │     A convex glass panel acts as a weak lens. Rays       │
 *  │     entering the curved surface refract (Snell's Law)    │
 *  │     causing the background to appear magnified near      │
 *  │     center and shifted/bent near the edges.              │
 *  │     → backdrop-filter: url(#svgLens)                     │
 *  │       The SVG feDisplacementMap on backdrop-filter        │
 *  │       physically bends what you see THROUGH the glass.   │
 *  │       Center pixels are pulled outward (magnify).        │
 *  │       Edge pixels are compressed/shifted.                │
 *  │                                                          │
 *  │  2. VERY LIGHT BLUR                                      │
 *  │     Real glass isn't perfectly optically flat. A small   │
 *  │     amount of scattering gives the frosted quality.      │
 *  │     Too much destroys the lens effect. ~1–8px.           │
 *  │     This is combined with the displacement in ONE        │
 *  │     backdrop-filter chain.                               │
 *  │                                                          │
 *  │  3. TINT — very subtle white or warm                     │
 *  │     Glass absorbs a tiny fraction of light.              │
 *  │     rgba(255,255,255,0.06–0.10). Any more = opaque.      │
 *  │                                                          │
 *  │  4. SPECULAR HIGHLIGHT (Fresnel / Blinn-Phong)           │
 *  │     At glancing angles, glass is highly reflective       │
 *  │     (Fresnel). A bright crescent on the top-left edge    │
 *  │     is where room light reflects. NOT a full-width fog.  │
 *  │     Key: a tight elliptical hotspot + a soft shoulder.   │
 *  │                                                          │
 *  │  5. GRADIENT GLASS BORDER                                │
 *  │     The glass has physical thickness. The top/lit edge   │
 *  │     is very bright (≈85% white). Sides taper. Bottom     │
 *  │     is dim. This is NOT a uniform border.                │
 *  │                                                          │
 *  │  6. INNER RIM LIGHT                                      │
 *  │     1px inset line at the very top — simulates the top   │
 *  │     glass face catching light.                           │
 *  │                                                          │
 *  │  7. MULTI-LAYER SHADOW                                   │
 *  │     Glass casts a focused shadow (small, dark) +         │
 *  │     a wide ambient shadow (large, light).                │
 *  └──────────────────────────────────────────────────────────┘
 *
 * Layer stack (bottom → top):
 *   .ql-lens        z:0  The lens — backdrop-filter: url(#filter) blur(Xpx)
 *                        This is WHERE the glass physics live.
 *   .ql-tint        z:1  Very subtle white/warm fill
 *   .ql-curvature   z:2  Inner lens gradient (center bright, edge dark)
 *   .ql-specular    z:3  Fresnel specular crescent highlight
 *   .ql-rim         z:4  Gradient glass border + inner rim line
 *   .ql-content     z:10 Children
 */

export interface LiquidGlassConfig {
  /**
   * Backdrop blur in px. 0 = crystal clear lens, 8 = frosted.
   * Apple uses ~4-6px for most UI elements.
   */
  blur: number;
  /** Saturation boost (1.0 = neutral, 1.5 = vivid through glass). */
  saturation: number;
  /** Border radius in px. */
  borderRadius: number;
  /**
   * Lens distortion strength. Controls how much the glass bends
   * the background. 0 = flat glass, 40 = strong lens.
   * Apple typical: 20-30.
   */
  refractionStrength: number;
  /** Index of refraction for Snell's Law gradient. 1.0 = air, 1.5 = glass. */
  ior: number;
  /** Rim border + inner rim brightness (0-1). */
  edgeHighlight: number;
  /**
   * Chromatic aberration at edges (0 = none, 1 = strong rainbow fringe).
   * Apple keeps this very subtle ~0.2 on specular only.
   */
  chromaticAberration: number;
  /** Shadow depth and elevation. Higher = more elevated. */
  thickness: number;
  /** Light angle in degrees for specular/rim direction. -90 = top. */
  lightAngle: number;
  /** Dynamically rotate light to follow pointer. */
  dynamicLighting: boolean;
  /** Quality preset. */
  quality: 'high' | 'medium' | 'low';
  /** Refraction mode — 'auto' detects browser support. */
  refractionMode: 'auto' | 'svg' | 'css';
  /** Tint color as "R, G, B" string. Default white. */
  tint: string;
  /** Tint opacity. Keep 0.04-0.10 for glass, 0 for crystal clear. */
  tintOpacity: number;
  /** Specular highlight intensity (0-1). */
  specularStrength: number;
}

export const DEFAULT_CONFIG: LiquidGlassConfig = {
  blur: 12,
  saturation: 1.6,
  borderRadius: 32,
  refractionStrength: 40,
  ior: 1.45,
  edgeHighlight: 0.9,
  chromaticAberration: 0.15,
  thickness: 4,
  lightAngle: -60,
  dynamicLighting: false,
  quality: 'high',
  refractionMode: 'auto',
  tint: '255, 255, 255',
  tintOpacity: 0.15,
  specularStrength: 1.0,
};

let uid = 0;

export class LiquidGlassEngine {
  private el: HTMLElement;
  private cfg: LiquidGlassConfig;
  readonly id: string;

  // Layer refs
  private lensLayer: HTMLDivElement | null = null;
  private tintLayer: HTMLDivElement | null = null;
  private curvatureLayer: HTMLDivElement | null = null;
  private specularLayer: HTMLDivElement | null = null;
  private rimLayer: HTMLDivElement | null = null;

  // SVG filter (lens displacement)
  private svgEl: SVGSVGElement | null = null;


  private resizeObs: ResizeObserver | null = null;
  private destroyed = false;
  private rafId: number | null = null;
  private animatingLight = false;
  private currentAngle: number;
  private targetAngle: number;

  private _frameCount = 0;
  private _totalTime = 0;
  private _lastTime = 0;

  private static _svgOk: boolean | null = null;
  private pressHandlers: { down: () => void; up: () => void; leave: () => void } | null = null;

  constructor(element: HTMLElement, config: Partial<LiquidGlassConfig> = {}) {
    this.el = element;
    this.cfg = { ...DEFAULT_CONFIG, ...config };
    this.id = `ql${++uid}`;
    this.currentAngle = this.cfg.lightAngle;
    this.targetAngle = this.cfg.lightAngle;
    this.mount();
  }

  // ═══════════════════════════════════════════════════════════
  //  MOUNT
  // ═══════════════════════════════════════════════════════════
  private mount(): void {
    const el = this.el;
    const cfg = this.cfg;

    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    el.style.borderRadius = `${cfg.borderRadius}px`;
    el.style.overflow = 'hidden';
    el.style.isolation = 'isolate';

    this.buildAllLayers();

    this.resizeObs = new ResizeObserver(() => {
      if (cfg.refractionStrength > 0) this.rebuildLensFilter();
    });
    this.resizeObs.observe(el);

    if (cfg.dynamicLighting) this.setupPointer();
  }

  private buildAllLayers(): void {
    this.buildLensFilter();       // SVG displacement map (must exist before lens layer)
    this.createLensLayer();       // Layer 0: the actual glass lens + blur
    this.createTintLayer();       // Layer 1: subtle white tint
    this.createCurvatureLayer();  // Layer 2: inner convex-lens brightness gradient
    this.createSpecularLayer();   // Layer 3: Fresnel specular crescent
    this.createRimLayer();        // Layer 4: gradient border + inner rim line
    this.applyDepth();            // Outer shadow
  }

  // ═══════════════════════════════════════════════════════════
  //  LAYER 0 — LENS
  //
  //  THE core of liquid glass physics. We apply backdrop-filter
  //  with BOTH the SVG lens displacement AND the blur together.
  //
  //  backdrop-filter: url(#id) blur(Xpx) saturate(Y)
  //
  //  This makes the browser:
  //    1. Sample the pixels BEHIND this element
  //    2. Displace them via our lens displacement map (refraction)
  //    3. Apply a small blur (frosting)
  //    4. Boost saturation (glass makes colors richer)
  //    5. Composite the result as the "background" of this layer
  //
  //  The displacement map encodes a lenticular (convex lens) warp:
  //    - Center: neutral (no displacement, clear glass center)
  //    - Toward edges: increasing outward push → magnification
  //    - At rim: strong edge-normal displacement → refraction
  // ═══════════════════════════════════════════════════════════
  private createLensLayer(): void {
    if (this.lensLayer) this.lensLayer.remove();
    const cfg = this.cfg;
    const layer = document.createElement('div');
    layer.className = 'ql-lens';

    const hasSVG = this.svgEl && this.shouldUseSVG();
    const svgPart = hasSVG ? `url(#${this.id}) ` : '';
    const blurPart = cfg.blur > 0 ? `blur(${cfg.blur}px) ` : '';
    const satPart = cfg.saturation !== 1 ? `saturate(${cfg.saturation})` : '';
    const bdf = `${svgPart}${blurPart}${satPart}`.trim() || 'none';

    Object.assign(layer.style, {
      position: 'absolute',
      inset: '0',
      zIndex: '0',
      borderRadius: 'inherit',
      pointerEvents: 'none',
      backdropFilter: bdf,
      WebkitBackdropFilter: bdf,
    });

    this.lensLayer = layer;
    this.el.insertBefore(layer, this.el.firstChild);
  }

  // ═══════════════════════════════════════════════════════════
  //  LAYER 1 — TINT
  //  Real glass absorbs a tiny bit of light and has a slight
  //  warm/cool cast depending on the glass type.
  //  Keep very low (0.06-0.12). This is NOT a background.
  // ═══════════════════════════════════════════════════════════
  private createTintLayer(): void {
    if (this.tintLayer) this.tintLayer.remove();
    const cfg = this.cfg;
    if (cfg.tintOpacity <= 0) return;

    const layer = document.createElement('div');
    layer.className = 'ql-tint';
    Object.assign(layer.style, {
      position: 'absolute',
      inset: '0',
      zIndex: '1',
      borderRadius: 'inherit',
      pointerEvents: 'none',
      backgroundColor: `rgba(${cfg.tint}, ${cfg.tintOpacity})`,
    });
    this.tintLayer = layer;
    const ref = this.lensLayer;
    this.el.insertBefore(layer, ref!.nextSibling);
  }

  // ═══════════════════════════════════════════════════════════
  //  LAYER 2 — CURVATURE GRADIENT
  //  A convex glass lens is thicker in the center and thinner
  //  at edges. Light is concentrated toward the center top.
  //  This inner gradient makes the glass look 3D and curved.
  //
  //  Real Apple glass has:
  //    - A subtle warm/bright top-center area
  //    - A slight darkening toward the bottom (shadow side)
  //    - The entire center is transparent / clear
  // ═══════════════════════════════════════════════════════════
  private createCurvatureLayer(): void {
    if (this.curvatureLayer) this.curvatureLayer.remove();
    const layer = document.createElement('div');
    layer.className = 'ql-curvature';
    Object.assign(layer.style, {
      position: 'absolute',
      inset: '0',
      zIndex: '2',
      borderRadius: 'inherit',
      pointerEvents: 'none',
      background: [
        // Top-center convex highlight — wide and soft like a curved lens
        `radial-gradient(ellipse 80% 50% at 50% -10%,
          rgba(255,255,255,0.10) 0%,
          rgba(255,255,255,0.04) 50%,
          transparent 100%
        )`,
        // Bottom shadow — glass bends light away from the bottom
        `linear-gradient(180deg,
          transparent 50%,
          rgba(0,0,0,0.06) 100%
        )`,
      ].join(', '),
    });
    this.curvatureLayer = layer;
    const ref = this.tintLayer || this.lensLayer;
    this.el.insertBefore(layer, ref!.nextSibling);
  }

  // ═══════════════════════════════════════════════════════════
  //  LAYER 3 — SPECULAR (Fresnel reflection)
  //
  //  Real glass has very high reflectivity at glancing angles
  //  (Schlick Fresnel). The lit face of the glass catches room
  //  light and creates a bright crescent or streak.
  //
  //  Apple liquid glass specular characteristics:
  //    - Primary: a tight bright ellipse near the top-left
  //    - Secondary: a soft wide radial glow along the top rim
  //    - Edge: a thin bright line just inside the top border
  //    - All these shift with the light angle
  //    - The crescent has slight color (warm white / very pale blue)
  // ═══════════════════════════════════════════════════════════
  private createSpecularLayer(): void {
    if (this.specularLayer) this.specularLayer.remove();
    const layer = document.createElement('div');
    layer.className = 'ql-specular';
    this.specularLayer = layer;
    Object.assign(layer.style, {
      position: 'absolute',
      inset: '0',
      zIndex: '3',
      borderRadius: 'inherit',
      pointerEvents: 'none',
    });
    this.updateSpecular();
    const ref = this.curvatureLayer || this.tintLayer || this.lensLayer;
    this.el.insertBefore(layer, ref!.nextSibling);
  }

  private updateSpecular(): void {
    if (!this.specularLayer) return;
    const hi = this.cfg.specularStrength;
    const angle = this.currentAngle;
    const ca = this.cfg.chromaticAberration;

    // Light direction mapped from angle (degrees → unit vector)
    const rad = (angle * Math.PI) / 180;
    const lx = Math.sin(rad); // -1=left, +1=right
    const ly = -Math.cos(rad); // -1=top, +1=bottom

    // Specular hotspot position — on the lit side, near the edge
    // Apple typical: upper-left area at about (30%, 5%)
    const hx = 50 + lx * 22; // 28–72% horizontally
    const hy = Math.max(2, 10 + ly * 8); // keep near top

    // Chromatic aberration tints the specular slightly (just barely perceptible)
    // warm on the lit edge, cool on the opposite edge
    const r = Math.round(255);
    const g = Math.round(255 - ca * 10);
    const b = Math.round(255 - ca * 5);

    this.specularLayer.style.background = [
      // 1. PRIMARY SPECULAR CRESCENT — tight, very bright ellipse.
      //    The single most important visual cue for glass.
      //    Simulates direct Fresnel reflection of a room light source.
      `radial-gradient(ellipse 42% 18% at ${hx.toFixed(1)}% ${hy.toFixed(1)}%,
        rgba(${r},${g},${b},${(hi * 0.90).toFixed(3)}) 0%,
        rgba(255,255,255,${(hi * 0.55).toFixed(3)}) 30%,
        rgba(255,255,255,${(hi * 0.18).toFixed(3)}) 60%,
        transparent 100%
      )`,
      // 2. SOFT SHOULDER — wide gentle glow behind the hotspot.
      //    Simulates subsurface/diffuse Fresnel on the curved rim.
      `radial-gradient(ellipse 80% 40% at ${hx.toFixed(1)}% 0%,
        rgba(255,255,255,${(hi * 0.28).toFixed(3)}) 0%,
        rgba(255,255,255,${(hi * 0.10).toFixed(3)}) 50%,
        transparent 100%
      )`,
      // 3. TOP EDGE LINE — simulates the top glass face reflecting light.
      //    Extremely thin, fades by ~6% height. This is the "glass thickness" cue.
      `linear-gradient(180deg,
        rgba(255,255,255,${(hi * 0.65).toFixed(3)}) 0%,
        rgba(255,255,255,${(hi * 0.22).toFixed(3)}) 2%,
        rgba(255,255,255,${(hi * 0.05).toFixed(3)}) 5%,
        transparent 8%
      )`,
    ].join(', ');
  }

  // ═══════════════════════════════════════════════════════════
  //  LAYER 4 — RIM BORDER
  //
  //  Glass has physical thickness. The top face catches the most
  //  light (lit by room/sun from above-left). The sides taper.
  //  The bottom is in shadow.
  //
  //  Apple liquid glass border characteristics:
  //    - 1–1.5px border (not 2px — too thick = metallic)
  //    - The border itself is a gradient, NOT uniform
  //    - Top: rgba(255,255,255,0.7–0.85) — very bright
  //    - Sides: rgba(255,255,255,0.35–0.50)
  //    - Bottom: rgba(255,255,255,0.15–0.25)
  //    - PLUS 1px inset white line at very top (glass face edge)
  //    - Outer glow: very subtle (not obvious)
  //    - Chromatic micro-fringes: barely visible colored edges
  // ═══════════════════════════════════════════════════════════
  private createRimLayer(): void {
    if (this.rimLayer) this.rimLayer.remove();
    const layer = document.createElement('div');
    layer.className = 'ql-rim';
    this.rimLayer = layer;
    this.updateRim();
    const ref = this.specularLayer || this.curvatureLayer || this.tintLayer || this.lensLayer;
    this.el.insertBefore(layer, ref!.nextSibling);
  }

  private updateRim(): void {
    if (!this.rimLayer) return;
    const hi = this.cfg.edgeHighlight;
    const angle = this.currentAngle;
    const ca = this.cfg.chromaticAberration;

    // Gradient border angle: light comes from this direction
    // The border is brightest on the lit face
    const gradAngle = ((angle + 180) % 360);

    // Border opacities based on Fresnel: lit face is ~85%, shadow face ~20%
    const topOp   = Math.min(0.85, hi * 0.85);
    const sideOp  = Math.min(0.45, hi * 0.45);
    const btmOp   = Math.min(0.20, hi * 0.20);

    // Chromatic aberration on the border edges — very subtle color fringes
    // These appear on rounded corners where light splits into spectrum
    const caBoxShadows = ca > 0.05 ? [
      // Warm red-orange fringe on left edge (very subtle)
      `inset 1px 0 0 rgba(255,90,60,${(ca * 0.12).toFixed(3)})`,
      // Cool blue fringe on right edge
      `inset -1px 0 0 rgba(80,150,255,${(ca * 0.12).toFixed(3)})`,
    ] : [];

    Object.assign(this.rimLayer.style, {
      position: 'absolute',
      inset: '0',
      zIndex: '4',
      borderRadius: 'inherit',
      pointerEvents: 'none',
      // Gradient border — the glass edge line
      border: '1px solid transparent',
      backgroundImage: [
        'linear-gradient(rgba(0,0,0,0), rgba(0,0,0,0))',
        `linear-gradient(${gradAngle}deg,
          rgba(255,255,255,${topOp.toFixed(3)})  0%,
          rgba(255,255,255,${sideOp.toFixed(3)}) 30%,
          rgba(255,255,255,${btmOp.toFixed(3)})  65%,
          rgba(255,255,255,${(btmOp * 0.8).toFixed(3)}) 100%
        )`,
      ].join(', '),
      backgroundOrigin: 'border-box',
      backgroundClip: 'padding-box, border-box',
      boxShadow: [
        // Inner top rim — simulates the top glass face at the border
        `inset 0 1px 0 rgba(255,255,255,${(hi * 0.75).toFixed(3)})`,
        // Inner bottom dimmer edge
        `inset 0 -1px 0 rgba(255,255,255,${(hi * 0.08).toFixed(3)})`,
        // Outer glow — barely visible, just enough to separate from background
        `0 0 0 0.5px rgba(255,255,255,${(hi * 0.12).toFixed(3)})`,
        // Drop shadow (handled by applyDepth, but add a tight contact shadow)
        `0 2px 4px rgba(0,0,0,0.15)`,
        ...caBoxShadows,
      ].join(', '),
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  DEPTH SHADOWS
  //  Glass casts two shadow types:
  //    1. Hard/focused: tight, dark — from direct light source
  //    2. Soft/ambient: wide, light — from ambient room light
  // ═══════════════════════════════════════════════════════════
  private applyDepth(): void {
    const t = this.cfg.thickness;
    if (t < 1) { this.el.style.boxShadow = 'none'; return; }
    this.el.style.boxShadow = [
      // Tight contact shadow (hard, dark)
      `0 ${Math.round(t * 0.5)}px ${Math.round(t)}px rgba(0,0,0,0.28)`,
      // Medium elevation shadow
      `0 ${Math.round(t)}px ${Math.round(t * 3)}px rgba(0,0,0,0.18)`,
      // Wide ambient shadow (soft, light)
      `0 ${Math.round(t * 2)}px ${Math.round(t * 10)}px rgba(0,0,0,0.10)`,
    ].join(', ');
  }

  // ═══════════════════════════════════════════════════════════
  //  SVG LENS FILTER
  //
  //  THE PHYSICS ENGINE of liquid glass.
  //
  //  How it works:
  //    feImage: our canvas-computed displacement map (lens shape)
  //    feDisplacementMap: reads the map and displaces source pixels
  //      - R channel → X displacement
  //      - G channel → Y displacement
  //      - Value 0.5 (128/255) = no displacement (neutral)
  //      - Value > 0.5 = shift right/down
  //      - Value < 0.5 = shift left/up
  //
  //  The lens map encodes:
  //    - A smooth lenticular (convex) displacement field
  //    - Center pixels: neutral (128, 128) — you see straight through
  //    - Pixels toward edge: displaced outward along the surface normal
  //      This is the Snell's Law refraction: rays entering a curved
  //      glass surface bend away from the normal at the exit.
  //    - The displacement magnitude follows a smooth bell curve:
  //      max at ~70-80% radius, zero at center and outside edge.
  //    - Chromatic aberration: separate R/G/B displacement maps
  //      with slightly different strengths (red bends more than blue)
  //
  //  CRITICAL: This filter is referenced via backdrop-filter: url(#id)
  //  so it physically distorts the background pixels, NOT the element.
  //  This is what creates the actual "looking through glass" lens effect.
  //
  //  NOTE: backdrop-filter with url() has limited browser support.
  //  Chrome 76+, Safari 9+ (with -webkit-), Firefox 103+.
  //  The shouldUseSVG() check handles this.
  // ═══════════════════════════════════════════════════════════
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
    if (typeof CSS === 'undefined') return false;
    // Test if backdrop-filter accepts url() references
    if (CSS.supports('backdrop-filter', 'url(#x)')) return true;
    if (CSS.supports('-webkit-backdrop-filter', 'url(#x)')) return true;
    // Fallback: check filter support (still useful for iOS Safari workaround)
    return CSS.supports('filter', 'url(#x)');
  }

  private buildLensFilter(): void {
    if (!this.shouldUseSVG() || this.cfg.refractionStrength <= 0) return;
    this.rebuildLensFilter();
  }

  private rebuildLensFilter(): void {
    if (this.svgEl) { this.svgEl.remove(); this.svgEl = null; }
    if (!this.shouldUseSVG() || this.cfg.refractionStrength <= 0) return;

    // Use offsetWidth/Height — layout dimensions in CSS pixels, independent of transforms.
    // CRITICAL: Do NOT use getBoundingClientRect() here — it returns visual (post-transform)
    // dimensions which don't match the filterUnits="userSpaceOnUse" coordinate system.
    const w = this.el.offsetWidth || 200;
    const h = this.el.offsetHeight || 100;
    if (w < 4 || h < 4) return;

    // Map resolution — higher = smoother distortion but more CPU
    const qw = this.cfg.quality === 'low'    ? Math.min(w, 60)
             : this.cfg.quality === 'medium' ? Math.min(w, 120)
             : Math.min(w, 200);
    const qh = this.cfg.quality === 'low'    ? Math.min(h, 60)
             : this.cfg.quality === 'medium' ? Math.min(h, 120)
             : Math.min(h, 200);

    const ca = this.cfg.chromaticAberration;
    const scale = this.cfg.refractionStrength;
    // Extend filter region so edge displacements don't get clipped
    const pad = Math.ceil(scale * 0.6);

    // CRITICAL: Use filterUnits="userSpaceOnUse" with INTEGER pixel coordinates.
    // In this mode the coordinate system has origin at the element's top-left corner
    // with 1 unit = 1 CSS pixel. Percentage strings ("100%") are NOT valid here —
    // they get treated as the literal number (100 CSS pixels), NOT 100% of the element.
    // feImage must also use exact integer pixel dimensions.
    let filterContent: string;

    if (ca > 0.05 && this.cfg.quality === 'high') {
      // CHROMATIC ABERRATION MODE
      // Three displacement maps with slightly different scales (R bends most, B least)
      // This splits the RGB channels like a prism — color fringing at edges
      const scaleR = scale * (1 + ca * 0.3);
      const scaleG = scale;
      const scaleB = scale * (1 - ca * 0.2);

      const mapURIR = this.generateLensMap(qw, qh, w, h, 'R');
      const mapURIG = this.generateLensMap(qw, qh, w, h, 'G');
      const mapURIB = this.generateLensMap(qw, qh, w, h, 'B');

      filterContent = `
        <feImage href="${mapURIR}" result="mapR" preserveAspectRatio="none" x="0" y="0" width="${w}" height="${h}"/>
        <feImage href="${mapURIG}" result="mapG" preserveAspectRatio="none" x="0" y="0" width="${w}" height="${h}"/>
        <feImage href="${mapURIB}" result="mapB" preserveAspectRatio="none" x="0" y="0" width="${w}" height="${h}"/>
        <feDisplacementMap in="SourceGraphic" in2="mapR" scale="${scaleR.toFixed(1)}" xChannelSelector="R" yChannelSelector="G" result="dispR"/>
        <feDisplacementMap in="SourceGraphic" in2="mapG" scale="${scaleG.toFixed(1)}" xChannelSelector="R" yChannelSelector="G" result="dispG"/>
        <feDisplacementMap in="SourceGraphic" in2="mapB" scale="${scaleB.toFixed(1)}" xChannelSelector="R" yChannelSelector="G" result="dispB"/>
        <feColorMatrix in="dispR" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="onlyR"/>
        <feColorMatrix in="dispG" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="onlyG"/>
        <feColorMatrix in="dispB" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="onlyB"/>
        <feBlend in="onlyR" in2="onlyG" mode="screen" result="RG"/>
        <feBlend in="RG" in2="onlyB" mode="screen"/>
      `;
    } else {
      // STANDARD MODE — single displacement map
      const mapURI = this.generateLensMap(qw, qh, w, h, 'all');
      filterContent = `
        <feImage href="${mapURI}" result="map" preserveAspectRatio="none" x="0" y="0" width="${w}" height="${h}"/>
        <feDisplacementMap in="SourceGraphic" in2="map" scale="${scale.toFixed(1)}" xChannelSelector="R" yChannelSelector="G"/>
      `;
    }

    const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute;overflow:hidden;pointer-events:none">
      <defs>
        <filter id="${this.id}" filterUnits="userSpaceOnUse"
          x="${-pad}" y="${-pad}" width="${w + 2 * pad}" height="${h + 2 * pad}"
          color-interpolation-filters="sRGB">
          ${filterContent}
        </filter>
      </defs>
    </svg>`;

    const div = document.createElement('div');
    div.innerHTML = svgStr.trim();
    this.svgEl = div.querySelector('svg')!;
    document.body.appendChild(this.svgEl);
  }

  /**
   * Generate a convex lens displacement map.
   *
   * Physics: A convex glass lens of refractive index n refracts incoming
   * parallel rays toward the focal point. For a thin lens with parabolic
   * profile, the surface normal at radius r from center is:
   *   normal = normalize(-r, f) where f = focal length
   *
   * Snell's law (paraxial): θ_refraction ≈ θ_incidence / n
   * Displacement ≈ thickness × (1 - 1/n) × sin(θ_normal)
   *
   * For our screen-space lens this simplifies to:
   *   dx = -normal_x × lens_profile(r)
   *   dy = -normal_y × lens_profile(r)
   *
   * Where lens_profile is a bell curve: smooth rise then fall, peaking
   * at ~70% of the lens radius. This gives the characteristic barrel
   * distortion + edge pinching of a real glass element.
   *
   * The channel parameter allows generating per-channel maps for CA.
   * 'R' = slight +3% extra displacement (red bends more at glass)
   * 'B' = slight -2% less displacement
   * 'all' / 'G' = standard
   */
  private generateLensMap(qw: number, qh: number, elW: number, elH: number, channel: 'R' | 'G' | 'B' | 'all' = 'all'): string {
    const iw = Math.ceil(qw);
    const ih = Math.ceil(qh);
    const canvas = document.createElement('canvas');
    canvas.width = iw;
    canvas.height = ih;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(iw, ih);
    const d = img.data;

    const cx = iw / 2;
    const cy = ih / 2;

    // Scale the border radius to MAP pixel space.
    // The map (iw × ih) will be stretched by feImage to fill the element (elW × elH),
    // so we must scale the radius proportionally to keep corner circles circular.
    const scaleX = iw / elW;
    const scaleY = ih / elH;
    const borderRadiusEl = Math.min(this.cfg.borderRadius, elW / 2, elH / 2);
    const borderRadius = borderRadiusEl * Math.min(scaleX, scaleY);

    // CA per-channel scale modifier
    const caScale = channel === 'R' ? 1.0 + this.cfg.chromaticAberration * 0.15
                  : channel === 'B' ? 1.0 - this.cfg.chromaticAberration * 0.10
                  : 1.0;

    for (let py = 0; py < ih; py++) {
      for (let px = 0; px < iw; px++) {
        const i = (py * iw + px) * 4;

        // SDF of the lens shape at this pixel
        const sdf = this.sdfRoundedRect(px, py, cx, cy, borderRadius);

        // Only displace pixels inside the lens
        if (sdf > 0) {
          // Outside: neutral displacement (128, 128)
          d[i] = d[i+1] = 128; d[i+2] = 0; d[i+3] = 255;
          continue;
        }

        // Signed distance inside is negative, convert to positive depth
        const depth = -sdf; // 0 at rim, increases toward center

        // Normalized depth relative to max possible depth (half-min-dimension)
        const maxDepth = Math.min(cx, cy) * 0.9;
        const t = Math.min(depth / maxDepth, 1.0);

        // LENS PROFILE — bell curve that simulates a convex lens cross-section.
        // f(t) where t=0 is the glass rim, t=1 is the center:
        //   - At rim (t=0): zero displacement (glass meets frame, no bend)
        //   - Peak near t≈0.15: maximum refraction (curved glass surface)
        //   - At center (t=1): zero displacement (flat glass center, see straight through)
        //
        // This concentrates distortion in the rim band, leaving the glass center clear —
        // the defining visual characteristic of Apple liquid glass.
        const profile = lensProfile(t);

        // Surface normal from SDF gradient (points outward, toward the boundary)
        const eps = 0.8;
        const gx = (this.sdfRoundedRect(px + eps, py, cx, cy, borderRadius) -
                    this.sdfRoundedRect(px - eps, py, cx, cy, borderRadius)) / (2 * eps);
        const gy = (this.sdfRoundedRect(px, py + eps, cx, cy, borderRadius) -
                    this.sdfRoundedRect(px, py - eps, cx, cy, borderRadius)) / (2 * eps);
        const glen = Math.sqrt(gx * gx + gy * gy) || 1;
        const nx = gx / glen; // outward normal (toward rim)
        const ny = gy / glen;

        // Displacement magnitude: profile drives the bell curve, caScale adds chromatic split.
        // We drop the k factor (Snell paraxial) and drive directly from profile so the
        // displacement range is [0, 1] and the feDisplacementMap scale controls total pixels.
        const mag = profile * caScale;

        // Encode as 0-255 where 128 = no displacement.
        // Direction is OUTWARD (toward rim): when feDisplacementMap reads R>128 on the right
        // side, it sources the backdrop pixel from further RIGHT — pulling outside content
        // into the glass rim. This is the characteristic light-bending / lensing artifact.
        const dx = nx * mag;
        const dy = ny * mag;

        d[i]   = clamp8(128 + dx * 127);   // R = X displacement
        d[i+1] = clamp8(128 + dy * 127);   // G = Y displacement
        d[i+2] = 0;
        d[i+3] = 255;
      }
    }

    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL('image/png');
  }

  private sdfRoundedRect(px: number, py: number, cx: number, cy: number, r: number): number {
    const dx = Math.abs(px - cx) - (cx - r);
    const dy = Math.abs(py - cy) - (cy - r);
    const outside = Math.sqrt(Math.max(dx, 0) ** 2 + Math.max(dy, 0) ** 2) - r;
    const inside = Math.min(Math.max(dx, dy), 0);
    return outside + inside;
  }

  // ═══════════════════════════════════════════════════════════
  //  POINTER TRACKING
  // ═══════════════════════════════════════════════════════════
  private setupPointer(): void {
    const onMove = (e: PointerEvent) => {
      const rect = this.el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      this.targetAngle = Math.atan2(py - 0.5, px - 0.5) * (180 / Math.PI) - 90;
      if (!this.animatingLight) { this.animatingLight = true; this.tickLight(); }
    };
    const onLeave = () => {
      this.targetAngle = this.cfg.lightAngle;
      if (!this.animatingLight) { this.animatingLight = true; this.tickLight(); }
    };
    this.el.addEventListener('pointermove', onMove, { passive: true });
    this.el.addEventListener('pointerleave', onLeave, { passive: true });
  }

  private tickLight(): void {
    if (this.destroyed) return;
    const t0 = performance.now();

    let diff = this.targetAngle - this.currentAngle;
    diff = ((diff + 540) % 360) - 180;

    if (Math.abs(diff) < 0.4) {
      this.currentAngle = this.targetAngle;
      this.updateRim();
      this.updateSpecular();
      this.animatingLight = false;
      return;
    }
    this.currentAngle += diff * 0.12;
    this.updateRim();
    this.updateSpecular();

    const dt = performance.now() - t0;
    this._lastTime = dt;
    this._totalTime += dt;
    this._frameCount++;
    this.rafId = requestAnimationFrame(() => this.tickLight());
  }

  // ═══════════════════════════════════════════════════════════
  //  ANIMATIONS
  // ═══════════════════════════════════════════════════════════
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

  // ═══════════════════════════════════════════════════════════
  //  PUBLIC API
  // ═══════════════════════════════════════════════════════════
  getPerformanceMetrics() {
    return {
      avgFrameTime: this._frameCount > 0 ? this._totalTime / this._frameCount : 0,
      lastFrameTime: this._lastTime,
      frameCount: this._frameCount,
      quality: this.cfg.quality,
    };
  }

  updateConfig(config: Partial<LiquidGlassConfig>): void {
    this.cfg = { ...this.cfg, ...config };
    this.rebuildAll();
  }

  private rebuildAll(): void {
    [this.lensLayer, this.tintLayer, this.curvatureLayer, this.specularLayer, this.rimLayer]
      .forEach(l => l?.remove());
    this.lensLayer = this.tintLayer = this.curvatureLayer = this.specularLayer = this.rimLayer = null;
    if (this.svgEl) { this.svgEl.remove(); this.svgEl = null; }

    this.el.style.borderRadius = `${this.cfg.borderRadius}px`;
    this.el.style.filter = '';
    (this.el.style as any).WebkitFilter = '';

    this.buildAllLayers();
  }

  destroy(): void {
    this.destroyed = true;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.resizeObs?.disconnect();
    this.svgEl?.remove();
    this.lensLayer?.remove();
    this.tintLayer?.remove();
    this.curvatureLayer?.remove();
    this.specularLayer?.remove();
    this.rimLayer?.remove();

    if (this.pressHandlers) {
      this.el.removeEventListener('pointerdown', this.pressHandlers.down);
      this.el.removeEventListener('pointerup', this.pressHandlers.up);
      this.el.removeEventListener('pointerleave', this.pressHandlers.leave);
      this.pressHandlers = null;
    }

    const s = this.el.style;
    s.filter = s.backdropFilter = s.boxShadow = s.backgroundColor = '';
    s.borderRadius = s.overflow = s.isolation = s.transform = s.opacity = s.animation = '';
    (s as any).WebkitFilter = (s as any).WebkitBackdropFilter = '';
  }

  // Static: inject animation keyframes once
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

// ─── Helpers ────────────────────────────────────────────────
function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

function clamp8(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

/**
 * Lens profile function — controls how displacement varies from rim to center.
 * t = 0 at the lens rim, t = 1 at the center.
 *
 * Physical basis: a convex lens has maximum curvature (and thus maximum
 * refraction) somewhere between center and edge. At the very rim the lens
 * meets the flat frame (zero displacement). At center, the lens is nearly
 * flat (minimal displacement for a thin lens).
 *
 * The profile is a smoothstep rise then a gentle tapering:
 *   peak at t ≈ 0.25 (near the edge, where curvature is max)
 *   → this matches real glass behavior and Apple's visual style.
 */
function lensProfile(t: number): number {
  // t = 0: glass rim  → displacement = 0 (glass meets frame, rays parallel)
  // t ≈ 0.12: peak    → displacement = 1 (maximum surface curvature)
  // t = 1: center     → displacement = 0 (flat glass center, no bend)
  //
  // Sharp bell curve concentrated in the rim band. The rise is fast (0→peak
  // in just 12% of the radius) and the fall is gradual, creating the
  // "thick glass rim" look characteristic of Apple liquid glass where you see
  // a clear center and strongly bent edges.
  const rise = smoothstep(0, 0.12, t);
  const fall = 1.0 - smoothstep(0.12, 0.72, t);
  return rise * fall;
}
