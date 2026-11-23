# Website integration

## Install and choose an import

Use the target app's package manager to add `quick-liquid`, for example `npm install quick-liquid`. It ships ESM, CommonJS, and TypeScript declarations. Package tooling requires Node 18+. React 18+ and React DOM are optional peers for the React entry point. The library ships no standalone stylesheet or global-script bundle. For a plain HTML site, bundle the module with the site's build tool or use the site's existing browser ESM setup.

| Import | Public surface |
| --- | --- |
| `quick-liquid/core` | `LiquidGlassEngine`, `DEFAULT_CONFIG`, `MATERIAL_PRESETS`, `QUALITY_PRESETS`, `LiquidGlassConfig`, `GlassQuality` |
| `quick-liquid` | Core exports plus the motion toolkit and its types |
| `quick-liquid/react` | `LiquidGlass`, `useLiquidGlass`, `LiquidGlassButton`, `LiquidSegmented`, `LiquidToggle`, `LiquidSwitcher`, `useLiquidInteractive`, `useLiquidFlow`, and component/ref types |

## React surfaces

`LiquidGlass` owns the engine and its cleanup. Use a client component in a React Server Components app. In Next.js App Router, place `'use client'` at the wrapper entry point and pass serializable config across the server/client boundary. Keep module-level and render-time reads of `window` or `document` out of the component.

```tsx
import { LiquidGlass } from 'quick-liquid/react';

export function AccountCard() {
  return (
    <LiquidGlass
      as="section"
      aria-labelledby="account-heading"
      className="account-glass"
      config={{ material: 'regular', appearance: 'dark', borderRadius: 24 }}
    >
      <div className="account-glass__body">
        <h2 id="account-heading">Your account</h2>
        <a href="/settings">Account settings</a>
      </div>
    </LiquidGlass>
  );
}
```

```css
.account-glass {
  max-inline-size: 28rem;
  color: #f6f8fc;
}

.account-glass__body {
  padding: 1.25rem;
}

.account-glass a {
  color: inherit;
}

.account-glass :focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 3px;
}
```

This example assumes a dark backdrop with visual detail. Give the section a legible base in the app's initial and fallback styles. If the glass samples the page behind it, keep opaque fallback fill off the lens host while the effect is active. Apply spacing and layout to a child or the generated content wrapper. The host clips overflow, so render escaping menus and tooltips in the app's existing overlay layer.

| React prop or handle | Behavior |
| --- | --- |
| `config` | Partial engine declaration. Removing an override restores the preset or default. |
| `as`, `active` | Intrinsic host, default `div`. `active={false}` tears down the engine while retaining the host and foreground content. |
| `opticalSource` | Decorative, lens-aligned React subtree. The engine filters this subtree directly. Foreground `children` stay sharp. |
| `liquidPress` | `true` or `{ scale, squish }` for press feedback on the host. Use a native action for activation. |
| `animateIn`, `jiggle` | Optional mount effects. A numeric `animateIn` is a delay in ms. A numeric `jiggle` is intensity. |
| `onPerformanceUpdate` | Callback every second while active. Prefer a stable callback for ongoing instrumentation. |
| `ref: LiquidGlassRef` | `engine`, `getMetrics()`, `jiggle(intensity?)`, `animateIn(delay?)`, `animateOut()`. Engine and metrics can be null. Await exit before app-controlled removal if desired. Exit hides the host, and entrance restores visibility. |

`LiquidGlass` wraps children in a `div.ql-content`. Use a flow-content host such as `div`, `section`, or `nav`. Put native buttons and links inside that content or use `LiquidGlassButton` for a tactile control. See [Motion and controls](motion-and-controls.md) for CSS and behavior of the React primitives.

### Hook on an existing host

The hook returns `{ ref, engine, getMetrics }`. Here `engine` is a React ref, and the mounted engine lives in `engine.current`. Attach `ref` to an element present at mount. Keep it stable or mount a separate component per host. Supply the direct `.ql-content` wrapper when a framework manages that DOM so the engine can insert its layers without moving framework-owned children. The `Ref<HTMLElement>` annotation below accommodates React 18 types, since v0.2.0 declares the hook ref as `RefObject<T | null>`.

