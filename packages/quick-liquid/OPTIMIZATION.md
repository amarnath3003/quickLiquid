# QuickLiquid v8 — Per-Frame Cost Research

> Companion to [PHYSICS.md](PHYSICS.md). That document derives the *optics* and the
> map-generation optimizations (LUT reduction, band iteration, symmetry, 8-bit
> encoding). Those are one-time costs and are already near the floor
> (0.3–5 ms per unique geometry). This document attacks what is left — the
> **recurring per-frame GPU/paint cost** — and derives, with error bounds, a set
> of transforms that keep the rendered output perceptually identical while
> cutting the dominant per-frame work by ~1.5× (clear glass) to ~4× (frosted
> glass), and cutting the light-tracking animation cost to ~zero.
>
> Every claim here is falsifiable in the compare app (`compare/`): base engine
> (v7) and optimized engine (v8) render side-by-side or under a wipe divider
> from the same config.

---

## 0. Where a frame's time actually goes

For one glass element, per composited frame (Chromium, refraction path):

```
backdrop readback ─▶ SVG filter DAG ─▶ saturate() ─▶ blur() ─▶ clip to border-box
                        (url(#lens))      1 pass      ~2 passes
                                                      (downsampled)
+ paint of tint / sheen / rim layers   (only when invalidated)
+ compositing of 5 layers
```

Cost model: every filter primitive is one full-region texture pass. Writing
`A` for the filter-region area in *device* pixels:

| pass class | cost/px | why |
| :-- | :-- | :-- |
| `feDisplacementMap` | **~2×** | dependent texture read — the sampled address depends on another texture, defeating cache-line locality and texture prefetch |
| `feColorMatrix`, `feComponentTransfer`, `feBlend`, `feComposite`, `feImage` | 1× | streaming read → ALU → write |
| `blur(σ)` | ~2–3 total | Chromium separable + internal downsampling, effectively resolution-bounded |

The v7 chain with chromatic aberration on is **9 primitives, 3 of them
displacement taps** ⇒ per-frame filter cost ≈ `(3·2 + 6·1)·A = 12A`.
Everything below reduces either the pass count, the pass weight, or `A` itself
— or removes recurring paint entirely.

The four levers, in order of impact:

| § | lever | applies to | filter-cost effect |
| :-- | :-- | :-- | :-- |
| 1 | perceptual CA gating under frost | frosted materials (thin/regular/thick/ultra) | 12A → 2A |
| 2 | fringe algebra: 3 displacement taps → 2 | clear materials (CA visible) | 12A → 10A |
| 3 | filter-region minimization (pad = f(blur), not f(strength)) | all | A itself −25…45 % on clear; fixes two v7 edge artifacts |
| 4 | rotation-equivariant light bake | cursor-tracking / light animation | per-frame paint → compositor-only transform |
| 5 | tint layer fold + lazy noise | all | −1 full-size paint layer, −w·h·4·dpr² bytes |
| 6 | map sampling bound | map gen/decode/upload | map pixels ÷ ~2.25 at equal rim fidelity |

---

## 1. Chromatic aberration is invisible under frost — gate it

### 1.1 The fringe as a differential signal

With shared normalized field `Δ̂(x) ∈ [0,1]`, inward unit direction `m̂`, and
per-channel scales

```
S_R = S·(1 − 0.10·ca)      S_G = S      S_B = S·(1 + 0.14·ca)
```

each channel samples `I_c(x) = I(x + S_c·Δ̂(x)·m̂)`. First-order Taylor in the
channel split:

```
I_B − I_R ≈ split(x) · ∂I/∂m̂ ,   split(x) = (S_B − S_R)·Δ̂(x) = 0.24·ca·S·Δ̂(x)
```

The fringe is a *directional-derivative* signal with peak amplitude
`split_max = 0.24·ca·S` px worth of image gradient.

### 1.2 What the appended blur does to it

