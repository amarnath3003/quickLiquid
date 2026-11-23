# Design and optics

## Design the material in context

- Start over the app's actual backdrop. An image edge, large type, fine lines, or a color boundary crossing the bezel makes displacement visible. A flat-color wall gives mostly tint and highlights. Avoid putting decorative glass on every card.
- Keep navigation, labels, and actions in crisp foreground content. Choose `appearance` for the area behind the surface, even when the rest of the page uses a different theme. Test contrast as the background scrolls and in both theme and fallback states. Under text-heavy surfaces, increase frost or tint and provide a solid treatment where contrast varies widely.
- Treat shape, material, and movement as a system. Use a repeated radius and light direction on related controls. Use `borderRadius: 999` for a pill or circle and set a square size for a circle. Start with restrained rims on secondary surfaces and reserve wider bezels, magnification, or stronger dispersion for a focal lens.
- Let motion show a state change. Use a traveling active pill for selection and a short press for feedback. Use a positional morph for a closely related trigger and panel, or a drop reveal for an independent dialog. Keep selection, expansion, and focus legible immediately under reduced motion.

| Surface | How to compose it |
| --- | --- |
| Sticky navigation | Start with one `thin` or `regular` lens over scrolling content. Use app-owned links and a `LiquidTabBar` for selection. If both surfaces have optics, check the nested pill while scrolling. A styled pill with `glass: false` can keep the motion with a single backdrop filter on the nav. |
| Toolbar or dock | Use a quiet shared tray and sharper edges on the active control. Give repeated compact controls consistent dimensions, use `medium` quality, and keep press motion on the action layer. |
| Floating panel or sheet | Set a stable text color and use `regular` or `thick`. Place the panel in the app's overlay layer, with any page scrim behind it. An opaque panel treatment is useful where the page underneath varies widely. |
| Hero lens or magnifier | Set explicit dimensions, start with `clear`, and tune `magnification` against recognizable detail. Use `opticalSource` for artwork the app can supply and align. Keep the lens away from body copy and use a compact footprint before raising quality. |

## Material presets

Pass one of these values as `material`. Numbers below are preset overrides. Other properties come from `DEFAULT_CONFIG` unless explicitly supplied. Numeric dimensions are CSS px.

| Material | Typical placement | Blur | Saturation | Tint opacity | Refraction | Bezel | Thickness |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `clear` | Hero lens, dock, drag specimen | 2 | 1.55 | 0.03 | 26 | 36 | 26 |
| `thin` | Chip, compact button, toolbar | 6 | 1.5 | 0.05 | 18 | 26 | 18 |
| `regular` | Card, sticky nav, command palette | 14 | 1.7 | 0.09 | 16 | 30 | 20 |
| `thick` | Sheet, dense popup, inspector | 22 | 1.8 | 0.13 | 12 | 28 | 18 |
| `ultra` | Large or text-heavy panel | 30 | 1.85 | 0.17 | 10 | 26 | 16 |
| `adaptive` | Colored backdrops where overlay blending is desired | 12 | 1.6 | 0.06 | 18 | 30 | 20 |

`adaptive` enables the `adaptiveTint` overlay blend. For host-sampled luminance, supply `backdropLuminance` explicitly. The preset has no automatic wallpaper sampling. Change the preset with a partial declaration such as `{ material: 'regular', borderRadius: 24 }`. Spreading all of `DEFAULT_CONFIG` into that declaration would overwrite the material's preset values.

## Configuration

Defaults below describe the engine with no material preset. Values in parentheses show the engine's numeric clamp where relevant. Use `Partial<LiquidGlassConfig>` for a config declaration.

