/**
 * Single source of truth for every public LiquidGlassConfig property.
 * Drives both the interactive playground controls AND the docs API table,
 * so the two can never drift apart.
 */
import type { LiquidGlassConfig } from 'quick-liquid';

export type ControlSpec =
  | { kind: 'slider'; min: number; max: number; step: number; unit?: string; precision?: number }
  | { kind: 'toggle' }
  | { kind: 'select'; options: readonly string[] }
  | { kind: 'color' };

export interface PropertyDef {
  key: keyof LiquidGlassConfig;
  label: string;
  group: PropertyGroup;
  /** Type signature shown in the docs table */
  type: string;
  /** Default shown in the docs table */
  defaultValue: string;
  description: string;
  control: ControlSpec;
  /** Unset-by-default properties (e.g. backdropLuminance) */
  optional?: boolean;
}

export type PropertyGroup =
  | 'Material'
  | 'Frost & Color'
  | 'Refraction Geometry'
  | 'Dispersion'
  | 'Lighting'
  | 'Interaction'
  | 'Depth & Texture'
  | 'Rendering';

export const GROUP_ORDER: PropertyGroup[] = [
  'Material',
  'Frost & Color',
  'Refraction Geometry',
  'Dispersion',
  'Lighting',
  'Interaction',
  'Depth & Texture',
  'Rendering',
];

