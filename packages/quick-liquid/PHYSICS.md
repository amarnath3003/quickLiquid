# QuickLiquid — Optics & Optimization Math

This document derives the exact refraction model used by the engine and the
math behind its optimizations, including the error analysis that justifies the
"lowest possible quality loss" claim for 8-bit displacement maps.

---

## 1. The glass model

The element is modeled as a solid glass slab of refractive index `n` (config
`ior`, default 1.5) and thickness `T` (config `thickness`, CSS px), resting
directly on the backdrop plane. Its top face is flat in the center and rolls
off through a **convex circular-arc bezel** of width `B` (config `bezelWidth`)
at the shape's edge.

With `d` = distance from the shape boundary measured inward (from the signed
distance field) and `s = d / B ∈ [0, 1]`:

```
height   z(s) = T · √(s·(2 − s))            (quarter-ellipse arc, z(0)=0, z(1)=T)
slope    σ(s) = |dz/dd| = (T/B) · (1 − s) / √(s·(2 − s))
```

`σ → ∞` at the rim (vertical glass wall) and `σ → 0` at `s = 1` where the
bezel meets the flat top with C¹ continuity — no visible seam.

For pill/capsule shapes where `B > min(w,h)/2`, `B` is clamped to
`min(w,h)/2`, so `s` reaches exactly 1 on the medial axis with zero slope —
the bezel becomes a full smooth dome with no ridge artifact.

## 2. Exact Snell refraction

An orthographic view ray `v = (0, 0, −1)` strikes the tilted surface with unit
normal (in the cross-section plane spanned by the outward direction `m̂` and z):

```
n̂ = ( σ·m̂ , 1 ) / √(1 + σ²)
cos θᵢ = 1/√(1+σ²)        sin θᵢ = σ/√(1+σ²)
```

Snell's law in vector form, with `η = 1/n` (air → glass):

```
sin θₜ = η · sin θᵢ
cos θₜ = √(1 − sin²θₜ)
t = η·v + (η·cos θᵢ − cos θₜ)·n̂
```

Components of the refracted ray:

```
t_xy = (η·cos θᵢ − cos θₜ) · sin θᵢ      (lateral, sign < 0 ⇒ INWARD)
t_z  = −η + (η·cos θᵢ − cos θₜ) · cos θᵢ  (downward)
```

The ray then travels through glass depth `z(s)` to the (flat) bottom face; the
bottom interface adds no further lateral shift when the backdrop sits at the
exit plane. Total screen-space displacement:

```
Δ(s) = z(s) · |t_xy / t_z|
```

Properties that emerge (nothing is hand-tuned):

- `Δ(0) = 0` — the rim is continuous with the outside (z → 0 wins over σ → ∞;
  the limit of `z·tanφ` is 0 because `tanφ → √(1−η²)/η` is finite).
- `Δ(1) = 0` — flat center, perfectly clear glass.
- Δ peaks inside the bezel band → the signature Apple "clear center, bent rim".
- Sampling is **inward** (magnifier / water-droplet behavior), matching real
  thick glass and Apple's renderer.

## 3. The 1-D reduction (LUT)

For fixed `(T, B, n)`, `Δ` depends **only on s** — not on position. The engine
therefore tabulates the exact traced `Δ(s)` into a 512-entry `Float32Array`
once per geometry, normalizes it by `Δmax = max_s Δ(s)`, and per-pixel work
collapses to:

```
SDF(x,y) → d → s → lerp(LUT, s·512) → dx,dy = −m̂ · Δ̂(s)
```

No trig, no sqrt (beyond the SDF's), no Snell per pixel. The rounded-rect SDF
and its gradient `m̂` are analytic (corner-circle branch + edge branches), so
there are **no finite-difference probes** (the previous engine used 4 extra
SDF evaluations per pixel for the gradient — a 5× overhead, removed).

## 4. Band-limited, mirrored rasterization

- Pixels with `d ≥ B` (flat center) and `d ≤ 0` (outside) are exactly neutral.
  The buffer is pre-filled with neutral `(128,128)` via one `Uint32Array.fill`
  and only the bezel band is iterated: ~`perimeter × B` pixels instead of
  `w × h`.
- The displacement field is odd under mirroring:
  `dx(w−x, y) = −dx(x, y)`, `dy(x, h−y) = −dy(x, y)`.
  One quadrant is computed; four pixels are written per evaluation.

Measured on the demo (Chromium, mid-range laptop): a 522×621 panel computes
18,126 band pixels instead of 324,162 full-res pixels (**×18 fewer**), full
map generation 0.3–4.9 ms per unique geometry.

## 5. Minimal-loss 8-bit encoding

`feDisplacementMap` samples `P(x + S·(R−0.5), y + S·(G−0.5))` with R,G decoded
from an 8-bit map. The quantization step in *offset space* is `S/255` px —
independent of how much of the value range the map uses. Therefore, for a
required max displacement `M`, the loss-minimizing choice is the smallest
scale that still covers ±M:

```
map values  = Δ/Δmax ∈ [−1, 1]  → full 0…255 range
filter scale S = 2·M            (M = refractionStrength px)
⇒ quantization step = 2M/255 ≈ M/127   (e.g. 0.17 px at M = 22)
```

Any fixed, larger `S` (the previous engine used raw strength with an
un-normalized map) wastes range and multiplies the step size. On top of this,
a 4×4 **ordered Bayer dither** (±½ LSB, ~2 ops/px) decorrelates the residual
quantization into spatially white noise — banding contours become physically
invisible at 0.1-px amplitude.

## 6. Chromatic aberration for the price of zero maps

Dispersion means `n` varies per wavelength ⇒ `Δ` scales (to first order)
linearly per channel. Since `feDisplacementMap`'s `scale` attribute is exactly
that linear factor, CA needs **one shared map** and three scales:

```
S_R = S·(1 − 0.10·ca)     S_G = S     S_B = S·(1 + 0.14·ca)
```

(blue bends more; sampling is inward so blue gets the larger scale — real
crown-glass ordering). The previous engine generated three separate maps with
per-channel magnitudes baked in — 3× the generation work for a mathematically
identical result. Channel recombination stays in the filter
(`feComponentTransfer` isolation + `screen` blends, which is additive for
disjoint channels).

Bonus: because per-channel strength lives in the `scale` attribute, slider
changes to `refractionStrength` or `chromaticAberration` are **attribute-only
updates** — no map regeneration, no PNG encode, no repaint of the map.

## 7. Cache & sharing

Maps are keyed by `(map-res, element-size, radius, B, T, n)` and refcounted.
N same-size cards share one blob URL and one generation cost. The demo's four
353×163 panels generate exactly one map (verified via
`__QUICK_LIQUID__.metrics()` → `uniqueMaps < engineCount`).

## 8. Render-time cost model

Per composited frame, the browser evaluates the filter chain on the backdrop:
1 displacement tap (or 3 with CA) + blur + saturate. The engine keeps exactly
**one** backdrop-filter layer per element (the previous dual "edge frost"
layer doubled backdrop readbacks and was removed). Light-angle animation
touches only two small conic-gradient layers — the lens layer is never
invalidated by pointer motion.

## 9. Browser support & fallback

`backdrop-filter: url(#…)` renders in Chromium. A live DOM probe (not
`CSS.supports`, which lies) detects support; unsupported engines fall back to
blur + saturate + lighting layers (`refractionMode: 'auto'`). Two Chromium
pitfalls that silently disable only the url() part are documented in
`VISUAL_QA_HANDOFF.md` §3 — read it before touching layer stacking.
