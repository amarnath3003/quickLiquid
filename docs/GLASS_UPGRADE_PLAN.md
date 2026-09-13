# quickLiquid material upgrade

## Intent

Improve the actual material for React and vanilla JavaScript, keeping the precomputed optics architecture. “100 times better” is an ambition, not a measured performance claim. Success means a visible improvement, fewer unnecessary operations, correct lifecycle behavior, and reproducible checks.

## Audit (12 September 2026)

- Production uses `src/core/engine.ts` (v7). The v8 candidate in `engine-opt.ts` is separate, used for comparisons, and does not reach React consumers.
- The production pipeline already reduces vector Snell refraction to a 512-entry profile, evaluates a rounded-rectangle bezel in one quadrant, mirrors it, caches PNG maps, and lets the browser composite them. Preserve these strengths.
- Neutral is encoded as 128/255, but SVG displacement subtracts 0.5. This gives even the flat center a small offset. Pixels outside the map become transparent black, causing a much larger offset in the filter padding.
- Pointer motion reconstructs two gradient strings and repaints a blurred sheen. The optimized candidate already demonstrates rotating baked lighting; use that principle in production.
- `updateConfig` attempts to infer explicit overrides from resolved defaults. Switching material can carry old preset values; changing `lightAngle` does not update the light's target.
- React config is declarative but the engine treats every update as a merge. Removing an override or pressing Reset can leave it active. The imperative ref can expose a null engine after mounting.
- Vanilla content lacks the wrapper supplied by React. Destroy clears unrelated host styles. Delayed entrance work and interrupted exit promises need lifecycle cleanup.
- The landing page preserves a distinctive droplet mark, Outfit typography, mint accent, interactive glass, docs and install paths. Its stacked CSS overrides and fixed header obscure the heading at intermediate widths. Some copy overclaims: no canvas (canvas is used to encode maps), free dispersion, and a hard-coded 60fps badge. Its computed FPS is not FPS.

## Visual direction

Preserve the brand, routes and working interactions. Premium, quiet presentation around a real running material. Design variance 6 / motion intensity 5 / density 4. Native CSS and existing components; no new animation dependency. The design skill applies to the marketing surfaces; the renderer and diagnostic lab are engineering work.

Material priorities: a readable clear center; smooth inward bending confined to the bezel; a fine directional rim; restrained internal reflection that does not fog the center; subtle rather than rainbow-default dispersion; grounded shadows; responsive light with no idle animation loop.

Apple reference: [Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/) and [Materials](https://developer.apple.com/design/human-interface-guidelines/materials). Apple's material combines lensing, adaptive contrast and touch response. This is an independent web approximation, not Apple's implementation. Apple does not publish a web renderer or a parity test.

## Execution order

1. Preserve a v7 reference for controlled A/B measurements. Extract production map math into a pure module with symmetry, boundary and encoding tests.
2. Correct neutral displacement and padding. Bound profile caching and make pending map ownership safe. Keep high-quality exact RGB sampling; allow a conservative frost gate with an exact override.
3. Bake lighting once and rotate it during interaction. Narrow the sheen, refine rim/shadow defaults and make updates selective. Coalesce geometry rebuilds.
4. Track explicit config, provide replacement semantics for React, repair imperative refs, preserve host styles, clean up animation work, and honor reduced motion/transparency.
5. Add a material lab with controlled backdrops, real material controls, a v7 comparison, diagnostics and repeatable lifecycle checks. Improve the landing hero and measurement/copy accuracy.
6. Run math regression tests, typecheck and all builds. Inspect desktop/mobile and light/dark renders. Verify displacement with zero-scale versus normal-scale pixel differences; verify the center stays still. Exercise reset, preset changes, vanilla teardown, reduced preferences and animation cancellation.
7. Record measured results and limitations in `GLASS_VALIDATION.md`. Leave local pages running for review.

## Boundaries

Implementation and local validation of steps 1–7 are complete. See `GLASS_VALIDATION.md` for measured results and remaining platform limits, and `GLASS_INTEGRATION.md` for consumer usage and migration guidance.

No npm publication or deployment is part of this implementation. No claimed Apple pixel parity, universal frame rate, battery improvement or GPU speedup without the corresponding device measurements. Two-tap RGB extrapolation, worker transport, exact continuous corners and unified metaball optics remain separate experiments: none should be promoted just because an approximation is cheaper.
