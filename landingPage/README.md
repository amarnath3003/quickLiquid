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

Two pages (Vite multi-page build): the landing page at `/` and the full reference
at `/docs/` (`docs/index.html` → `src/docs-main.tsx` → `DocsApp`).

- `src/data/properties.ts` — single source of truth for every config property;
  drives both the playground controls and the docs API table so they can't drift.
- `src/sections/` — Nav, Hero (draggable glass card + frosted pill + clear lens),
  Features (glass cards), Liquid (LiquidTabBar + liquidPress + jiggle demos),
  Install, Playground, Docs (rendered on /docs/), Footer.
- `src/components/` — `CodeBlock` (copyable code), `Droplet` (the mascot),
  `Goo` (ambient metaball background), `Marquee` (words sliding under clear +
  frosted glass), `useLiquidTabBar` (tab-bar wiring: font-load + resize realign).

## Design language

- Type: **Fraunces** (display, soft/wonky axes + italics), **Outfit** (UI),
  **JetBrains Mono** (code) — self-hosted via fontsource, bundled at build time.
- The page dogfoods the library everywhere: the nav, feature cards, hero droplets,
  tab bars and buttons are all real `LiquidGlass` engines sharing displacement maps.

> Note: full refraction (`backdrop-filter: url()`) renders in Chromium;
> other engines fall back to frost + lighting, as documented on the page.