| Property | Default and effect |
| --- | --- |
| `material` | Unset. Resolves defaults, then the material, then defined overrides. |
| `appearance` | `'auto'` follows `prefers-color-scheme`. Choose `'light'` or `'dark'` for an explicit backdrop. Dark retunes rim and shadow and converts the default white tint to smoke. |
| `backdropLuminance` | Unset. A normalized 0–1 backdrop value overrides appearance-derived luminance for lighting. |
| `blur` | 3 px (0–80). Frost reduces background contrast and can hide dispersion. |
| `saturation` | 1.5 (0–4). A factor of 1 preserves saturation. |
| `tint`, `tintOpacity` | `'255, 255, 255'`, 0.04 (0–1). Supply comma-separated RGB channels for tint. |
| `refractionStrength` | 22 px (0–150). Displacement amplitude. At 0 the rim displacement is disabled. Zoom can still apply. |
| `bezelWidth`, `thickness` | 34 px (0.5–256), 24 px (0.1–256). The width of the curved band and the depth of the slab. The effective bezel is bounded by half the smaller dimension. Thickness also affects shadow. |
| `ior` | 1.5 (1–3). Affects the normalized bezel profile. At 1 the engine skips its SVG optics. |
| `magnification` | 1 (1–3). Above 1 warps the lens interior and blends into the bezel. |
| `chromaticAberration` | 0.18 (0–1). Separation at the rim. Set 0 to switch off RGB dispersion. |
| `dispersionMode` | `'auto'` skips a split that blur would hide. `'exact'` retains RGB when the tier and nontrivial chroma permit it. Low always uses a single tap, and extreme retains any positive split. |
| `lightAngle` | -35 degrees. 0 points to the top. Drives rim and sheen. |
| `edgeHighlight`, `specularStrength` | 0.9 and 0.26 (0–1 each). Crisp rim and softer bezel sheen. |
| `fresnelPower` | 2.2 (1–6). Higher values concentrate the rim highlights. |
| `cursorTracking`, `hoverLighting`, `parallax` | All false. Opt in to pointer-directed light, brighter hover rim, or subtle host movement. |
| `inertia` | True. Smooths pointer responses. |
| `elevation` | 1 (0–5). Shadow or ambient glow strength. Set 0 for a flush surface. |
| `noiseOpacity`, `noiseScale` | 0 (0–1) and 1 (0.1–10). Grain appears only at positive opacity. |
| `borderRadius` | 28 px (0–10000). Used by the host and the SDF. Match the intended shape through this config. |
| `quality` | `'high'`. Sets map sampling density and cap. |
| `refractionMode` | `'auto'` probes support, `'css'` uses frost/tint/lighting, and `'svg'` requests SVG. A direct source subtree can use SVG in auto mode without backdrop URL support. |
| `respectPreferences` | True. Reduced motion skips engine effects and reduced transparency uses an opaque tint and skips the lens. |

`dynamicLighting: true` aliases `cursorTracking: true` when `cursorTracking` is omitted, and `distortionStrength` aliases `refractionStrength` when the latter is omitted. Prefer the canonical keys. `adaptiveTint` and `tintStrength` still control overlay mode and tint scaling. `edgeBlurModifier`, `environmentSampling`, `edgeDistortion`, `caEdgeOnly`, and `shadowDiffusion` are compatibility fields with no effect in this renderer.

## Quality and cost

The renderer maps a vector-Snell profile through a rounded-rectangle signed distance field (SDF). At 1× zoom the center is neutral, and the engine rasterizes only the curved band with mirrored symmetry. Magnification adds interior displacement. RGB dispersion shares one displacement map with three filter taps. Frost auto-gating can reduce this to one.

| `quality` | Nominal density and longest map side cap before padding | Good starting point |
| --- | --- | --- |
| `low` | 0.5×, 128 px | Dense controls and small background accents |
| `medium` | 0.8×, 384 px | Groups of controls and secondary glass |
| `high` | 1×, 1024 px | General purpose and a visible focal lens |
| `ultra` | 2×, 2048 px | A small detailed hero lens |
| `extreme` | 3×, 3072 px | Deliberate high-detail showcase with positive RGB dispersion |

Identical sizes and compatible lens geometry share a reference-counted map. Align repeated surfaces where feasible. Keep the number and area of full SVG filters within the page's frame budget and consider CSS mode for large frosted surfaces. Profile before raising quality. Keep `magnification: 1` for ordinary UI. At 1×, strength and chroma writes usually change filter scales only. A transition to or from zero, a dispersion topology change, a blur padding change, a resize, or new geometry can rebuild the filter. With magnification active, strength also affects the map. Prefer transforming a positioning wrapper over animating layout dimensions frame by frame.

Use [QuickLiquid materials](https://quickliquid.vercel.app/docs/#materials), the [playground](https://quickliquid.vercel.app/playground/), and the [v0.2.0 config](https://github.com/amarnath3003/quickLiquid/blob/v0.2.0/packages/quick-liquid/src/core/config.ts) and [optics](https://github.com/amarnath3003/quickLiquid/blob/v0.2.0/packages/quick-liquid/src/core/optics.ts) sources.
