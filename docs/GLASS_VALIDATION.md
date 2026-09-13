# Material validation guide

## Reproducible conditions

Use the same browser, viewport, device scale factor, background and glass geometry for comparisons. Pause scene movement. Let map encoding and image decoding settle before capturing. Capture a warm run as well as a cold run. Report CPU map generation, map bytes/pixels, filter taps and frame intervals separately. JavaScript callback duration is not FPS or GPU time.

## Visual review

1. Over large black/white text, inspect the center and bezel separately. The center must not translate when displacement is toggled. Edges should bend smoothly without a diagonal shifted halo.
2. Over colored boundaries, inspect red/blue fringes. Test clear and frosted glass, both automatic and exact dispersion. The frost optimization is a heuristic, not a mathematical proof of perceptual equivalence.
3. Over light and dark scenes, rotate the light. The edge should move smoothly without becoming a uniform white outline or filling the glass with haze.
4. Test narrow pills, circular lenses, large cards and odd pixel dimensions. Check the symmetry axes and inner bezel transition.
5. Test CSS fallback and reduced transparency. Content remains present, interactive and legible. SVG support detection cannot prove actual pixel rendering; a rendered liveness check is required.
6. Inspect desktop and narrow phone layouts. No header overlap, horizontal overflow, clipped controls or obstructed keyboard focus.

## Functional review

- Set clear, then regular, then clear again. Resolved values must match each preset.
- Add then remove an explicit React override; reset returns to the declared configuration.
- Update light angle while stationary. It must visibly change.
- Change strength rapidly. It must update scale without regenerating a map. Geometry updates in one frame should coalesce.
- Mount identical geometries, destroy some while the map is pending, then destroy all. Remaining consumers retain valid maps; unused URLs are revoked.
- Mount on a vanilla element containing a real button with a listener. Content stays above the effects, listener survives destruction, original inline styles return.
- Destroy during delayed entrance or exit. No future DOM writes and no unresolved exit promise.
- With reduced motion enabled, no pointer spring or entrance/jiggle loop. With reduced transparency, use a solid material and release unused refraction resources.

## Acceptance and reporting

Unit tests cover invariants, not screenshot aesthetics. Rendered comparisons prove that refraction remains live, not that it matches Apple. Record visual observations separately from numeric results. Hardware performance and Safari/Firefox rendering require testing on those actual platforms.

## Results

Validated 13 September 2026 on Windows, Codex's Chromium 152 in-app browser, device scale factor 1. This is a local development run, not an npm release or production-device certification.

### Automated and package checks

- `npm test`: 6 tests passed (profile bounds/IOR 1, cache invariance and LRU, raster symmetry/padding/center, neutral encoding, dispersion gate, configuration).
- `npm run typecheck`: passed.
- `npm run build`: library ESM/CJS/types, demo, landing, docs and lab passed.
- `npm run build --workspace=compare`: passed; experimental renderer remains separate.
- Package smoke: root/core constructor identity passed for ESM and CJS. React server rendering preserved content without requiring browser globals at import time.
- `npm pack --dry-run --workspace=packages/quick-liquid`: shared chunks, all three entry points and declarations included. No package published.
- In-browser lifecycle checks: all 7 passed. These cover replacement/patch semantics, scale-only strength updates, stationary/moving lighting, original vanilla nodes/styles/listeners, concurrent map ownership, lazy noise, interrupted press, delayed/exit animation cancellation, and React StrictMode/reset/ref behavior.

### Controlled CPU/style-work comparison

Use **Compare lighting cost** in `/playground/`. The frozen v7 baseline is the original engine at commit `0f73283`. Both engines receive regular material, chromatic aberration 0.3, reflection 0.42, pointer lighting enabled, identical 340×220 geometry and 90 pointer updates. Fixtures are offscreen to isolate the JS/style work; this deliberately does not measure GPU rendering cost. The observer adds instrumentation overhead. No throttling was applied.

| Measurement | v7 | Current |
| --- | ---: | ---: |
| Lighting CPU per callback, run 1 | 0.223 ms | 0.057 ms |
| Lighting CPU per callback, run 2 | 0.200 ms | 0.041 ms |
| Lighting CPU per callback, run 3 | 0.216 ms | 0.048 ms |
| Gradient rewrites per run | 182 | 0 |
| Gradient characters rewritten per run | 229,860 | 0 |
| Displacement samples in this frosted case | 3 | 1 |
| Map computation across the three runs | 1.7–3.1 ms | 0.6–0.7 ms |

Observed callback reduction was approximately 3.9–4.9×. Frost gating removes two of three displacement samples in this case; it does not make the whole renderer three times faster. Timer granularity, JIT, cache state, scene, browser and hardware affect results. Map timing is secondary evidence from short samples, not a universal speedup. Exact mode retains three channels where requested.

### Rendered observations

- Inspected clear and regular glass over color boundaries and fine lines, in light and dark appearance. The center stays readable, the edge bends visibly, and the narrower reflection leaves more of the backdrop visible. Compared against Apple's published clear/regular material imagery for direction, not pixel parity.
- Rendered liveness check: pause the scene, capture the normal clear lens at strength 26, set SVG displacement scales to zero, capture again, then restore scales. Mean absolute RGB difference was approximately **5.21** in the surrounding lens region and **0.00** in the flat center (55px inset). This establishes live edge refraction with a stationary center on this browser. It is not a screenshot similarity score against Apple.
- Reduced-motion and reduced-transparency emulation: no backdrop filter, opaque dark tint, zero shared maps with four mounted engines; content remained visible. Emulation was cleared afterward.
- Landing hero inspected at 1280×720, 1101×800 and 390×844; playground inspected desktop and 390×844. No horizontal overflow in the inspected layouts. Existing brand/typography retained, heading no longer overlaps the fixed header, mobile controls wrap and stack.

### Remaining validation boundaries

Native Safari/Firefox, iOS/Android hardware, GPU traces, sustained thermal behavior, battery consumption and a statistically controlled frame-rate benchmark are not completed. No claim of 100× speed, identical Apple output, constant 60fps or universal perceptual equivalence is justified by these checks. Automatic frost gating is opt-out for visual comparison. Worker generation, continuous-corner geometry and unified merging optics remain future experiments described in the plan.
