# Integrating the upgraded material

## Choose the material before tuning the optics

Use `clear` for compact controls over rich imagery, `regular` for readable everyday controls, and `thick` for stronger separation. `thin`, `thick`, `ultra` and `adaptive` are quickLiquid extensions, not claims of matching Apple's Liquid Glass variants. The renderer approximates a convex rounded-rectangle lens; it is not Apple's private renderer.

Start with the material preset rather than copying every default. Set `appearance` to describe the backdrop behind the glass. `auto` follows the operating-system color scheme; it does not sample the pixels behind your element. For text over changing media, provide sufficient contrast yourself, including a dimmed background or stronger tint where needed. The engine does not guarantee text contrast.

```tsx
import { LiquidGlass } from 'quick-liquid/react';

<LiquidGlass
  config={{ material: 'clear', appearance: 'dark', borderRadius: 28, cursorTracking: true }}
  liquidPress
>
  <button type="button">Open library</button>
</LiquidGlass>
```

## Configuration ownership

Resolution is defaults → selected material → explicit overrides. Explicit numeric values are bounded and nonfinite values fall back to defaults.

- `updateConfig(patch)` merges explicit overrides. Changing a material keeps your explicit values. Pass `undefined` to remove one.
- `setConfig(declaration)` replaces all overrides. Omitted keys revert to the selected material or defaults. Use it for reset and declarative frameworks.
- `getConfig()` returns a copy of the resolved values, not a mutable handle.
- React `config` uses replacement semantics automatically. Removing `blur` from a prop now genuinely restores the material's blur. The imperative ref exposes the live engine after mount.

```ts
import { LiquidGlassEngine } from 'quick-liquid/core';

const glass = new LiquidGlassEngine(element, { material: 'clear' });
glass.updateConfig({ blur: 8 });
glass.updateConfig({ material: 'regular' }); // explicit blur remains 8
glass.updateConfig({ blur: undefined });    // regular supplies blur 14
glass.setConfig({ material: 'clear' });     // all overrides reset
// During your component/view cleanup:
glass.destroy();
```

`quick-liquid/core` exports only the engine, config types, defaults and presets. The root entry additionally exports animation utilities. Root, core and React share one engine module/cache within an ESM graph or within a CommonJS graph. Mixing both module formats, loading duplicate package versions, or using separate realms can still create separate caches.

## Layout and lifecycle

The engine owns its internal effect layers and captures/restores host styles it controls. Vanilla content is wrapped in `.ql-content`, preserving the actual nodes and their listeners, then unwrapped on destroy. This adds a layout wrapper: put layout/padding on a supplied `.ql-content` if your CSS depends on direct children or on flex/grid placement. React already supplies this wrapper. Do not rewrite internal effect layers.

Call `destroy()` when removing a vanilla view. It is idempotent and releases observers, listeners, pending animation work, filters and unused map URLs. Delayed entrance work is canceled, and interrupted exit promises settle. Disabling liquid press while held restores its transform. Engine transforms are animation-owned while a gesture runs; apply independent transforms to an outer wrapper if they must compose continuously.

For Chromium refraction, avoid `isolation`, `filter`, non-unit `opacity`, and masks on the host or backdrop-isolating ancestors. Never add a z-index to `.ql-lens`. The URL filter may be accepted by CSS yet fail to render under an incompatible stacking arrangement. Use the lab's fine-line scene to verify actual edge movement, not just computed CSS.

## Accessibility and fallback

`respectPreferences` defaults to `true`. The engine listens live to reduced-motion and reduced-transparency preferences. Reduced motion stops pointer springs and engine entrance/jiggle animations. Reduced transparency uses an opaque light/dark tint and releases the refraction map. `respectPreferences: false` is an explicit opt-out, useful for controlled tests, not a recommended app default.

This preference support covers `LiquidGlassEngine` and its React wrapper. Independently constructed `LiquidDrag`, `LiquidGroup`, `LiquidTabBar`, and other animation utilities still need application-level preference handling. The lab's scene animation also respects reduced motion through CSS.

`refractionMode: 'css'` deliberately disables geometric lensing but retains frost, tint, lighting and depth. `auto` uses a computed-style support probe, which cannot prove pixel support. Native Safari and Firefox remain validation targets; do not infer support from their user-agent string or a successful style assignment.

## What changed in the optics

1. A bounded 32-entry cache stores the 512-sample normalized vector-Snell profile by thickness/bezel ratio and IOR. IOR 1 explicitly yields no lens rather than amplified floating-point noise.
2. Raster coordinates use independent horizontal/vertical scales in CSS space. Only one quadrant's bezel is evaluated. Quantization is mirrored exactly, including odd-sized axes.
3. Maps have an opaque neutral guard band. SVG recenters bytes with `(255*x - 1)/254`, so encoded 128 is exactly 0.5 and cannot shift the flat center. The border avoids black displacement data leaking into the blur padding.
4. Exact dispersion retains three RGB samples from one shared field. `dispersionMode: 'auto'` uses one sample when the estimated color separation is small compared with frost: `0.24 * chroma * strength < 0.2 * blur`. This is a heuristic, not a proof of visual equivalence. Choose `exact` for deliberate chromatic styling or comparisons. Negligible dispersion and low quality still use one sample.
5. Rim and reflection gradients are baked and rotated, not reconstructed every pointer frame. Lighting uses a time-based critically damped response and stops at rest or when hidden. Geometry work coalesces to one requested rebuild per frame; disabled noise has no layer.

The map remains generated on the main thread and encoded asynchronously into PNG using canvas. There is no continuous canvas renderer. Large geometry or many unique sizes can still be expensive; benchmark representative devices before scaling up.

## Visual migration

Defaults changed from chromatic aberration `0.3` to `0.18`, and reflection `0.42` to `0.26`. The rim is finer and the reflection narrower. Set the old numbers explicitly if your art direction needs them, but the corrected center, lighting and padding intentionally differ from v7. The lab's v7 mode is a frozen comparison reference, not a supported production export.

Do not treat callback duration as frame rate. `avgFrameTime` measures engine lighting callback CPU time; `mapGenMs` measures synchronous raster creation/upload; `mapEncodeMs` includes asynchronous encoding latency; `displacementTaps` counts filter samples, not total GPU passes. Shared consumers report the original map's generation cost, not a separate generation each.

See [validation results](GLASS_VALIDATION.md) and [the implementation plan](GLASS_UPGRADE_PLAN.md). Run the landing page with `npm run dev:landing` and open `/playground/` for visual A/B controls, lifecycle checks and on-demand measurements.
