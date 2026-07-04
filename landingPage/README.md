# QuickLiquid Landing Page

Standalone marketing + docs + playground site for the `quick-liquid` package.
Everything a developer needs on one page: install commands, quick-start code,
the full configuration reference, and a live playground exposing **all 27
`LiquidGlassConfig` properties, A to Z**.

## Develop

```bash
# from the repo root
npm run dev:landing     # vite dev server (imports quick-liquid straight from src/)
```

## Build

```bash
npm run build:landing   # type-checks then emits static files to landingPage/dist
```

The output in `dist/` is fully static — deploy it to any static host
(GitHub Pages, Netlify, Vercel, …).

## Structure

- `src/data/properties.ts` — single source of truth for every config property;
  drives both the playground controls and the docs API table so they can't drift.
- `src/sections/` — Nav, Hero, Features, Install, Playground, Docs, Footer.
- `src/components/CodeBlock.tsx` — copyable code blocks with lightweight highlighting.

> Note: full refraction (`backdrop-filter: url()`) renders in Chromium;
> other engines fall back to frost + lighting, as documented on the page.
