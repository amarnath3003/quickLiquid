<p align="center">
  <img src="https://raw.githubusercontent.com/amarnath3003/quickLiquid/main/assets/quick-liquid-logo.svg" alt="QuickLiquid" width="760" />
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/quick-liquid"><img alt="npm" src="https://img.shields.io/npm/v/quick-liquid?style=for-the-badge&color=0EA5E9"></a>
  <a href="https://bundlephobia.com/package/quick-liquid"><img alt="bundle size" src="https://img.shields.io/bundlephobia/minzip/quick-liquid?style=for-the-badge&color=22C55E"></a>
  <a href="https://www.npmjs.com/package/quick-liquid"><img alt="types" src="https://img.shields.io/npm/types/quick-liquid?style=for-the-badge&color=6366F1"></a>
  <a href="https://github.com/amarnath3003/quickLiquid/blob/main/LICENSE"><img alt="license" src="https://img.shields.io/npm/l/quick-liquid?style=for-the-badge&color=111827"></a>
</p>

<p align="center">
  <b>Apple-style liquid glass for React and vanilla JavaScript.</b><br />
  Real SVG backdrop refraction, physical rim lighting, chromatic dispersion, spring gestures, and droplet-style merge animations.
</p>

<p align="center">
  <a href="https://quickliquid.vercel.app"><b>Live demo</b></a>
  &middot;
  <a href="https://github.com/amarnath3003/quickLiquid/blob/main/packages/quick-liquid/PHYSICS.md"><b>Physics notes</b></a>
  &middot;
  <a href="https://github.com/amarnath3003/quickLiquid/blob/main/ROADMAP.md"><b>Roadmap</b></a>
  &middot;
  <a href="https://github.com/amarnath3003/quickLiquid"><b>GitHub</b></a>
</p>

---

## Why QuickLiquid

QuickLiquid is a small UI effects engine for building premium refractive surfaces: nav bars, command palettes, tab indicators, floating controls, cards, sheets, and glassy buttons. It works as a React component or as a framework-free DOM engine.

<table>
  <tr>
    <td width="33%">
      <p align="center"><img alt="01 optics" src="https://img.shields.io/badge/01-Optics-0EA5E9?style=for-the-badge"></p>
      <b>Real refraction</b><br />
      SVG displacement maps bend the backdrop through a convex glass bezel instead of faking the look with a flat translucent layer.
    </td>
    <td width="33%">
      <p align="center"><img alt="02 motion" src="https://img.shields.io/badge/02-Motion-6366F1?style=for-the-badge"></p>
      <b>Liquid response</b><br />
      Press, bounce, jiggle, drag, mount, exit, and tab transitions use spring-based motion primitives.
    </td>
    <td width="33%">
      <p align="center"><img alt="03 cache" src="https://img.shields.io/badge/03-Cache-22C55E?style=for-the-badge"></p>
      <b>Built for reuse</b><br />
      Same-size glass elements share one refcounted displacement map, and strength changes update filter attributes without rebuilding maps.
    </td>
  </tr>
  <tr>
    <td width="33%">
      <p align="center"><img alt="04 color" src="https://img.shields.io/badge/04-Color-F59E0B?style=for-the-badge"></p>
      <b>Chromatic edges</b><br />
      Red, green, and blue channels can refract at slightly different scales for realistic prismatic rims.
    </td>
    <td width="33%">
      <p align="center"><img alt="05 groups" src="https://img.shields.io/badge/05-Groups-EC4899?style=for-the-badge"></p>
      <b>Droplet merging</b><br />
      Grouped elements can form smooth metaball bridges as they approach each other.
    </td>
    <td width="33%">
      <p align="center"><img alt="06 fallback" src="https://img.shields.io/badge/06-Fallback-64748B?style=for-the-badge"></p>
      <b>Graceful fallback</b><br />
      Chromium gets full SVG backdrop refraction. Other engines keep the frost, tint, shadow, and lighting layers.
    </td>
  </tr>
</table>

## Install

```bash
npm install quick-liquid
```

Requirements:

- Node 18+ for local builds
- React 18+ only if you use `quick-liquid/react`
- No stylesheet import required

## Playground

