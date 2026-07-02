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
  // Material System
  material?: 'thin' | 'regular' | 'thick' | 'ultra' | 'adaptive';
  
  // Optical Depth & Blur
  blur: number;
  edgeBlurModifier?: number;
  saturation: number;
  
  // Tint & Vibrancy
  adaptiveTint?: boolean;
  tintStrength?: number;
  environmentSampling?: 'none' | 'fast' | 'high-quality';
  tint: string;
  tintOpacity: number;
  
  // Refraction
  refractionStrength: number;
  distortionStrength?: number;
  edgeDistortion?: number;
  ior: number;
  
  // Chromatic Aberration
  chromaticAberration: number;
  caEdgeOnly?: boolean;
  
  // Fresnel & Specular
  specularStrength: number;
  fresnelPower?: number;
  edgeHighlight: number;
  
  // Noise
  noiseOpacity: number;
  noiseScale: number;
  
  // Interaction & Motion
  hoverLighting: boolean;
  cursorTracking: boolean;
  parallax: boolean;
  inertia: boolean;
  
  // Depth & Shadows
  thickness: number;
  elevation: number;
  shadowDiffusion: number;
  
  // Base
  borderRadius: number;
  lightAngle: number;
  dynamicLighting: boolean;
  quality: 'high' | 'medium' | 'low';
  refractionMode: 'auto' | 'svg' | 'css';
}

export const DEFAULT_CONFIG: LiquidGlassConfig = {
  blur: 10,
  saturation: 1.45,
  borderRadius: 32,
  refractionStrength: 34,
  ior: 1.45,
  edgeHighlight: 0.85,
  chromaticAberration: 0.16,
  thickness: 3,
  lightAngle: -60,
  dynamicLighting: false,
  quality: 'high',
  refractionMode: 'svg',
  tint: '255, 255, 255',
  tintOpacity: 0.08,
  specularStrength: 0.78,
  
  edgeBlurModifier: 1.35,
  adaptiveTint: false,
  tintStrength: 1.0,
  environmentSampling: 'fast',
  distortionStrength: 34,
  edgeDistortion: 0.42,
  caEdgeOnly: true,
  fresnelPower: 2.0,
  noiseOpacity: 0.012,
  noiseScale: 1.0,
  hoverLighting: true,
  cursorTracking: false,
  parallax: false,
  inertia: true,
  elevation: 2,
  shadowDiffusion: 4,
};

export const MATERIAL_PRESETS: Record<string, Partial<LiquidGlassConfig>> = {
  thin: { blur: 6, thickness: 1.5, refractionStrength: 24, tintOpacity: 0.055, noiseOpacity: 0.006, edgeBlurModifier: 1.15 },
  regular: { blur: 10, thickness: 3, refractionStrength: 34, tintOpacity: 0.08, noiseOpacity: 0.012, edgeBlurModifier: 1.35 },
  thick: { blur: 16, thickness: 5, refractionStrength: 44, tintOpacity: 0.11, noiseOpacity: 0.014, edgeBlurModifier: 1.6 },
  ultra: { blur: 22, thickness: 7, refractionStrength: 56, tintOpacity: 0.14, noiseOpacity: 0.018, edgeBlurModifier: 1.85 },
  adaptive: { blur: 12, adaptiveTint: true, tintOpacity: 0.06, saturation: 1.25, refractionStrength: 36 },
};

let uid = 0;

export class LiquidGlassEngine {
  private el: HTMLElement;
  private cfg: LiquidGlassConfig;
  public id: string;

  // Layer refs
  private lensLayer: HTMLDivElement | null = null;
  private tintLayer: HTMLDivElement | null = null;
  private curvatureLayer: HTMLDivElement | null = null;
  private specularLayer: HTMLDivElement | null = null;
  private rimLayer: HTMLDivElement | null = null;
  private noiseLayer: HTMLDivElement | null = null;

  // SVG filter (lens displacement)
  private svgEl: SVGSVGElement | null = null;

  private resizeObs: ResizeObserver | null = null;
  private destroyed = false;
  private rafId: number | null = null;
  private animatingLight = false;
  
  // Spring/Motion State
  private currentAngle: number;
  private targetAngle: number;
  private angleVelocity = 0;
  
  private currentParallaxX = 0;
  private targetParallaxX = 0;
  private parallaxXVelocity = 0;
  
  private currentParallaxY = 0;
  private targetParallaxY = 0;
  private parallaxYVelocity = 0;
  
  private currentHoverGlow = 0;
  private targetHoverGlow = 0;
  private hoverGlowVelocity = 0;

