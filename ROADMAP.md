# QuickLiquid — Roadmap: Next Steps · Upgrades · Improvements · Optimisations

Single source of truth for what comes after the v7 engine rewrite
(exact-Snell refraction core, band-limited map generation, shared map cache,
two-lobe conic lighting). Items are grouped and tagged **[impact / effort]**.

---

## 1. Immediate next steps (in order)

1. **Visual QA iteration** — hand [VISUAL_QA_HANDOFF.md](VISUAL_QA_HANDOFF.md)
   to an image-capable agent and iterate on: sheen wash vs warp visibility,
   rim lobe width, frosted material presets, hover glow subtlety. The
   mechanism is proven live (numeric diffs); only aesthetics remain.
   **[high / medium]**
2. **Commit the v7 work** in logical chunks (engine core, demo showcase,
   docs/tools) once visuals are approved. **[high / low]**
3. ~~**Dark-mode pass**~~ ✅ **DONE** — `appearance: 'light' | 'dark' | 'auto'`
   (auto follows `prefers-color-scheme` live) + `backdropLuminance` hook.
   Dark: default tint → deep smoke `20,24,34` (×1.75 opacity), rim/sheen
   intensity derived from backdrop luminance (light tuning unchanged at
   L=0.8), shadow → ambient glow swap. Demo has a light/dark scene toggle;
   playground lens + material cards pin `appearance: 'dark'`. **[high / medium]**
4. **Publish `0.2.0` to npm** with dist build, README badges pointing at a
   deployed demo (Vercel/Netlify — the demo already builds statically).
   **[high / low]**

## 2. Visual fidelity upgrades (Apple parity)

- **2.1 Squircle (superellipse) corners** — Apple uses continuous-curvature
  corners, not circular arcs. Swap the rounded-rect SDF for a squircle SDF
  (`|x/a|^n + |y/b|^n = 1`, n≈4–5) in both the map generator and a `clip-path`
  on the host. The bezel warp then follows the squircle exactly — very visible
  on large radii. **[high / medium]**
- **2.2 Motion-reactive lighting** — tie `lightAngle` to `DeviceOrientation`
  on mobile and to global pointer position on desktop (Apple's rim light
  shifts as you tilt). The conic rings already animate cheaply. **[medium / low]**
- **2.3 Edge-progressive frost** — Apple's clear material shows slightly more
  scatter in the bezel than the center. Instead of the removed dual
  backdrop-filter (expensive), encode a subtle blur-radius variation by
  compositing a masked semi-transparent copy of the sheen ring — or accept
  the displacement compression as-is. Prototype and A/B. **[medium / medium]**
- **2.4 Interior refraction of content** — Apple refracts the glass's own
  content slightly near the rim (icons swim when a tab bar morphs). Apply
  `filter: url(#lens-weak)` (same map, ~25% scale) to `.ql-content` behind an
  opt-in flag (`refractContent: true`). **[medium / low]**
- **2.5 Specular micro-glints** — tiny bright points where the rim's two lobes
  peak (Apple shows them on pills/buttons). Two 2–3px radial gradients
  positioned from `lightAngle` on the rim ring. **[low / low]**
- **2.6 Adaptive tint (real)** — `environmentSampling` is currently a no-op.
  Sample the backdrop once per second via a 1px `html2canvas`-free trick:
  paint the page region into an OffscreenCanvas is impossible cross-origin —
  instead expose a `sampleColor` callback / CSS var hook so apps can feed
  wallpaper color, and derive tint + rim intensity from it. **[medium / medium]**

## 3. Performance optimisations (next wave)

- **3.1 Skip PNG round-trip** — `canvas.toBlob` + `<feImage href=blob>` costs
  a PNG encode + decode per map (~1–3 ms each). Chromium accepts
  `feImage href="data:image/png..."` only, but **`filter` can also reference
  a `<pattern>`-free `feImage` pointing at another SVG element**; alternative:
  keep canvas → `transferToImageBitmap` → OffscreenCanvas →
  `convertToBlob({type:'image/webp', quality:1})` is *lossy-risky* — measure
  lossless WebP (`image/webp` lossless) vs PNG encode time; pick faster.
  **[medium / low]**
- **3.2 Move map generation to a Worker** — `generateLensMap` is pure math on
  an `ImageData`; run it in a Worker with `OffscreenCanvas` so a burst of
  first-mounts (long lists) never touches the main thread. The cache already
  dedupes; the Worker only sees unique geometries. **[medium / medium]**
- **3.3 Half-resolution maps by default for large elements** — the bilinear
  stretch of `feImage` is visually lossless for smooth fields. Cap `resCap`
  at 512 for `quality: 'high'` after visual confirmation (error is sub-LSB in
  offset space for B ≥ 16px). Halves generation time and blob size again.
  **[low / low]**
- **3.4 Batch DOM writes on config bursts** — `updateConfig` currently updates
  five layers synchronously; coalesce slider storms behind one rAF (the
  filter-scale path is already surgical, the ring/conic string rebuilds are
  the remaining cost, ~1.5 KB string × 2 per change). **[low / low]**
- **3.5 Shared `<svg>` container** — each engine appends its own 0×0 `<svg>`
  to `<body>`. One static container holding all `<filter>` defs reduces DOM
  noise and layout bookkeeping for hundreds of instances. (Keep per-engine
  filter ids — per-engine scale attributes must stay independent.)
  **[low / low]**
