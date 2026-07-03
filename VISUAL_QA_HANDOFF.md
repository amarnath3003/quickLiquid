# Visual QA Handoff — QuickLiquid Liquid Glass

**Audience:** an AI (or human) with strong image-reading capabilities and browser access.
**Mission:** iterate on the *look* until QuickLiquid glass is visually indistinguishable from Apple's Liquid Glass (iOS 26 / macOS Tahoe). The physics, performance, and plumbing are done and verified — what remains is aesthetic tuning driven by looking at renders.

---

## 1. Current state (verified, do not re-litigate)

The refraction pipeline is **confirmed live end-to-end** by numeric pixel-diffing (not eyeballing):

| Element | mean |ΔRGB| toggling displacement off/on | status |
|---|---|---|
| `.glass-hero-pill` (over big text) | 22.99 | LIVE |
| `.material-card` (over vivid strip) | 2.00 | LIVE |
| `.playground-lens` (over dark stripes) | 1.63 | LIVE |
| `.glass-panel` (over near-uniform bg) | 0.02 at default / 0.67 at scale 140 | LIVE, weak backdrop contrast |

Map generation: 0.3–4.9 ms per unique geometry, same-size elements share one cached map.

## 2. How to run

```bash
npm run dev                # vite on http://localhost:5173
node tools/shot.cjs <outPrefix>       # (from demo/) full page + panel + nav closeups, dpr 2
node tools/verify.cjs                 # numeric liveness + engine metrics
node tools/diffcheck.cjs              # displacement on/off diff harness
```

In the browser console: `__QUICK_LIQUID__.metrics()` returns per-engine map timings & cache keys.

All glass code lives in **`packages/quick-liquid/src/core/engine.ts`** (vite aliases the demo straight to source — edit and the page hot-reloads).

## 3. ⚠️ Chromium landmines (cost a day to find — NEVER reintroduce)

1. **No `isolation: isolate`** (or `filter`, `opacity < 1`, `mask`, `mix-blend-mode`) on the glass **host** or any ancestor you control. Any of these creates a *backdrop root* and the child's `backdrop-filter` silently loses the page background. Blur keeps working, so the failure is invisible unless you look for the warp.
2. **No explicit `z-index` on the `.ql-lens` layer** (the one carrying `backdrop-filter: url(#…)`). An explicit z-index (even `0`) kills the `url()` displacement in real-world nesting while blur keeps working. Layer stacking is DOM-order only; `.ql-content` keeps `z-index: 10`.
3. When the `url(#id)` **reference** changes, the engine swaps in a **fresh lens node** with the final filter string already set (`updateLensStyle()`); Chromium doesn't reliably pick up url() additions on an already-composited element. Keep this behavior.
4. Verify visually with **numbers first**: `tools/diffcheck.cjs` toggles `feDisplacementMap scale` 0↔140 and prints mean pixel diff. > 0.5 in a region = displacement live there. Use it after any layer/stacking change.

## 4. What "looks like Apple" means — the target checklist

Compare against real screenshots of iOS 26 / macOS Tahoe Liquid Glass (Control Center tiles, tab bars, the drag-a-glass-icon-over-text effect):

- [ ] **Clear center** — the middle of the glass shows the backdrop nearly undistorted (blur per material, but no warp).
- [ ] **Bezel warp** — a band ~`bezelWidth` px wide at the edge visibly bends/compresses the backdrop *inward* (magnifier behavior). Straight lines crossing the rim should kink smoothly. This is THE signature; if you can't see it over a busy backdrop, raise `refractionStrength` (px of max rim displacement) or judge over higher-contrast content.
- [ ] **Crisp rim light** — ~1.25px bright ring with **two lobes**: one at the light angle, one mirrored 180°. Sides between lobes fall nearly to nothing. No uniform border.
- [ ] **Bezel sheen** — a soft, low-opacity sweep inside the bezel band aligned with the rim lobes, slight dark flanks at ±90°. Must NOT wash out the warp (this is currently the most suspect layer — see §6).
- [ ] **Chromatic fringes** — faint R/B color splitting only where bending is strong (rim band), invisible in the center.
- [ ] **No milky fog** — tint stays ≤ ~0.05 for clear material. If the glass reads "white soap bar", tint/sheen are too strong.
- [ ] **Soft double shadow** below, subtle; content above stays crisp.
- [ ] **Materials**: `clear` = water-like, minimal blur, strong lensing; `regular`→`ultra` = increasing frost/blur with gentler lensing.

## 5. Tuning map — which knob moves what

Config (see `DEFAULT_CONFIG` / `MATERIAL_PRESETS` in engine.ts, sliders in the demo):

| Knob | Effect |
|---|---|
| `refractionStrength` | max rim displacement in **px** (filter scale = 2× this). Apple cards ≈ 14–26 |
| `bezelWidth` | width of the warped band |
| `thickness` | glass depth — shapes the falloff curve (and shadow) |
| `ior` | 1.4–1.6; higher = stronger bend for same geometry |
| `chromaticAberration` | 0–1 → ±% per-channel scale split |
| `blur` / `saturation` | center frost & color richness |
| `edgeHighlight` / `fresnelPower` | rim ring intensity / lobe tightness |
| `specularStrength` | bezel sheen intensity |
| `lightAngle` | degrees, 0 = top |

Rendering functions to edit for look changes: `updateRings()` + `conicStops()` (rim & sheen), `updateTint()`, `applyDepth()` (shadows), `buildRefractionLUT()` (bezel profile math — change only if the warp *shape* is wrong, not its visibility).

## 6. Known aesthetic issues to start with

1. The **sheen ring** (`.ql-sheen`, blur(3px), conic wash over the whole bezel band) may still fog the warp. Try `specularStrength` 0.2–0.35, or narrow the sheen ring to ~60% of bezelWidth.
2. The default scene panels sit over a **pale, low-contrast background**, so their refraction is invisible even though it's live. Judge refraction on the Playground / Materials sections, or move panels over busier backdrops.
3. Rim lobes' angular width (`fresnelPower`) and the two-lobe symmetry have not been visually compared against Apple yet.
4. `regular/thick/ultra` material presets are first guesses — tune blur/tint against Apple's frosted materials.
5. Hover glow (`hoverLighting`) multiplies ring intensity ×1.3 — check it's subtle, not blinking.

## 7. Iteration workflow

1. Edit `engine.ts` (or demo config) → vite hot-reloads.
2. `node tools/shot.cjs iterN` → look at `iterN-closeup.png` / `iterN-nav.png` at high zoom; also screenshot the Playground with the lens over the type.
3. After structural/layer changes, run `tools/diffcheck.cjs` to prove displacement stayed live (guards against landmines §3).
4. Compare against Apple reference imagery side by side; adjust; repeat.