  private _frameCount = 0;
  private _totalTime = 0;
  private _lastTime = 0;

  private currentBlobUrls: string[] = [];
  private lensBuildVersion = 0;
  private static _svgOk: boolean | null = null;
  private pressHandlers: { down: () => void; up: () => void; leave: () => void } | null = null;

  constructor(element: HTMLElement, config: Partial<LiquidGlassConfig> = {}) {
    this.el = element;
    
    // Merge base config
    let merged = { ...DEFAULT_CONFIG, ...config };
    
    // Apply material presets if defined
    if (merged.material && MATERIAL_PRESETS[merged.material]) {
      merged = { ...merged, ...MATERIAL_PRESETS[merged.material], ...config };
    }
    
    // Sync aliases
    if (merged.distortionStrength !== undefined) merged.refractionStrength = merged.distortionStrength;
    if (merged.dynamicLighting) merged.cursorTracking = true;
    
    this.cfg = merged;
    this.id = `ql${++uid}`;
    this.currentBlobUrls = [];
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

    this.buildAllLayers().catch(console.error);

    this.resizeObs = new ResizeObserver(() => {
      if (cfg.refractionStrength > 0) this.rebuildLensFilter();
    });
    this.resizeObs.observe(el);

    if (cfg.cursorTracking || cfg.hoverLighting || cfg.parallax) {
      this.setupPointer();
    }
  }

  private async buildAllLayers(): Promise<void> {
    await this.buildLensFilter();       // SVG displacement map
    if (this.destroyed) return;
    this.createLensLayer();       // Layer 0: the actual glass lens + blur
    this.createTintLayer();       // Layer 1: subtle white tint
    this.createCurvatureLayer();  // Layer 2: inner convex-lens brightness gradient
    this.createSpecularLayer();   // Layer 3: Fresnel specular crescent
    this.createRimLayer();        // Layer 4: gradient border + inner rim line
    this.createNoiseLayer();      // Layer 5: surface noise
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
    const layer = document.createElement('div');
    layer.className = 'ql-lens';

    Object.assign(layer.style, {
      position: 'absolute',
      inset: '0',
      zIndex: '0',
      borderRadius: 'inherit',
      pointerEvents: 'none',
      overflow: 'hidden',
    });

    this.lensLayer = layer;
    this.updateLensStyle();
    this.el.insertBefore(layer, this.el.firstChild);
  }

  private updateLensStyle(): void {
    if (!this.lensLayer) return;
    const cfg = this.cfg;
    const hasSVG = this.svgEl && this.shouldUseSVG();
    const svgPart = hasSVG ? `url(#${this.id}) ` : '';
    const satPart = cfg.saturation !== 1 ? `saturate(${cfg.saturation})` : '';

    if (cfg.edgeBlurModifier && cfg.edgeBlurModifier > 1.0) {
      // Dual-layer masked blur for varying blur density
      const baseBlur = `blur(${cfg.blur}px) `;
      const edgeBlurAmount = Math.round(cfg.blur * cfg.edgeBlurModifier);
      const edgeBlur = `blur(${edgeBlurAmount}px) `;
      const opticalPart = `brightness(1.06) contrast(1.04)`;

      const baseFilter = `${svgPart}${baseBlur}${satPart} ${opticalPart}`.trim() || 'none';
      const edgeFilter = `${svgPart}${edgeBlur}${satPart} ${opticalPart}`.trim() || 'none';

      let baseEl = this.lensLayer.children[0] as HTMLElement;
      let edgeEl = this.lensLayer.children[1] as HTMLElement;
      
      if (!baseEl || !edgeEl) {
        this.lensLayer.innerHTML = '';
        baseEl = document.createElement('div');
        Object.assign(baseEl.style, { position: 'absolute', inset: '0', borderRadius: 'inherit' });
        edgeEl = document.createElement('div');
        Object.assign(edgeEl.style, { position: 'absolute', inset: '0', borderRadius: 'inherit' });
        const mask = `radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.35) 70%, black 100%)`;
        edgeEl.style.maskImage = mask;
        (edgeEl.style as any).WebkitMaskImage = mask;
        this.lensLayer.appendChild(baseEl);
        this.lensLayer.appendChild(edgeEl);
      }

      baseEl.style.backdropFilter = baseFilter;
      (baseEl.style as any).WebkitBackdropFilter = baseFilter;
      edgeEl.style.backdropFilter = edgeFilter;
      (edgeEl.style as any).WebkitBackdropFilter = edgeFilter;
    } else {
      this.lensLayer.innerHTML = '';
      const blurPart = cfg.blur > 0 ? `blur(${cfg.blur}px) ` : '';
      const bdf = `${svgPart}${blurPart}${satPart} brightness(1.06) contrast(1.04)`.trim() || 'none';
      this.lensLayer.style.backdropFilter = bdf;
      (this.lensLayer.style as any).WebkitBackdropFilter = bdf;
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  LAYER 1 — TINT
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
    });
    