Try the live lens at [quickliquid.vercel.app/playground](https://quickliquid.vercel.app/playground/). The playground includes six visual scenes—color, stock video, photography, typography, fine lines, and contrast—plus four tuned material presets and card, pill, and circle shapes. Drag the lens, tune the feel, and copy the resulting React configuration.

## Quick Start

### React

```tsx
import { LiquidGlass } from 'quick-liquid/react';

export function CommandButton() {
  return (
    <LiquidGlass
      config={{
        material: 'regular',
        borderRadius: 24,
        dynamicLighting: true,
        chromaticAberration: 0.22,
      }}
      liquidPress={{ scale: 0.92, squish: 0.03 }}
      animateIn={120}
      className="command-glass"
    >
      <button type="button">Open Command Center</button>
    </LiquidGlass>
  );
}
```

### Vanilla DOM

```ts
import { LiquidGlassEngine } from 'quick-liquid';

const card = document.querySelector<HTMLElement>('[data-liquid-card]');

if (card) {
  const glass = new LiquidGlassEngine(card, {
    material: 'clear',
    refractionStrength: 28,
    dynamicLighting: true,
    quality: 'high',
  });

  glass.enableLiquidPress({ scale: 0.94, squish: 0.025 });
}
```

## Material Presets

Start with a material and override only the knobs you need.

| Preset | Feel | Good for |
| --- | --- | --- |
| `clear` | Low blur, stronger lensing | Hero controls, dock-like UI, colorful backgrounds |
| `thin` | Light frost, readable refraction | Toolbars, small buttons, chips |
| `regular` | Balanced frost and depth | Cards, nav bars, command palettes |
| `thick` | More blur and tint | Sheets, overlays, text-heavy surfaces |
| `ultra` | Softest, most opaque | Large panels and modal backgrounds |
| `adaptive` | Balanced preset with adaptive tint hook | Apps that feed their own environment color |

```ts
const config = {
  material: 'regular',
  blur: 18,
  refractionStrength: 20,
  tintOpacity: 0.08,
};
```

## Configuration

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `material` | `'clear' \| 'thin' \| 'regular' \| 'thick' \| 'ultra' \| 'adaptive'` | unset | Applies a curated glass preset. Explicit values override preset values. |
| `blur` | `number` | `3` | Backdrop frost blur in CSS pixels. |
| `saturation` | `number` | `1.5` | Backdrop saturation boost through the glass. |
| `tint` | `string` | `'255, 255, 255'` | RGB tint string. |
| `tintOpacity` | `number` | `0.04` | Material tint opacity. |
| `refractionStrength` | `number` | `22` | Maximum rim displacement in CSS pixels. |
| `bezelWidth` | `number` | `34` | Width of the curved refractive bezel band. |
| `thickness` | `number` | `24` | Virtual glass slab depth. |
| `ior` | `number` | `1.5` | Index of refraction. |
| `chromaticAberration` | `number` | `0.18` | Per-channel dispersion amount from `0` to `1`. |
| `lightAngle` | `number` | `-35` | Light direction in degrees. |
| `edgeHighlight` | `number` | `0.9` | Rim highlight intensity. |
| `specularStrength` | `number` | `0.26` | Bezel reflection intensity. |
| `dispersionMode` | `'auto' \| 'exact'` | `'auto'` | Skip RGB splitting under heavy frost, or retain exact RGB sampling. Low quality always uses one sample. |
| `respectPreferences` | `boolean` | `true` | Respect reduced motion and reduced transparency in the glass engine. |
| `fresnelPower` | `number` | `2.2` | Rim lobe sharpness. |
| `hoverLighting` | `boolean` | `false` | Brightens the rim on hover. |
| `cursorTracking` | `boolean` | `false` | Lets the rim light follow the pointer. |
| `dynamicLighting` | `boolean` | `false` | Alias that enables cursor-driven lighting. |
| `parallax` | `boolean` | `false` | Adds subtle pointer parallax. |
| `elevation` | `number` | `1` | Shadow or ambient glow multiplier. |
| `borderRadius` | `number` | `28` | Glass corner radius in CSS pixels. |
| `quality` | `'high' \| 'medium' \| 'low'` | `'high'` | Displacement map resolution tier. |
| `refractionMode` | `'auto' \| 'svg' \| 'css'` | `'auto'` | Choose full SVG refraction or CSS-only fallback. |
| `appearance` | `'light' \| 'dark' \| 'auto'` | `'auto'` | Adapts tint, lighting, and shadow for light or dark backdrops. |
| `backdropLuminance` | `number` | unset | Optional `0..1` luminance hint for custom backdrop sampling. |

## Animation API

### Configuration updates and cleanup

`updateConfig(patch)` merges explicit overrides; pass `undefined` to remove one. `setConfig(config)` replaces the declaration, resetting omitted values to the selected material/defaults. React uses replacement semantics automatically. `getConfig()` returns the resolved configuration.

```ts
glass.updateConfig({ blur: 8 });
glass.updateConfig({ material: 'regular' }); // explicit blur remains 8
glass.updateConfig({ blur: undefined });    // returns to regular's blur
glass.setConfig({ material: 'clear' });     // reset all overrides
glass.destroy();                           // release resources when the view leaves
```

Vanilla content is wrapped in `.ql-content` for correct stacking and its original nodes/listeners are restored on destroy. Account for that wrapper if your layout relies on direct children. Reduced motion and reduced transparency are respected by default in the engine and React wrapper; independently constructed animation utilities still need application-level preference handling.

Defaults now use less dispersion (`0.18`) and reflection (`0.26`). Automatic dispersion skips RGB splitting under heavy frost; use `dispersionMode: 'exact'` to preserve deliberate chromatic styling. Low quality and negligible dispersion still use one sample. These materials are independent web approximations, not native Apple presets or pixel-identical output.

## Animation utilities

QuickLiquid exports the glass engine plus reusable animation primitives from `quick-liquid`.

```ts
import {
  LiquidButton,
  LiquidDrag,
  LiquidGesture,
  LiquidGroup,
  LiquidTabBar,
  Spring,
} from 'quick-liquid';
```

### Liquid buttons

```ts
import { LiquidButton } from 'quick-liquid';

const button = document.querySelector<HTMLElement>('.glass-button');

if (button) {
  new LiquidButton(button).onTap(() => {
    console.log('Tapped');
  });
}
```

### Merging groups

```ts
import { LiquidGroup, LiquidGesture } from 'quick-liquid';

const container = document.querySelector<HTMLElement>('.dock');
const items = document.querySelectorAll<HTMLElement>('.dock-item');

if (container) {
  const group = new LiquidGroup(container, {
    mergeDistance: 60,
    blendRadius: 28,
  });

  items.forEach((item) => {
    group.add(item);
    new LiquidGesture(item).onDrag(() => group.updatePositions());
  });
}
```

### Liquid tab indicators

```ts
import { LiquidGlassEngine, LiquidTabBar } from 'quick-liquid';

const nav = document.querySelector<HTMLElement>('.tabs');
const tabs = [...document.querySelectorAll<HTMLElement>('.tab')];

if (nav && tabs.length) {
  const tabBar = new LiquidTabBar(nav, tabs, { spring: 'snappy' });

  new LiquidGlassEngine(tabBar.getIndicator(), {
    material: 'clear',
    borderRadius: 999,
  });

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => tabBar.select(index));
  });
}
```

## Import Map

| Import | Exports |
| --- | --- |
| `quick-liquid` | `LiquidGlassEngine`, `DEFAULT_CONFIG`, `MATERIAL_PRESETS`, springs, gestures, transitions, morphing, groups, tab bar utilities |
| `quick-liquid/core` | `LiquidGlassEngine`, config types, `DEFAULT_CONFIG`, `MATERIAL_PRESETS` without animation utilities |
| `quick-liquid/react` | `LiquidGlass`, `LiquidGlassProps`, `LiquidGlassRef` |

The entry points share one engine/cache within each module format. ESM and CommonJS remain separate graphs if mixed in one process.

## Browser Notes

The full refraction path depends on rendered `backdrop-filter: url(...)` support and is validated locally in Chromium. The automatic computed-style probe cannot prove pixel rendering. Use `refractionMode: 'css'` for an explicit fallback with blur, saturation, tint, lighting and shadow; validate actual rendering on your target Safari/Firefox versions.

For Chromium refraction, avoid these styles on the glass host element because they can prevent the browser from resolving the live backdrop:

- `isolation`
- `filter`
- `opacity`
- `mask`
- explicit stacking changes on the internal lens layer

See the [visual QA notes](https://github.com/amarnath3003/quickLiquid/blob/main/VISUAL_QA_HANDOFF.md) for known stacking pitfalls.

## Performance Model

QuickLiquid is designed around a cache-first rendering path:

- A 1-D lookup table reduces the physical refraction calculation.
- Only the rounded bezel band is iterated when generating displacement maps.
- Same-geometry elements share a refcounted map.
- `refractionStrength` and chromatic aberration updates only change SVG filter scale attributes when geometry and the dispersion mode gate are unchanged.
- Neutral map padding and recentered encoding keep the flat center stationary.
- Rim/reflection gradients are baked once and rotated during pointer motion; lighting stops at rest.
- `quality: 'medium'` or `quality: 'low'` can be used for dense lists or background UI.

The engine also exposes live metrics for profiling representative hardware:

```ts
const metrics = glass.getPerformanceMetrics();

console.log(metrics.mapGenMs, metrics.mapPixelsComputed);
```

`avgFrameTime` is lighting callback CPU time, not FPS. `mapEncodeMs` is asynchronous encoding latency, and `displacementTaps` counts samples rather than total GPU passes. Measure the whole page on representative hardware before making frame-rate or battery claims. See `docs/GLASS_INTEGRATION.md` and `docs/GLASS_VALIDATION.md` in the repository for the upgrade guide and measured results.

## Documentation

- [GitHub repository](https://github.com/amarnath3003/quickLiquid)
- [Physics notes](https://github.com/amarnath3003/quickLiquid/blob/main/packages/quick-liquid/PHYSICS.md)
- [Optimization notes](https://github.com/amarnath3003/quickLiquid/blob/main/packages/quick-liquid/OPTIMIZATION.md)
- [Visual QA handoff](https://github.com/amarnath3003/quickLiquid/blob/main/VISUAL_QA_HANDOFF.md)
- [Roadmap](https://github.com/amarnath3003/quickLiquid/blob/main/ROADMAP.md)

## License

MIT. See [LICENSE](LICENSE).