```tsx
import type { Ref } from 'react';
import { useLiquidGlass } from 'quick-liquid/react';

export function GlassPanel({ title }: { title: string }) {
  const { ref } = useLiquidGlass<HTMLElement>({ material: 'thin', borderRadius: 18 });

  return (
    <section ref={ref as Ref<HTMLElement>}>
      <div className="ql-content" style={{ position: 'relative', zIndex: 10 }}>
        <h2>{title}</h2>
      </div>
    </section>
  );
}
```

### Direct scene filtering

Use `opticalSource` when the app owns the source artwork and needs refraction beyond browsers that support live SVG backdrop filtering. This uses an SVG filter on the source content itself. Supply decorative artwork, a gradient, or a synchronized crop, with no interactive or essential content in that subtree. To match a moving lens over a larger scene, position the duplicate scene by the negative lens offset relative to the scene and keep its dimensions and crop in sync. `refractionMode: 'css'` still disables displacement. Compare real pixels in your target browsers. With v0.2.0 this path visibly displaced artwork in Chromium and Firefox during skill testing. WebKit accepted the filter URL without visible displacement in the test, so keep the CSS treatment usable there.

```tsx
import { LiquidGlass } from 'quick-liquid/react';

export function SceneLens() {
  return (
    <LiquidGlass
      config={{ material: 'clear', borderRadius: 999, magnification: 1.6 }}
      style={{ width: 144, height: 144 }}
      opticalSource={
        <div
          style={{
            width: '100%',
            height: '100%',
            background: 'repeating-linear-gradient(45deg, #18395a 0 8px, #81c4eb 8px 16px)',
          }}
        />
      }
    />
  );
}
```

## Vanilla DOM and other frameworks

Mount on a connected element with measurable width and height. The engine inserts decorative layers and sets inline position when needed, radius, clipping, and shadow. For vanilla markup it can wrap existing children automatically. If layout rules target direct children or a framework reconciles them, put those children in a direct `.ql-content` wrapper as in the hook example. In Vue, Svelte, or similar frameworks, instantiate through the framework's client mount lifecycle and return or register cleanup. For static HTML, provide a module entry after the target markup.

```html
<section data-glass-card>
  <h2>Account</h2>
  <a href="/settings">Open settings</a>
</section>
```

```ts
import { LiquidGlassEngine } from 'quick-liquid/core';

export function mountGlassCard(root: ParentNode = document) {
  const host = root.querySelector<HTMLElement>('[data-glass-card]');
  if (!host) return () => {};

  const glass = new LiquidGlassEngine(host, {
    material: 'thin',
    borderRadius: 18,
    quality: 'medium',
  });

  return () => glass.destroy();
}
```

Call `mountGlassCard()` after the markup renders and keep its disposer for route or component teardown. For plain JavaScript, omit the TypeScript annotations and query-selector type argument.

- `updateConfig(partial)` patches explicit overrides. Pass `undefined` to clear an override. `setConfig(declaration)` replaces the override set. Use `getConfig()` to read the resolved values and `getElement()` to read the host.
- `enableLiquidPress({ scale, squish }?)` and `disableLiquidPress()` manage pointer feedback. `animateIn(delay?)`, `animateOut()`, and `jiggle(intensity?)` control presentation.
- `destroy()` removes layers, observers, handlers, and animations and restores the initial inline style values the engine tracks. Keep a single engine owner per host. For author-owned transforms, position or animate a separate wrapper if QuickLiquid already writes a transform.

See the [React and Ref docs](https://quickliquid.vercel.app/docs/#react), [React entry point](https://github.com/amarnath3003/quickLiquid/tree/v0.2.0/packages/quick-liquid/src/react), and [engine source](https://github.com/amarnath3003/quickLiquid/blob/v0.2.0/packages/quick-liquid/src/core/engine.ts).