The lens filter list is `url(#lens) saturate(s) blur(σ)` — the frost blur runs
**after** refraction. Convolution commutes with differentiation:

```
G_σ ∗ (split · ∂I/∂m̂) = split · ∂(G_σ ∗ I)/∂m̂
```

For the worst case — a full-contrast unit step edge crossing the bezel — the
blurred gradient peaks at `g_σ(0) = 1/(σ√2π)`, so the maximum chroma amplitude
that survives the frost is

```
A_fringe = split_max / (σ·√2π)          (fraction of full scale)
```

### 1.3 Detection threshold with luminance masking

The fringe is spatially co-located with the (large) luminance gradient of the
blurred edge itself. Chromatic detection thresholds rise ~5–10× under
co-located luminance contrast (Switkes, Bradley & De Valois 1988, chromatic
masking data); the masked threshold for an R–B opponent modulation on a strong
edge is ≳ 12–15 % of the edge contrast. We gate conservatively at **14 %**:

```
CA invisible  ⇔  A_fringe < 0.14   ⇔  split_max < 0.14·√2π·σ ≈ 0.35·σ
```

**Gate rule (v8):** build the CA filter branch only when

```
0.24 · ca · refractionStrength ≥ 0.35 · blur
```

Applied to the shipped materials at default `ca = 0.3`:

| material | S | blur σ | split_max | 0.35σ | CA branch |
| :-- | --: | --: | --: | --: | :-- |
| clear | 26 | 2 | 1.87 px | 0.70 | **kept** |
| thin | 18 | 6 | 1.30 px | 2.10 | gated off |
| regular | 16 | 14 | 1.15 px | 4.90 | gated off |
| thick | 12 | 22 | 0.86 px | 7.70 | gated off |
| ultra | 10 | 30 | 0.72 px | 10.50 | gated off |

For every frosted material the 8-primitive CA sub-graph was computing a signal
whose amplitude after the frost is 1–4 % of a *worst-case* edge — an order of
magnitude below the masked threshold. Gating it takes the chain from
9 primitives / 3 displacement taps to **2 primitives / 1 displacement tap**:
`12A → 2A` (§0 cost model), i.e. **6× less filter work for frosted glass**,
with zero perceptible change (verify in wipe mode: `regular` preset, hard-edge
backdrop).

The same argument gates the whole `url()` reference when the *refraction
itself* is sub-threshold. A geometric shift of blurred content is detectable
down to roughly `0.12σ` (vernier-type task on a blurred edge), so v8 drops the
SVG filter entirely when `S < max(1.5 px, 0.12·blur)` — reverting to the
native `blur+saturate` fast path. Defaults never trigger this; tiny-strength
configs do.

Both gates are exposed as `autoGate: false` to force v7 behavior.

---

## 2. Dispersion with two displacement taps instead of three

When CA *is* visible (clear glass), v7 pays 3 dependent-read passes. The three
channel images are the same 1-D family `D(u) = I(x + u·Δ̂·m̂)` evaluated at
three nearby parameters — they are not independent:

```
D(S_R) = D(S_G) + (S_R−S_G)·D′ + O(δ²)
D(S_B) = D(S_G) + (S_B−S_G)·D′ + O(δ²)
```

Eliminating `D′` between the two expansions gives the red channel as an
extrapolation of the two channels we already have:

```
D(S_R) ≈ (1+λ)·D(S_G) − λ·D(S_B) ,     λ = 0.10/0.14 = 5/7 ≈ 0.7143
```

so the graph needs only the G and B taps:

```
feImage → map
dG = feDisplacementMap(SourceGraphic, map, S_G)          ← dependent read
dB = feDisplacementMap(SourceGraphic, map, S_B)          ← dependent read
T  = feComposite(dG, dB, arithmetic, k2 = 1+λ, k3 = −λ)  ← red extrapolation
R  = feColorMatrix(T,  keep R)
G  = feColorMatrix(dG, keep G)
B  = feColorMatrix(dB, keep B)
out = feBlend(screen, feBlend(screen, R, B), G)          ← exact add: channels disjoint
```