export const PROPERTIES: PropertyDef[] = [
  // ── Material ──────────────────────────────────────────────────
  {
    key: 'material',
    label: 'Material Preset',
    group: 'Material',
    type: `'clear' | 'thin' | 'regular' | 'thick' | 'ultra' | 'adaptive'`,
    defaultValue: '—',
    description:
      'Apple material preset. Sets blur, tint, refraction and bezel geometry together. Explicit config keys always win over the preset.',
    control: { kind: 'select', options: ['none', 'clear', 'thin', 'regular', 'thick', 'ultra', 'adaptive'] },
  },
  {
    key: 'appearance',
    label: 'Appearance',
    group: 'Material',
    type: `'light' | 'dark' | 'auto'`,
    defaultValue: `'auto'`,
    description:
      'Adapts the glass to the backdrop behind it — dark swaps the tint to deep smoke, derives rim/sheen from backdrop luminance, and replaces the drop shadow with an ambient glow. auto follows prefers-color-scheme live.',
    control: { kind: 'select', options: ['auto', 'light', 'dark'] },
  },

  // ── Frost & Color ─────────────────────────────────────────────
  {
    key: 'blur',
    label: 'Frost Blur',
    group: 'Frost & Color',
    type: 'number',
    defaultValue: '3',
    description: 'Backdrop frost blur in px. Clear glass ≈ 2, regular frosted ≈ 14, heavy sheets ≈ 24+.',
    control: { kind: 'slider', min: 0, max: 32, step: 0.5, unit: 'px', precision: 1 },
  },
  {
    key: 'saturation',
    label: 'Saturation',
    group: 'Frost & Color',
    type: 'number',
    defaultValue: '1.5',
    description: 'Backdrop saturation boost through the glass — colors pop the way they do through real glass.',
    control: { kind: 'slider', min: 1, max: 2.4, step: 0.05, precision: 2 },
  },
  {
    key: 'tint',
    label: 'Tint Color',
    group: 'Frost & Color',
    type: 'string',
    defaultValue: `'255, 255, 255'`,
    description: `Material tint as an 'r, g, b' string. Dark appearance auto-swaps the default white to deep smoke.`,
    control: { kind: 'color' },
  },
  {
    key: 'tintOpacity',
    label: 'Tint Opacity',
    group: 'Frost & Color',
    type: 'number',
    defaultValue: '0.04',
    description: 'Opacity of the material tint layer. Keep ≤ 0.05 for clear glass; frosted materials run 0.09–0.17.',
    control: { kind: 'slider', min: 0, max: 0.25, step: 0.005, precision: 3 },
  },

  // ── Refraction Geometry ───────────────────────────────────────
  {
    key: 'refractionStrength',
    label: 'Refraction',
    group: 'Refraction Geometry',
    type: 'number',
    defaultValue: '22',
    description:
      'Max rim displacement in px (0 disables refraction). The falloff shape is physical — it comes from thickness, bezelWidth and ior.',
    control: { kind: 'slider', min: 0, max: 64, step: 1, unit: 'px', precision: 0 },
  },
  {
    key: 'bezelWidth',
    label: 'Bezel Width',
    group: 'Refraction Geometry',
    type: 'number',
    defaultValue: '34',
    description: 'Width in px of the curved bezel band where light bends. Wider bezel = broader, softer lens ring.',
    control: { kind: 'slider', min: 6, max: 80, step: 1, unit: 'px', precision: 0 },
  },
  {
    key: 'thickness',
    label: 'Glass Depth',
    group: 'Refraction Geometry',
    type: 'number',
    defaultValue: '24',
    description: 'Glass slab depth in px — shapes the displacement falloff and the drop shadow.',
    control: { kind: 'slider', min: 2, max: 48, step: 1, unit: 'px', precision: 0 },
  },
  {
    key: 'ior',
    label: 'Index of Refraction',
    group: 'Refraction Geometry',
    type: 'number',
    defaultValue: '1.5',
    description: 'Index of refraction fed into vector Snell’s law. Real glass is 1.4–1.6; water ≈ 1.33; diamond ≈ 2.4.',
    control: { kind: 'slider', min: 1.1, max: 1.8, step: 0.01, precision: 2 },
  },

  // ── Dispersion ────────────────────────────────────────────────
  {
    key: 'chromaticAberration',
    label: 'Chromatic Aberration',
    group: 'Dispersion',
    type: 'number',
    defaultValue: '0.3',
    description:
      '0–1 per-channel dispersion split at the bezel. Implemented as three feDisplacementMap scales on one shared map — the prism is free.',
    control: { kind: 'slider', min: 0, max: 1, step: 0.02, precision: 2 },
  },

  // ── Lighting ──────────────────────────────────────────────────
  {
    key: 'lightAngle',
    label: 'Light Angle',
    group: 'Lighting',
    type: 'number',
    defaultValue: '-35',
    description: 'Light direction in degrees (0 = top). Drives both rim lobes and the bezel sheen sweep.',
    control: { kind: 'slider', min: -180, max: 180, step: 5, unit: '°', precision: 0 },
  },
  {
    key: 'edgeHighlight',
    label: 'Rim Light',
    group: 'Lighting',
    type: 'number',
    defaultValue: '0.9',
    description: 'Intensity of the crisp two-lobe conic rim ring — bright at the light angle and its mirror. The Apple signature.',
    control: { kind: 'slider', min: 0, max: 1, step: 0.02, precision: 2 },
  },
  {
    key: 'specularStrength',
    label: 'Bezel Sheen',
    group: 'Lighting',
    type: 'number',
    defaultValue: '0.42',
    description: 'Intensity of the soft bezel-band light sweep that sits under the crisp rim.',
    control: { kind: 'slider', min: 0, max: 1, step: 0.02, precision: 2 },
  },
  {
    key: 'fresnelPower',
    label: 'Fresnel Power',
    group: 'Lighting',
    type: 'number',
    defaultValue: '2.2',
    description: 'Rim lobe tightness — 1 spreads the light wide around the ring, 5 focuses it into tight crescents.',
    control: { kind: 'slider', min: 1, max: 5, step: 0.1, precision: 1 },
  },
  {
    key: 'backdropLuminance',
    label: 'Backdrop Luminance',
    group: 'Lighting',
    type: 'number',
    defaultValue: '— (from appearance)',
    description:
      'Measured backdrop luminance, 0 (black) … 1 (white). Overrides the appearance-implied value for rim/sheen derivation — feed it from your own wallpaper sampling.',
    control: { kind: 'slider', min: 0, max: 1, step: 0.01, precision: 2 },
    optional: true,
  },

  // ── Interaction ───────────────────────────────────────────────
  {
    key: 'dynamicLighting',
    label: 'Dynamic Lighting',
    group: 'Interaction',
    type: 'boolean',
    defaultValue: 'false',
    description: 'Rim lobes follow the cursor across the page. Alias of cursorTracking.',
    control: { kind: 'toggle' },
  },
  {
    key: 'cursorTracking',
    label: 'Cursor Tracking',
    group: 'Interaction',
    type: 'boolean',
    defaultValue: 'false',
    description: 'Light source tracks the pointer position — the canonical name behind dynamicLighting.',
    control: { kind: 'toggle' },
  },
  {
    key: 'hoverLighting',
    label: 'Hover Lighting',
    group: 'Interaction',
    type: 'boolean',
    defaultValue: 'false',
    description: 'Brightens the rim on hover. Off by default — a hover-triggered light change can read as a broken hover state.',
    control: { kind: 'toggle' },
  },
  {
    key: 'parallax',
    label: 'Parallax',
    group: 'Interaction',
    type: 'boolean',
    defaultValue: 'false',
    description: 'Subtle depth shift of the glass content relative to the backdrop as the pointer moves.',
    control: { kind: 'toggle' },
  },
  {
    key: 'inertia',
    label: 'Inertia',
    group: 'Interaction',
    type: 'boolean',
    defaultValue: 'true',
    description: 'Interactive light and parallax responses ease with spring inertia instead of snapping.',
    control: { kind: 'toggle' },
  },

  // ── Depth & Texture ───────────────────────────────────────────
  {
    key: 'elevation',
    label: 'Elevation',
    group: 'Depth & Texture',
    type: 'number',
    defaultValue: '1',
    description: 'Drop shadow strength multiplier. 0 removes the shadow; 2–3 lifts the panel visibly off the page.',
    control: { kind: 'slider', min: 0, max: 3, step: 0.1, precision: 1 },
  },
  {
    key: 'noiseOpacity',
    label: 'Micro Texture',
    group: 'Depth & Texture',
    type: 'number',
    defaultValue: '0',
    description: 'Opacity of an optional micro-noise texture layer — a hint of physical vapor-deposited frost.',
    control: { kind: 'slider', min: 0, max: 0.05, step: 0.001, precision: 3 },
  },
  {
    key: 'noiseScale',
    label: 'Texture Scale',
    group: 'Depth & Texture',
    type: 'number',
    defaultValue: '1',
    description: 'Scale of the micro-noise grain. Only visible when noiseOpacity > 0.',
    control: { kind: 'slider', min: 0.5, max: 4, step: 0.1, precision: 1 },
  },

  // ── Rendering ─────────────────────────────────────────────────
  {
    key: 'borderRadius',
    label: 'Border Radius',
    group: 'Rendering',
    type: 'number',
    defaultValue: '28',
    description: 'Corner radius in px. The refraction map is generated for the exact rounded-rect SDF, so corners bend correctly.',
    control: { kind: 'slider', min: 4, max: 72, step: 1, unit: 'px', precision: 0 },
  },
  {
    key: 'quality',
    label: 'Quality',
    group: 'Rendering',
    type: `'high' | 'medium' | 'low'`,
    defaultValue: `'high'`,
    description: 'Displacement map resolution cap — 1024 / 384 / 128 px. Lower tiers trade rim crispness for map-generation speed.',
    control: { kind: 'select', options: ['high', 'medium', 'low'] },
  },
  {
    key: 'refractionMode',
    label: 'Refraction Mode',
    group: 'Rendering',
    type: `'auto' | 'svg' | 'css'`,
    defaultValue: `'auto'`,
    description:
      'svg = full lenticular refraction (Chromium), css = frost + lighting fallback, auto picks per browser support.',
    control: { kind: 'select', options: ['auto', 'svg', 'css'] },
  },
];

