# quick-liquid

Ultra-optimized Liquid Glass UI framework for React and vanilla JavaScript.
It creates refractive glass UI with SVG backdrop distortion, physical-looking
rim lighting, chromatic aberration, and spring-based motion.

## Install

```bash
npm install quick-liquid
```

## React Usage

```tsx
import { LiquidGlass } from 'quick-liquid/react';

function Header() {
  return (
    <LiquidGlass
      config={{
        blur: 16,
        refractionStrength: 24,
        chromaticAberration: 0.1,
        dynamicLighting: true,
      }}
      liquidPress
      animateIn={200}
      className="glass-navbar"
    >
      <nav>
        <span>Brand</span>
        <button>Dashboard</button>
      </nav>
    </LiquidGlass>
  );
}
```

## Vanilla Usage

```ts
import { LiquidGlassEngine } from 'quick-liquid';

const el = document.querySelector<HTMLElement>('.glass-card');

if (el) {
  const engine = new LiquidGlassEngine(el, {
    blur: 20,
    saturation: 1.5,
    refractionStrength: 30,
    dynamicLighting: true,
  });

  engine.enableLiquidPress({ scale: 0.92, squish: 0.03 });
}
```

## Exports

- `quick-liquid`: core engine, material presets, spring primitives, gestures,
  morphing, transitions, and group animation utilities.
- `quick-liquid/react`: React component and imperative ref types.

## Configuration Highlights

```ts
import type { LiquidGlassConfig } from 'quick-liquid';

const config: Partial<LiquidGlassConfig> = {
  material: 'regular',
  blur: 14,
  refractionStrength: 16,
  chromaticAberration: 0.3,
  dynamicLighting: true,
  quality: 'high',
};
```

Common options:

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `material` | `'clear' \| 'thin' \| 'regular' \| 'thick' \| 'ultra' \| 'adaptive'` | unset | Applies a curated glass preset. Explicit config values override preset values. |
| `blur` | `number` | `3` | Backdrop frost blur in CSS pixels. |
| `saturation` | `number` | `1.5` | Backdrop saturation boost through the glass. |
| `refractionStrength` | `number` | `22` | Max rim displacement in CSS pixels. |
| `bezelWidth` | `number` | `34` | Width of the curved refractive bezel band. |
| `thickness` | `number` | `24` | Virtual glass slab depth. |
| `ior` | `number` | `1.5` | Index of refraction. |
| `chromaticAberration` | `number` | `0.3` | Per-channel dispersion amount from 0 to 1. |
| `dynamicLighting` | `boolean` | `false` | Makes rim lighting follow the pointer. |
| `quality` | `'high' \| 'medium' \| 'low'` | `'high'` | Displacement map quality tier. |

## Browser Notes

The full refraction path uses `backdrop-filter: url(...)`, which currently
renders in Chromium. Safari and Firefox fall back to frost and lighting. Avoid
putting `isolation`, `filter`, `opacity`, or `mask` on the glass host element;
those properties can prevent Chromium from resolving backdrop refraction.

## Documentation

- Repository: https://github.com/amarnath3003/quickLiquid
- Physics notes: https://github.com/amarnath3003/quickLiquid/blob/main/packages/quick-liquid/PHYSICS.md
- Visual QA notes: https://github.com/amarnath3003/quickLiquid/blob/main/VISUAL_QA_HANDOFF.md

## License

MIT