9 primitives (same as v7) but displacement taps **3 → 2**: `12A → 10A`, and
the removed pass is the expensive kind. (`screen(a,b) = a+b−ab` is exact
addition when one operand is zero per channel; `feComposite/arithmetic`
operates on premultiplied RGBA — all inputs here are opaque, `α = k2+k3 = 1`.)

**Error bound.** The extrapolation error is second order:

```
E = ½·D″·(S_R−S_G)(S_R−S_B) + O(δ³)  ⇒  |E| ≤ ½·(0.10·ca·S)·(0.24·ca·S)·|D″|
```

`E ≡ 0` wherever the backdrop is locally linear along `m̂` over the split
distance (~1.6 px at defaults). At a hard edge the red fringe profile deviates
within the same ≤2 px zone the fringe itself occupies, bounded by ~λ/(1+λ) ≈
42 % *of the fringe amplitude* — a second-order difference in an already
near-threshold signal. Out-of-gamut extrapolation (`k2·dG − λ·dB ∉ [0,1]`)
clamps, which matches the physical saturation of the true sample.

Config: `caMode: 'fast' | 'exact'` (default `'fast'`; `'exact'` reproduces the
v7 graph bit-for-bit for A/B).

---

## 3. The filter region: pad must follow the blur, not the strength

v7 sets the filter region to the element padded by `pad = S + 4` px
(`x = −pad … w + pad`). Two independent findings:

### 3.1 The pad's only real job is feeding the appended blur

The displacement field points strictly **inward** (`Δ` is a magnifier), so the
displacement pass never needs data beyond the border box. The output beyond
the border box is clipped away by the compositor. The only reader of
out-of-element pixels is the `blur(σ)` appended after `url()`: it receives the
url()-stage output, which is transparent black beyond the declared region. A
visible edge pixel at distance 0 from the border is missing the Gaussian mass
that lies beyond the pad:

```
missing(p) = ½·erfc( p / (σ√2) )
```

Requiring the missing mass to stay below ~1.5 LSB (0.6 %, invisible):
`erfc(x) ≤ 0.012 ⇒ x ≈ 1.78 ⇒ p ≥ 2.5σ`. v8 therefore uses

```
pad = ⌈2.5·blur⌉ + 2      (bucketed to {2, 8, 16, 24, 32, 40, 48, 64}
                           so blur sliders stay attribute-only updates)
```

Consequences vs v7's `pad = S + 4`:

- **clear** (σ=2, S=26): pad 30 → 8. Region for a 300×200 card:
  360×260 → 316×216 = **−27 % pixels in every pass**, on top of §2.
- **regular** (σ=14, S=16): pad 20 → 40. v7 was *under*-padded: the outermost
  ~10 px ring is missing up to 7.6 % of its blur mass — a measurable edge
  vignette. v8 spends more area here, but §1 already cut the pass count 6×,
  and the edge becomes exact.

### 3.2 Found artifact: the pad ring is displaced by (−S/2, −S/2)

`feImage` places the map at exactly `0…w, 0…h`. Inside the pad ring the map
input is transparent black, so `feDisplacementMap` decodes channel value 0 →
offset `S·(0 − 0.5) = −S/2` **on both axes**: v7 fills the pad ring with a
diagonally shifted copy of the backdrop, which the blur then smears into the
visible rim (a ghost under strong frost; also alpha-eroded where the shifted
sample lands outside the region). v8 bakes a **neutral border** (128,128) into
the map bitmap itself, `padM = pad·ρ` map-pixels wide, and stretches
`feImage` over `−pad … w+pad`. The pad ring then displaces by exactly zero and
the edge blur reads true backdrop. Cost: a few extra rows in the (memset-fast)
neutral fill.

---

## 4. The two-lobe light is rotation-equivariant — bake it, rotate it

The rim/sheen intensity profile (PHYSICS.md conic model) is

