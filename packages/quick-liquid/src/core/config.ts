export interface LiquidGlassConfig {
  /** Respect system reduced motion and transparency. Default true. */
  respectPreferences?: boolean;
  /** Automatic frost gating, or always retain exact RGB dispersion. */
  dispersionMode?: 'auto' | 'exact';

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

  chromaticAberration: 0.18,

  lightAngle: -35,
  edgeHighlight: 0.9,
  specularStrength: 0.26,
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
  respectPreferences: true,
  dispersionMode: 'auto',
};

export const MATERIAL_PRESETS: Record<string, Partial<LiquidGlassConfig>> = {
  // Inspired by clear Liquid Glass — transparent, strong lensing
  clear:   { blur: 2,  saturation: 1.55, tintOpacity: 0.03, refractionStrength: 26, bezelWidth: 36, thickness: 26 },
  thin:    { blur: 6,  saturation: 1.5,  tintOpacity: 0.05, refractionStrength: 18, bezelWidth: 26, thickness: 18 },
  // Inspired by regular Liquid Glass — frosted, softer lensing
  regular: { blur: 14, saturation: 1.7,  tintOpacity: 0.09, refractionStrength: 16, bezelWidth: 30, thickness: 20 },
  thick:   { blur: 22, saturation: 1.8,  tintOpacity: 0.13, refractionStrength: 12, bezelWidth: 28, thickness: 18 },
  ultra:   { blur: 30, saturation: 1.85, tintOpacity: 0.17, refractionStrength: 10, bezelWidth: 26, thickness: 16 },
  adaptive:{ blur: 12, saturation: 1.6,  tintOpacity: 0.06, refractionStrength: 18, bezelWidth: 30, thickness: 20, adaptiveTint: true },
};


/** Keep user overrides distinct from the values supplied by a material. */
export function resolveGlassConfig(input: Partial<LiquidGlassConfig>): LiquidGlassConfig {
  const config = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) as Partial<LiquidGlassConfig>;
  const preset = config.material ? MATERIAL_PRESETS[config.material] : undefined;
  const resolved = { ...DEFAULT_CONFIG, ...preset, ...config };
  if (config.distortionStrength !== undefined && config.refractionStrength === undefined) resolved.refractionStrength = config.distortionStrength;
  if (config.dynamicLighting && config.cursorTracking === undefined) resolved.cursorTracking = true;
  const bounds: Partial<Record<keyof LiquidGlassConfig, [number, number]>> = {
    blur: [0, 80], saturation: [0, 4], tintOpacity: [0, 1], refractionStrength: [0, 150],
    bezelWidth: [0.5, 256], thickness: [0.1, 256], ior: [1, 3], chromaticAberration: [0, 1],
    edgeHighlight: [0, 1], specularStrength: [0, 1], fresnelPower: [1, 6],
    elevation: [0, 5], noiseOpacity: [0, 1], noiseScale: [0.1, 10], borderRadius: [0, 10000],
    backdropLuminance: [0, 1], tintStrength: [0, 5],
  };
  for (const [key, range] of Object.entries(bounds)) {
    const k = key as keyof LiquidGlassConfig;
    const value = resolved[k];
    if (value === undefined) continue;
    const [lo, hi] = range!;
    (resolved as unknown as Record<string, unknown>)[key] =
      typeof value === 'number' && Number.isFinite(value) ? Math.max(lo, Math.min(hi, value)) : DEFAULT_CONFIG[k];
  }
  if (!Number.isFinite(resolved.lightAngle)) resolved.lightAngle = DEFAULT_CONFIG.lightAngle;
  return resolved;
}