    this.tintLayer = layer;
    this.updateTintStyle();
    this.el.insertBefore(layer, this._contentEl());
  }

  private updateTintStyle(): void {
    const cfg = this.cfg;
    if (cfg.tintOpacity <= 0) {
      this.tintLayer?.remove();
      this.tintLayer = null;
      return;
    }
    if (!this.tintLayer) {
      this.createTintLayer();
      return;
    }
    const mixBlendMode = cfg.adaptiveTint ? 'overlay' : 'normal';
    const opacity = cfg.tintOpacity * (cfg.tintStrength || 1.0);
    Object.assign(this.tintLayer.style, {
      background: [
        `linear-gradient(180deg,
          rgba(${cfg.tint}, ${(opacity * 1.25).toFixed(3)}) 0%,
          rgba(${cfg.tint}, ${(opacity * 0.82).toFixed(3)}) 48%,
          rgba(${cfg.tint}, ${(opacity * 0.48).toFixed(3)}) 100%
        )`,
        `radial-gradient(ellipse 90% 55% at 50% 0%,
          rgba(255,255,255,${(opacity * 0.7).toFixed(3)}) 0%,
          transparent 70%
        )`,
      ].join(', '),
      mixBlendMode: mixBlendMode,
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  LAYER 2 — CURVATURE GRADIENT & INNER SHADOW
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
      transition: 'background 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
    });
    this.curvatureLayer = layer;
    this.updateCurvature();
    this.el.insertBefore(layer, this._contentEl());
  }

  private updateCurvature(): void {
    if (!this.curvatureLayer) return;
    const hoverOpacity = this.cfg.hoverLighting ? 0.12 : 0.08;
    Object.assign(this.curvatureLayer.style, {
      background: [
        `radial-gradient(ellipse 105% 90% at 50% -18%,
          rgba(255,255,255,${hoverOpacity}) 0%,
          rgba(255,255,255,0.035) 42%,
          transparent 100%
        )`,
        `radial-gradient(ellipse 120% 90% at 50% 115%,
          rgba(0,0,0,0.10) 0%,
          transparent 56%
        )`,
        `linear-gradient(90deg,
          rgba(255,255,255,0.055) 0%,
          transparent 14%,
          transparent 86%,
          rgba(0,0,0,0.06) 100%
        )`
      ].join(', '),
      boxShadow: [
        `inset 0 0 ${Math.max(18, this.cfg.thickness * 12)}px rgba(255,255,255,0.045)`,
        `inset 0 -${Math.max(10, this.cfg.thickness * 5)}px ${Math.max(18, this.cfg.thickness * 10)}px rgba(0,0,0,0.08)`,
      ].join(', '),
    });
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
    this.el.insertBefore(layer, this._contentEl());
  }

  private updateSpecular(): void {
    if (!this.specularLayer) return;
    const hi = this.cfg.specularStrength;
    const angle = this.currentAngle;
    const ca = this.cfg.chromaticAberration;
    const fresnel = Math.max(0.65, Math.min(4, this.cfg.fresnelPower ?? 2));
    const focus = Math.max(0.62, Math.min(1.45, 2 / fresnel));

    // Light direction mapped from angle (degrees → unit vector)
    const rad = (angle * Math.PI) / 180;
    const lx = Math.sin(rad); // -1=left, +1=right
    const ly = -Math.cos(rad); // -1=top, +1=bottom

    const hotX = 50 + lx * 30;
    const hotY = Math.max(-4, 9 + ly * 12);
    const r2 = Math.round(255);
    const g2 = Math.round(255 - ca * 10);
    const b2 = Math.round(255 - ca * 5);
    const primaryW = 34 * focus;
    const primaryH = 18 * focus;
    const shoulderW = 90 * focus;
    const shoulderH = 28 * focus;

    this.specularLayer!.style.background = [
      `radial-gradient(ellipse ${primaryW.toFixed(1)}% ${primaryH.toFixed(1)}% at ${hotX.toFixed(1)}% ${hotY.toFixed(1)}%,
        rgba(${r2},${g2},${b2},${(hi * 0.72 * Math.min(1.18, fresnel / 2)).toFixed(3)}) 0%,
        rgba(255,255,255,${(hi * 0.34).toFixed(3)}) 32%,
        transparent 78%
      )`,
      `radial-gradient(ellipse ${shoulderW.toFixed(1)}% ${shoulderH.toFixed(1)}% at ${hotX.toFixed(1)}% 0%,
        rgba(255,255,255,${(hi * 0.18).toFixed(3)}) 0%,
        transparent 78%
      )`,
      `linear-gradient(180deg,
        rgba(255,255,255,${(hi * 0.58).toFixed(3)}) 0%,
        rgba(255,255,255,${(hi * 0.15).toFixed(3)}) 2px,
        transparent 9px
      )`,
      `linear-gradient(115deg,
        transparent 0%,
        transparent 18%,
        rgba(255,255,255,${(hi * 0.12).toFixed(3)}) 45%,
        transparent 64%,
        transparent 100%
      )`,
    ].join(', ');
    return;

    // Specular hotspot position — on the lit side, near the edge
    // Apple typical: upper-left area at about (30%, 5%)
    const hx = 50 + lx * 22; // 28–72% horizontally
    const hy = Math.max(2, 10 + ly * 8); // keep near top

    // Chromatic aberration tints the specular slightly (just barely perceptible)
    // warm on the lit edge, cool on the opposite edge
    const r = Math.round(255);
    const g = Math.round(255 - ca * 10);
    const b = Math.round(255 - ca * 5);

    this.specularLayer!.style.background = [
      // 1. PRIMARY SPECULAR — extremely soft, wide ambient glow (Apple style)
      `radial-gradient(ellipse 120% 60% at ${hx.toFixed(1)}% ${hy.toFixed(1)}%,
        rgba(${r},${g},${b},${(hi * 0.40).toFixed(3)}) 0%,
        rgba(255,255,255,${(hi * 0.15).toFixed(3)}) 40%,
        transparent 100%
      )`,
      // 2. SOFT SHOULDER — wide gentle glow behind the hotspot.
      `radial-gradient(ellipse 150% 50% at ${hx.toFixed(1)}% 0%,
        rgba(255,255,255,${(hi * 0.15).toFixed(3)}) 0%,
        transparent 100%
      )`,
      // 3. TOP EDGE LINE — extremely thin, low opacity
      `linear-gradient(180deg,
        rgba(255,255,255,${(hi * 0.30).toFixed(3)}) 0%,
        rgba(255,255,255,${(hi * 0.05).toFixed(3)}) 2%,
        transparent 5%
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
    this.el.insertBefore(layer, this._contentEl());
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
    const topOp   = Math.min(0.86, hi * 0.92);
    const sideOp  = Math.min(0.42, hi * 0.46);
    const btmOp   = Math.min(0.18, hi * 0.22);

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
          rgba(255,255,255,${btmOp.toFixed(3)})  100%
        )`,
      ].join(', '),
      backgroundOrigin: 'border-box',
      backgroundClip: 'padding-box, border-box',
      boxShadow: [
        // Inner top rim — simulates the top glass face at the border
        `inset 0 1px 0 rgba(255,255,255,${(hi * 0.82).toFixed(3)})`,
        `inset 1px 0 0 rgba(255,255,255,${(hi * 0.22).toFixed(3)})`,
        `inset -1px 0 0 rgba(255,255,255,${(hi * 0.10).toFixed(3)})`,
        // Inner bottom dimmer edge
        `inset 0 -1px 0 rgba(0,0,0,${(hi * 0.16).toFixed(3)})`,
        // Outer glow — barely visible, just enough to separate from background
        `0 0 0 0.5px rgba(255,255,255,${(hi * 0.20).toFixed(3)})`,
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
  // ═══════════════════════════════════════════════════════════
  //  LAYER 5 — NOISE (Film Grain / Realism)
  // ═══════════════════════════════════════════════════════════
  private createNoiseLayer(): void {
    if (this.noiseLayer) this.noiseLayer.remove();
    const cfg = this.cfg;
    if (cfg.noiseOpacity <= 0) return;

    const layer = document.createElement('div');
    layer.className = 'ql-noise';
    Object.assign(layer.style, {
      position: 'absolute',
      inset: '0',
      zIndex: '5',
      borderRadius: 'inherit',
      pointerEvents: 'none',
      mixBlendMode: 'overlay',
    });
    this.noiseLayer = layer;
    this.updateNoise();
    this.el.insertBefore(layer, this._contentEl());
  }

  private updateNoise(): void {
    const cfg = this.cfg;
    if (cfg.noiseOpacity <= 0) {
      this.noiseLayer?.remove();
      this.noiseLayer = null;
      return;
    }
    if (!this.noiseLayer) {
      this.createNoiseLayer();
      return;
    }
    const noiseSvg = `data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E`;
    
    Object.assign(this.noiseLayer.style, {
      backgroundImage: `url("${noiseSvg}")`,
      opacity: cfg.noiseOpacity.toString(),
      backgroundSize: `${100 * cfg.noiseScale}px ${100 * cfg.noiseScale}px`,
    });
  }

  /**
   * Returns the ql-content child div inserted by the React wrapper,
   * or null if not found. All glass layers must be inserted BEFORE this.
   */
  private _contentEl(): Element | null {
    return this.el.querySelector(':scope > .ql-content');
  }

  // ═══════════════════════════════════════════════════════════
  //  DEPTH SHADOWS
  // ═══════════════════════════════════════════════════════════
  private applyDepth(): void {
    const t = this.cfg.thickness;
    // Bug fix #3: use thickness (the user-facing depth control) as the sole shadow driver.
    // elevation/shadowDiffusion are derived from it so the slider is consistent.
    if (t < 1) { this.el.style.boxShadow = 'none'; return; }
    const rad = (this.currentAngle * Math.PI) / 180;
    const sx = Math.round(Math.sin(rad) * t * -2.4);
    const sy = Math.round(Math.max(1, Math.cos(rad) * t * 2.2 + t * 5.2));
    this.el.style.boxShadow = [
      `${sx}px ${sy}px ${Math.round(t * 22)}px rgba(0,0,0,0.18)`,
      `${Math.round(sx * 0.35)}px ${Math.round(sy * 0.22)}px ${Math.round(t * 5)}px rgba(0,0,0,0.10)`,
      `0 0 ${Math.round(t * 10)}px rgba(255,255,255,0.05)`,
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
    if (typeof document === 'undefined') return false;

    // CSS.supports('backdrop-filter', 'url(#x)') is unreliable:
    // Chrome/Edge report false even though they fully support it at runtime.
    // Use a live DOM probe: inject a test filter + a div, then read computedStyle.
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
      probe.style.cssText = [
        'position:fixed;top:0;left:0;width:1px;height:1px;',
        'backdrop-filter:url(#__ql_probe__);',
        '-webkit-backdrop-filter:url(#__ql_probe__);',
        'pointer-events:none;',
      ].join('');
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

  private async buildLensFilter(): Promise<void> {
    if (!this.shouldUseSVG() || this.cfg.refractionStrength <= 0) return;
    await this.rebuildLensFilter();
  }

  private async rebuildLensFilter(): Promise<void> {
    const buildVersion = ++this.lensBuildVersion;
    if (this.svgEl) { this.svgEl.remove(); this.svgEl = null; }
    this.currentBlobUrls.forEach(url => URL.revokeObjectURL(url));
    this.currentBlobUrls = [];
    if (!this.shouldUseSVG() || this.cfg.refractionStrength <= 0) {
      return;
    }

    // Use offsetWidth/Height — layout dimensions in CSS pixels, independent of transforms.
    // CRITICAL: Do NOT use getBoundingClientRect() here — it returns visual (post-transform)
    // dimensions which don't match the filterUnits="userSpaceOnUse" coordinate system.
    const w = this.el.offsetWidth || 200;
    const h = this.el.offsetHeight || 100;
    if (w < 4 || h < 4) {
      return;
    }

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

    if (ca > 0 && this.cfg.quality === 'high') {
      // CHROMATIC ABERRATION MODE
      //
      // Each RGB channel gets displaced by a slightly different amount:
      //   R bends most (glass disperses red least — appears shifted outward more)
      //   G is the reference (middle wavelength)
      //   B bends least (shortest wavelength bends most in glass — appears shifted inward)
      //
      // After displacing each channel separately, we isolate it with feComponentTransfer
      // (zero the other two channels) then screen-blend the three together.
      // feComponentTransfer is used over feColorMatrix because CM channel isolation
      // darkens the alpha implicitly on some browsers, whereas feFuncX type=discrete
      // zeroes only the colour channels without touching alpha.
      const scaleR = scale * (1 + ca * 0.3);
      const scaleG = scale;
      const scaleB = scale * Math.max(0.1, 1 - ca * 0.2);

      const [mapURIR, mapURIG, mapURIB] = await Promise.all([
        this.generateLensMap(qw, qh, w, h, 'R'),
        this.generateLensMap(qw, qh, w, h, 'G'),
        this.generateLensMap(qw, qh, w, h, 'B'),
      ]);
      if (this.destroyed || buildVersion !== this.lensBuildVersion) {
        [mapURIR, mapURIG, mapURIB].forEach(url => URL.revokeObjectURL(url));
        return;
      }
      this.currentBlobUrls.push(mapURIR, mapURIG, mapURIB);

      filterContent = `
        <feImage href="${mapURIR}" result="mapR" preserveAspectRatio="none" x="0" y="0" width="${w}" height="${h}"/>
        <feImage href="${mapURIG}" result="mapG" preserveAspectRatio="none" x="0" y="0" width="${w}" height="${h}"/>
        <feImage href="${mapURIB}" result="mapB" preserveAspectRatio="none" x="0" y="0" width="${w}" height="${h}"/>

        <feDisplacementMap in="SourceGraphic" in2="mapR" scale="${scaleR.toFixed(1)}" xChannelSelector="R" yChannelSelector="G" result="dispR"/>
        <feDisplacementMap in="SourceGraphic" in2="mapG" scale="${scaleG.toFixed(1)}" xChannelSelector="R" yChannelSelector="G" result="dispG"/>
        <feDisplacementMap in="SourceGraphic" in2="mapB" scale="${scaleB.toFixed(1)}" xChannelSelector="R" yChannelSelector="G" result="dispB"/>

        <feComponentTransfer in="dispR" result="onlyR">
          <feFuncR type="identity"/>
          <feFuncG type="discrete" tableValues="0"/>
          <feFuncB type="discrete" tableValues="0"/>
          <feFuncA type="identity"/>
        </feComponentTransfer>
        <feComponentTransfer in="dispG" result="onlyG">
          <feFuncR type="discrete" tableValues="0"/>
          <feFuncG type="identity"/>
          <feFuncB type="discrete" tableValues="0"/>
          <feFuncA type="identity"/>
        </feComponentTransfer>
        <feComponentTransfer in="dispB" result="onlyB">
          <feFuncR type="discrete" tableValues="0"/>
          <feFuncG type="discrete" tableValues="0"/>
          <feFuncB type="identity"/>
          <feFuncA type="identity"/>
        </feComponentTransfer>

        <feBlend in="onlyR" in2="onlyG" mode="screen" result="RG"/>
        <feBlend in="RG" in2="onlyB" mode="screen"/>
      `;
    } else {
      // STANDARD MODE — single displacement map
      const mapURI = await this.generateLensMap(qw, qh, w, h, 'all');
      if (this.destroyed || buildVersion !== this.lensBuildVersion) {
        URL.revokeObjectURL(mapURI);
        return;
      }
      this.currentBlobUrls.push(mapURI);
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
    if (this.destroyed || buildVersion !== this.lensBuildVersion) {
      this.svgEl = null;
      return;
    }
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
  private generateLensMap(qw: number, qh: number, elW: number, elH: number, channel: 'R' | 'G' | 'B' | 'all' = 'all'): Promise<string> {
    return new Promise((resolve) => {
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
    const iorPower = Math.max(0.08, Math.min(1.45, (1 - 1 / this.cfg.ior) / (1 - 1 / 1.45)));
    const edgeDistortion = Math.max(0, Math.min(1, this.cfg.edgeDistortion ?? 0.42));

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
        const profile = lensProfile(t, edgeDistortion) * iorPower;

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
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(URL.createObjectURL(blob));
      } else {
        resolve(canvas.toDataURL('image/png')); // fallback if blob fails
      }
    }, 'image/png');
    });
  }

  private sdfRoundedRect(px: number, py: number, cx: number, cy: number, r: number): number {
    const dx = Math.abs(px - cx) - (cx - r);
    const dy = Math.abs(py - cy) - (cy - r);
    const outside = Math.sqrt(Math.max(dx, 0) ** 2 + Math.max(dy, 0) ** 2) - r;
    const inside = Math.min(Math.max(dx, dy), 0);
    return outside + inside;
  }

  private _pointerMoveHandler?: (e: PointerEvent) => void;
  private _pointerLeaveHandler?: () => void;
  private _pointerEnterHandler?: () => void;

  // Bug fix #6 & #7: Do NOT capture cfg by closure — always read this.cfg at call time.
  // This ensures interactions work correctly even after updateConfig() replaces this.cfg.
  private setupPointer(): void {
    // Remove existing listeners first (called again after rebuild)
    this.teardownPointer();

    this._pointerEnterHandler = () => {
      if (this.cfg.hoverLighting) {
        this.targetHoverGlow = 1;
        if (!this.animatingLight) { this.animatingLight = true; this.tickLight(); }
      }
    };

    this._pointerMoveHandler = (e: PointerEvent) => {
      const rect = this.el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;

      if (this.cfg.cursorTracking) {
        this.targetAngle = Math.atan2(py - 0.5, px - 0.5) * (180 / Math.PI) - 90;
      }

      if (this.cfg.parallax) {
        this.targetParallaxX = (px - 0.5) * 2;
        this.targetParallaxY = (py - 0.5) * 2;
      }

      if (!this.animatingLight) { this.animatingLight = true; this.tickLight(); }
    };

    this._pointerLeaveHandler = () => {
      this.targetAngle = this.cfg.lightAngle;
      this.targetParallaxX = 0;
      this.targetParallaxY = 0;
      this.targetHoverGlow = 0;
      if (!this.animatingLight) { this.animatingLight = true; this.tickLight(); }
    };

    this.el.addEventListener('mouseenter', this._pointerEnterHandler, { passive: true });
    this.el.addEventListener('pointermove', this._pointerMoveHandler, { passive: true });
    this.el.addEventListener('pointerleave', this._pointerLeaveHandler, { passive: true });
  }

  private teardownPointer(): void {
    if (this._pointerEnterHandler) {
      this.el.removeEventListener('mouseenter', this._pointerEnterHandler);
      this._pointerEnterHandler = undefined;
    }
    if (this._pointerMoveHandler) {
      this.el.removeEventListener('pointermove', this._pointerMoveHandler);
      this._pointerMoveHandler = undefined;
    }
    if (this._pointerLeaveHandler) {
      this.el.removeEventListener('pointerleave', this._pointerLeaveHandler);
      this._pointerLeaveHandler = undefined;
    }
  }

  private tickLight(): void {
    if (this.destroyed) return;
    const t0 = performance.now();
    // Bug fix #6: always read this.cfg — never a stale local ref
    const cfg = this.cfg;

    let diff = this.targetAngle - this.currentAngle;
    diff = ((diff + 540) % 360) - 180;

    let isMoving = false;

    // 1. Angle (Lighting)
    if (Math.abs(diff) > 0.1 || Math.abs(this.angleVelocity) > 0.01) {
      isMoving = true;
      if (cfg.inertia) {
        const k = 0.15;
        const d = 0.6;
        this.angleVelocity = (this.angleVelocity + diff * k) * d;
        this.currentAngle += this.angleVelocity;
      } else {
        this.currentAngle += diff * 0.12;
      }
      this.updateRim();
      this.updateSpecular();
    } else {
      // Bug fix #5: snap to target so diff recalc next frame is truly 0
      this.currentAngle = this.targetAngle;
      this.angleVelocity = 0;
    }

    // 2. Parallax
    if (cfg.parallax) {
      const pDiffX = this.targetParallaxX - this.currentParallaxX;
      const pDiffY = this.targetParallaxY - this.currentParallaxY;

      if (Math.abs(pDiffX) > 0.001 || Math.abs(pDiffY) > 0.001 ||
          Math.abs(this.parallaxXVelocity) > 0.001 || Math.abs(this.parallaxYVelocity) > 0.001) {
        isMoving = true;
        if (cfg.inertia) {
          const k = 0.1;
          const d = 0.7;
          this.parallaxXVelocity = (this.parallaxXVelocity + pDiffX * k) * d;
          this.parallaxYVelocity = (this.parallaxYVelocity + pDiffY * k) * d;
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

    // 3. Hover Glow
    if (cfg.hoverLighting) {
      const gDiff = this.targetHoverGlow - this.currentHoverGlow;
      if (Math.abs(gDiff) > 0.005 || Math.abs(this.hoverGlowVelocity) > 0.005) {
        isMoving = true;
        this.hoverGlowVelocity = (this.hoverGlowVelocity + gDiff * 0.05) * 0.75;
        this.currentHoverGlow += this.hoverGlowVelocity;

        if (this.curvatureLayer) {
          const baseOp = 0.06;
          const activeOp = 0.15;
          const op = baseOp + (activeOp - baseOp) * Math.max(0, Math.min(1, this.currentHoverGlow));
          this.curvatureLayer.style.background = [
            `radial-gradient(ellipse 100% 100% at 50% -20%,`,
            `  rgba(255,255,255,${op.toFixed(3)}) 0%,`,
            `  rgba(255,255,255,0.02) 50%,`,
            `  transparent 100%`,
            `)`,
          ].join(' ');
        }
      } else {
        this.currentHoverGlow = this.targetHoverGlow;
        this.hoverGlowVelocity = 0;
      }
    }

    // Bug fix #5: check isMoving AFTER all updates so we use the freshly-computed state
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
    if (this.destroyed) return;
    const oldCfg = this.cfg;
    this.cfg = { ...this.cfg, ...config };

    const svgNeedsRebuild =
      oldCfg.refractionStrength !== this.cfg.refractionStrength ||
      oldCfg.chromaticAberration !== this.cfg.chromaticAberration ||
      oldCfg.quality !== this.cfg.quality ||
      oldCfg.refractionMode !== this.cfg.refractionMode ||
      oldCfg.borderRadius !== this.cfg.borderRadius ||
      oldCfg.ior !== this.cfg.ior ||
      oldCfg.edgeDistortion !== this.cfg.edgeDistortion ||
      oldCfg.caEdgeOnly !== this.cfg.caEdgeOnly;

    if (svgNeedsRebuild) {
      this.id = `ql${++uid}`;
      this.rebuildAll();
    } else {
      // Surgical CSS update — no DOM teardown to maintain compositing performance
      this.el.style.borderRadius = `${this.cfg.borderRadius}px`;
      this.updateLensStyle();
      this.updateTintStyle();
      this.updateCurvature();
      this.updateSpecular();
      this.updateRim();
      this.updateNoise();
      this.applyDepth();
      this.syncPointerListeners();
    }
  }

  private syncPointerListeners(): void {
    if (this.cfg.cursorTracking || this.cfg.hoverLighting || this.cfg.parallax) {
      this.setupPointer();
    } else {
      this.teardownPointer();
    }
  }

  private rebuildAll(): void {
    // Bug fix #1 & #7: also remove noiseLayer and re-run setupPointer after rebuild
    [this.lensLayer, this.tintLayer, this.curvatureLayer, this.specularLayer, this.rimLayer, this.noiseLayer]
      .forEach(l => l?.remove());
    this.lensLayer = this.tintLayer = this.curvatureLayer = this.specularLayer = this.rimLayer = this.noiseLayer = null;
    if (this.svgEl) { this.svgEl.remove(); this.svgEl = null; }

    this.el.style.borderRadius = `${this.cfg.borderRadius}px`;
    this.el.style.filter = '';
    (this.el.style as any).WebkitFilter = '';

    void this.buildAllLayers();

    // Re-attach pointer listeners after rebuild so new cfg flags take effect
    this.syncPointerListeners();
  }

  destroy(): void {
    this.destroyed = true;
    this.lensBuildVersion++;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.resizeObs?.disconnect();
    this.svgEl?.remove();
    this.currentBlobUrls.forEach(url => URL.revokeObjectURL(url));
    this.currentBlobUrls = [];
    this.lensLayer?.remove();
    this.tintLayer?.remove();
    this.curvatureLayer?.remove();
    this.specularLayer?.remove();
    this.rimLayer?.remove();
    // Bug fix #2: also remove noiseLayer on destroy
    this.noiseLayer?.remove();

    if (this.pressHandlers) {
      this.el.removeEventListener('pointerdown', this.pressHandlers.down);
      this.el.removeEventListener('pointerup', this.pressHandlers.up);
      this.el.removeEventListener('pointerleave', this.pressHandlers.leave);
      this.pressHandlers = null;
    }
    // Bug fix #2: use teardownPointer for clean removal
    this.teardownPointer();

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
function lensProfile(t: number, edgeDistortion = 0.42): number {
  // t = 0: glass rim  → displacement = 0 (glass meets frame, rays parallel)
  // t ≈ 0.12: peak    → displacement = 1 (maximum surface curvature)
  // t = 1: center     → displacement = 0 (flat glass center, no bend)
  //
  // Sharp bell curve concentrated in the rim band. The rise is fast (0→peak
  // in just 12% of the radius) and the fall is gradual, creating the
  // "thick glass rim" look characteristic of Apple liquid glass where you see
  // a clear center and strongly bent edges.
  const rise = smoothstep(0, 0.08, t);
  const fall = 1.0 - smoothstep(0.22, 0.86, t);
  const rimKick = 1.0 - smoothstep(0, 0.18, t);
  return Math.min(1, rise * fall * 1.08 + rimKick * edgeDistortion * 0.52);
}