```
I(θ; θ_L) = base + peak·|cos(θ − θ_L)|^p − dark·sin²(θ − θ_L)
```

which satisfies the equivariance `I(θ; θ_L) = I(θ − θ_L; 0)`: **the light
angle only rotates a fixed template**, it never changes its shape. v7 ignores
this and, on every animation frame of cursor tracking, rebuilds two 37-stop
`conic-gradient` CSS strings (CPU), forces style recalc, repaints both ring
layers (w·h·dpr² px each), and re-runs a `blur(3px)` filter on the sheen.

v8 bakes the θ_L = 0 template **once per config** into a child "light disk"
(side `⌈√(w²+h²)⌉`, so rotation never exposes a corner) inside each masked
ring layer, then animates with

```
disk.style.transform = translate(-50%,-50%) rotate(θ_L)
```

— a compositor-only property (promoted via `will-change: transform` only while
the light animation is running, so no permanent extra layer memory). Per-frame
cost of light tracking collapses from two full repaints + string building to
two transform writes.

Three exactness notes:

- **Hover glow** multiplies `(peak, base, dark)` by a common factor `g` — the
  template is *linear* in these, so glow is exactly `opacity: g` on the disks…
  when `g ≤ 1`. Since `hoverLighting` can push `g` to 1.3, v8 keeps the v7
  live-restyle path when `hoverLighting: true` (opt-in feature keeps its
  price) and uses the baked path for the common cases (static light,
  `cursorTracking`).
- **Banding.** v7's 10° stops piecewise-linearize `|cos|^p`; for p = 2.2 the
  max interpolation error is ~2.3 % of peak — the mach banding the sheen's
  per-frame `blur(3px)` existed to hide. The bake samples at **2°** (error
  < 0.1 %, below the 8-bit floor), so the per-frame blur is dropped instead of
  baked. The ring masks are unchanged (masks clip children), so the radial
  profile is identical; the angular profile is *closer* to the target curve
  than v7's.
- Conic angles are measured in screen geometry, so template + rotation is
  exactly equivalent to v7's re-angled gradient for any aspect ratio.

---

## 5. Compositing identities: fewer layers, same pixels

- **Tint fold.** By the Filter Effects spec, an element's own background paints
  *over* its filtered backdrop. Therefore the tint gradient — v7's separate
  `.ql-tint` sibling directly above the lens — can move into
  `background` of the lens element itself: identical operator order
  (`tint ⊕ over ⊕ filtered-backdrop`), pixel-exact, and one full-size paint
  layer (w·h·4·dpr² bytes) disappears. A 400×300 card at dpr 2 saves ~1.9 MB.
- **Lazy noise.** `.ql-noise` defaults to opacity 0 but v7 still creates and
  composites it. v8 creates it only when `noiseOpacity > 0`. (It stays a
  separate top layer when on: its `overlay` blend must apply over the rim
  lines too, so folding it down would change the composition order.)

Layer stack: 5 → 3 divs in the default configuration (lens+tint, sheen, rim).

---

## 6. Map resolution from sampling theory

The displacement field is neutral outside the bezel band; inside, the
tangential variation scale is `min(radius, B)` and the radial profile is
`Δ̂(s) ∝ √s` near the rim. For bilinear map reconstruction at cell size `c`
(CSS px), the worst error is at the first sample ring: linear interpolation of
`√u` over `[0, h]` errs by `√h/4` at `u = h/4`, giving

```
E_rim ≈ S·√(2c/B)/4
```

and interior error `≤ S·c²·|Δ̂″|/8 ≪ E_rim`. At v7-high (c = 1) this is
~1.3 px on S = 22; the perceptual effect is confined to a ≤c-wide softening of
the rim onset that co-locates with the 1.25 px rim hairline and its
anti-aliasing.

v8 chooses `c` per quality tier instead of a flat resolution cap:

