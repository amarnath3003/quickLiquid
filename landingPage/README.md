# QuickLiquid Landing Page

Standalone marketing, documentation, and interactive playground site for the `quick-liquid` package, deployed at [quickliquid.vercel.app](https://quickliquid.vercel.app).

## Develop

```bash
# from the repo root
npm run dev:landing     # vite dev server (imports quick-liquid straight from src/)
```

## Build

```bash
npm run build:landing   # type-checks then emits static files to landingPage/dist
```

The output in `dist/` is fully static — deploy it to any static host (Vercel, GitHub Pages, Netlify, etc.).

## Structure

Vite multi-page build with three main routes plus a `/lab/` redirect to `/playground/`:

- `/` (`index.html` → `src/main.tsx` → `App.tsx`) — Home page featuring the hero install command, live draggable `SpectrumLab` lens, `Features` component gallery (`OpticsDesk` spectrum console, `FlowExperiment` SDF droplet merging, `ZoomExperiment` optical magnifier), and `Install` code switcher.
- `/playground/` (`playground/index.html` → `src/lab/main.tsx`) — Interactive glass workbench with 6 backdrops (Spectrum, Video, Photo, Type, Fine lines, Contrast), 4 material presets, 5 `QUALITY_PRESETS` tiers, card/pill/circle lens shapes, advanced optical sliders, live React config export, and the `AnimationStudio` interactive spring sandbox. (Legacy `/lab/` redirects cleanly to `/playground/`.)
- `/docs/` (`docs/index.html` → `src/docs-main.tsx` → `DocsApp.tsx`) — Interactive API reference with searchable **30-property `LiquidGlassConfig` explorer** (`src/data/properties.ts`), live material preset comparison, React & imperative `LiquidGlassRef` sandbox with live metrics, interactive SDF metaball lab, 14-item animation toolkit showcase, and browser compatibility notes.

### Key files

- `src/data/properties.ts` — Single source of truth for all 30 `LiquidGlassConfig` properties; powers the live docs explorer and configuration tables.
- `src/components/SiteShell.tsx` — Shared sticky refractive navbar (`LiquidGlass` + `LiquidTabBar`), scroll progress bar (`LiquidScrollTrack`), `CommandMenu` (`Ctrl/⌘ + K` powered by `useLiquidFlow`), `Atmosphere` spectral ribbons, and footer.
- `src/components/` — `Atmosphere`, `CardGlass`, `CodeBlock`, `CommandMenu`, `GlassControls`, `SiteShell`, `useSceneDrag`.
- `src/sections/` — `Hero`, `SpectrumLab`, `Features`, `OpticExperiments` (`FlowExperiment`, `ZoomExperiment`), `Install`, `Docs`.
- `src/lab/` — `main.tsx` (Glass playground) and `AnimationStudio.tsx` (spring tuning & interactive primitives).

## Design language

- **Theme**: Dark spectral obsidian (`#070910`) with multi-ray spectral light fields (`#f87898` → `#73eddc` → `#9299ff` → `#df9dfe`) and layered `LiquidGlass` surfaces (`site-shell.css`, `prism.css`, `docs.css`, `material-lab.css`).
- **Typography**: **Outfit** (display and UI) and **JetBrains Mono** (code and optical specs) — self-hosted via `@fontsource-variable/*` and bundled at build time.
- **Dogfooding**: Navigation bars, cards, buttons, segmented controls, switches, command palette, and optical experiments all run live `quick-liquid` and `quick-liquid/react` primitives.

> Note: Full `backdrop-filter: url()` refraction renders in Chromium; `opticalSource` enables direct SVG filtering on scene copies across browsers, and `refractionMode: 'css'` provides a frost + lighting fallback.