- **3.6 `content-visibility` / IntersectionObserver gating** — pause pointer
  springs and skip map rebuilds for off-screen glass; rebuild lazily on first
  intersection. Matters for long scrolling lists of glass cards.
  **[medium / medium]**
- **3.7 Quantise resize rebuilds** — ResizeObserver already rAF-debounces;
  additionally snap transient sizes (drag-resize, springy layouts) to 4px
  buckets *during* the gesture and rebuild exact-size once at rest — the
  bucket maps come from cache after the first resize cycle. **[low / medium]**

## 4. Engine & API upgrades

- **4.1 `LiquidGlassGroup` metaball refraction** — the existing
  `LiquidGroup` merges shapes visually, but each blob has its own rectangular
  filter. Upgrade: generate one displacement map from the *union SDF*
  (`smin()` of member SDFs) over the group's bounding box so merged droplets
  refract as one body. The SDF pipeline already supports arbitrary `d`+`m̂`
  sources. **[high / high]**
- **4.2 Per-corner radii + arbitrary SDF shapes** — accept
  `borderRadius: [tl, tr, br, bl]` and an escape hatch
  `sdf: (x, y, w, h) => [d, mx, my]` for custom shapes (hexagons, blobs).
  **[medium / medium]**
- **4.3 Morph-aware maps** — when `LiquidMorph` animates border-radius, the
  map is stale mid-flight. Cheap fix: pre-generate start/end maps and
  cross-fade the two filters' scales; exact fix: Worker-generated keyframe
  maps at 15 fps. **[medium / high]**
- **4.4 SSR/Next.js safety audit** — constructor touches `document` lazily
  already; add `typeof window` guards in module scope (none currently, keep it
  that way), export a `<LiquidGlass ssr>` no-op shell, test in Next 15 RSC.
  **[medium / low]**
- **4.5 Vue / Svelte / Web Component wrappers** — the engine is
  framework-free; ship `quick-liquid/vue`, `quick-liquid/svelte`, and a
  `<liquid-glass>` custom element (shadow DOM keeps layer children out of
  user querySelectors). **[medium / medium]**
- **4.6 TypeScript strictness + config validation** — dev-mode warnings for
  out-of-range configs (`tintOpacity > 0.3` = soap bar, `bezelWidth >
  minDim/2` = clamped, explicit `z-index`/`isolation` detected on host →
  console.warn with link to the landmine doc). **[medium / low]**

## 5. Robustness & browser support

- **5.1 Firefox/Safari fallback quality** — current non-Chromium path is
  blur + saturate + rings (no warp). Improve the illusion: add the inward
  "edge darkening + inner highlight arc" gradient trick at the bezel (fake
  refraction cue used by good glassmorphism), gated on the SVG-support probe.
  **[high / medium]**
- **5.2 Safari `-webkit-backdrop-filter` re-test** — Safari 18+ may render
  `url()` filters on backdrop; the probe would auto-enable it. Verify on real
  WebKit; if the probe false-positives, pin `refractionMode: 'css'` via UA
  sniff as a last resort. **[medium / low]**
- **5.3 Landmine regression tests** — turn `demo/tools/diffcheck.cjs` into a
  CI check (headless Chromium): assert refraction liveness > threshold on the
  playground lens and hero pill after every engine change. This is the test
  that would have caught the `isolation`/`z-index` bugs years earlier.
  **[high / low]**
- **5.4 Reduced-motion & accessibility** — honor
  `prefers-reduced-motion` (disable springs/parallax), keep text contrast on
  glass ≥ WCAG AA by auto-bumping tint behind text-heavy content (opt-in).
  **[medium / low]**
- **5.5 Memory audit for SPA churn** — React StrictMode double-mounts are
  handled by refcounts; add a `mapCache` eviction cap (LRU, ~64 entries) so a
  long-lived SPA resizing windows forever can't accumulate blobs.
  **[medium / low]**

## 6. Tooling, docs, release

- **6.1 CI pipeline** — GitHub Actions: typecheck, lib build, demo build,
  liveness diffcheck (5.3), bundle-size budget (`dist` currently 81 KB CJS —
  set 90 KB ceiling; consider splitting animations from core for a ~30 KB
  glass-only entry). **[high / low]**
- **6.2 Split entry points** — `quick-liquid/core` (engine only, no
  animations) for users who just want glass; keeps tree-shaken installs
  minimal. **[medium / low]**
- **6.3 Interactive docs site** — deploy the demo as the docs site; add a
  "copy config" button that serialises the current sliders to a
  `<LiquidGlass config={{…}}>` snippet. **[medium / medium]**
- **6.4 Visual regression snapshots** — once the look is approved, store
  golden screenshots (per material preset) and diff in CI at a loose
  threshold to catch accidental style regressions. **[medium / low]**
- **6.5 Benchmark page** — a `/bench` route mounting 100–500 glass cards,
  reporting map-gen totals, cache hit rate (`__QUICK_LIQUID__.metrics()`),
  and scroll FPS — turns the performance claims into a reproducible number.
  **[medium / low]**

---

### Suggested sequencing

**Week 1:** §1.1 visual iteration → §1.2 commit → §5.3 liveness CI → §1.4 publish.
**Week 2:** §2.1 squircles + §2.2 motion lighting + §1.3 dark mode.
**Week 3:** §3.1/3.2 worker + encode pipeline, §6.1 CI, §6.2 split entries.
**Later:** §4.1 group refraction (the headline feature nobody else has).