```
high:    c = min(1.5, B/10)   (map pixels ÷ 2.25 for typical elements)
medium:  c = min(3,   B/5)
low:     unchanged 128-px cap
```

This bounds map generation, PNG encode/decode, and GPU upload — all ~∝ 1/c² —
while the rim-onset error grows only ∝ √c. The claim "indistinguishable at
c = 1.5" is exactly the kind the wipe view exists to test; `quality: 'high'`
with a custom `mapDensity` override is available if inspection disagrees.

(Also folded in: element size is quantized to 4 px buckets for the map cache
key during live resize, turning resize-drag regeneration storms into stretch
reuse — the ≤4 px map stretch is far below `E_rim`.)

---

## 7. Cost accounting (300×200 card, dpr 2, ca 0.3)

Filter work per frame in kilo-pass-pixels (pass-px = one texture pass over one
device pixel; displacement passes weighted ×2 per §0):

| | v7 clear | v8 clear | v7 regular | v8 regular |
| :-- | --: | --: | --: | --: |
| region (CSS px) | 360×260 = 93.6k | 316×216 = 68.3k | 340×240 = 81.6k | 380×280 = 106.4k |
| primitives (disp) | 9 (3) | 9 (2) | 9 (3) | 2 (1) |
| weighted passes | 12 | 10 | 12 | 3 |
| **filter kpx/frame** | **4 493** | **2 731** | **3 917** | **1 277** |
| light-tracking frame | 2 repaints + blur + string build | 2 transforms | same | same |
| paint layers | 5 | 3 | 5 | 3 |
| map bitmap px | 60k | 29k | 60k | 29k |

≈ **1.65×** less filter work for clear glass, ≈ **3.1×** for frosted (rising
with element size since the frosted chain is now O(region) with a tiny
constant), light animation ≈ free, and two v7 edge artifacts (§3.1 under-pad
vignette, §3.2 displaced pad ring) fixed. On top: fewer composited layers and
4× less map traffic. The blur/saturate stages are native Chromium fast paths
in both engines and unchanged.

---

## 8. Explored and rejected (so nobody re-treads)

- **Half-resolution backdrop rendering** (undersized lens div + `scale(2)`):
  modern Chromium rasterizes at effective screen scale, and backdrop capture
  follows the effect node's device scale — the trick yields nothing reliable
  and risks the documented url() stacking quirks. The only honest resolution
  lever inside `backdrop-filter` is the browser's own internal blur
  downsampling, which we already inherit.
- **Band-strip filter subregions** (running displacement only on 4 thin rects
  covering the bezel): primitive subregions are rects, the interior still
  needs a copy pass, corner strips overlap/seam, and the win is bounded by
  the interior/band area ratio — measured as not worth 12 extra primitives
  and the quirk surface.
- **One-tap Taylor CA** (`fringe ≈ split·∂I/∂m̂` synthesized from the base
  tap): SVG has no directional-derivative primitive; emulating with offset
  subtraction reintroduces a second tap with worse conditioning than §2.
- **`feTurbulence`/procedural maps**: cannot hit the exact Snell profile;
  feImage decode is already ~free after §6.
- **WebGL snapshot mode** for Safari/Firefox refraction parity: sound, but it
  changes the integration contract (the host must provide the backdrop as a
  texture — arbitrary DOM cannot be sampled). Tracked as a roadmap item, not a
  perf item.

## 9. Verification protocol

`npm run dev:compare` → compare app:

1. **Parity**: wipe mode, same profile both sides — inspect rim, fringe,
   frost, edge (§3 fixes mean v8 should look *cleaner* at frosted edges).
2. **Gating honesty**: `clear` preset must keep visible CA; drag blur up and
   confirm the fringe disappears into the frost *before* the gate trips
   (badge shows gate state).
3. **Throughput**: stress grid ×8, scene motion on, solo Base vs solo Opt —
   compare FPS / p95 frame time on the same machine.
4. Metrics readouts: displacement taps, region px, map px, gen ms per engine.