/** Alphabetical view for the A–Z index + docs table */
export const PROPERTIES_AZ: PropertyDef[] = [...PROPERTIES].sort((a, b) =>
  a.key.localeCompare(b.key),
);

/** Curated art-direction presets (matches the README physics presets) */
export const CURATED_PRESETS: { name: string; note: string; config: Partial<LiquidGlassConfig> }[] = [
  {
    name: 'Crystal Clear',
    note: 'High-end visual elements',
    config: { blur: 0, refractionStrength: 40, saturation: 1.4, tintOpacity: 0.05 },
  },
  {
    name: 'Frosted (Apple)',
    note: 'Default overlays and sheets',
    config: { blur: 24, refractionStrength: 18, saturation: 1.8, tintOpacity: 0.15 },
  },
  {
    name: 'Vivid Glass',
    note: 'Highly colorful dashboards',
    config: { blur: 12, refractionStrength: 35, saturation: 2.2, tintOpacity: 0.1 },
  },
  {
    name: 'Ultra Prismatic',
    note: 'Rich chromatic edge refraction',
    config: { blur: 8, refractionStrength: 48, saturation: 1.6, tintOpacity: 0.08, chromaticAberration: 0.7 },
  },
];

/* ── tint helpers: engine wants 'r, g, b', <input type=color> wants hex ── */

export function rgbStringToHex(rgb: string): string {
  const parts = rgb.split(',').map(p => parseInt(p.trim(), 10));
  if (parts.length !== 3 || parts.some(n => Number.isNaN(n))) return '#ffffff';
  return '#' + parts.map(n => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')).join('');
}

export function hexToRgbString(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return '255, 255, 255';
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}
