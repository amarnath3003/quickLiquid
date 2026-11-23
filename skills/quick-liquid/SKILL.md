---
name: quick-liquid
description: Design, integrate, tune, or debug QuickLiquid (the quick-liquid npm package) on existing or new websites. Use for its React glass components, vanilla DOM engine, refractive materials, magnifiers, spring interactions, and droplet merging.
---

# QuickLiquid

QuickLiquid provides SVG displacement optics over a live page backdrop or supplied scene, with frost, tint, and rim lighting. Its motion toolkit adds press, stretch, morph, and merge effects to application-owned UI.

## Workflow

1. Inspect the app's framework, package manager, existing `quick-liquid` version, page backgrounds, and UI primitives. Use the installed version's public declarations as the API contract. The bundled references were checked against **v0.2.0**. Preserve the app's lockfile conventions and use its package manager to add `quick-liquid` if needed.
2. Pick the entry point and the effect. Use `quick-liquid/react` for React components and hooks, `quick-liquid/core` for DOM optics alone, and `quick-liquid` for the engine plus motion controllers. Use the host app to own state, navigation, semantics, and layout. Mount DOM engines and controllers only after the element exists in the browser, and dispose of imperative instances when the owning component or route goes away.
3. Choose where the material helps the design. Use clear optics over a backdrop with recognizable detail, light frost on compact controls, and more frost or opacity under longer text. Keep content above the effect. Tune a material preset, appearance, and radius first, then adjust optical strength, rim light, and motion. Preserve focus indicators and legibility in the fallback.
4. Exercise the actual integration. Check the app build, keyboard and pointer interaction, contrast over representative backgrounds, and small-screen layout. For optics work, compare Chromium's SVG rendering with CSS mode on a backdrop with visible detail. Verify direct-scene filtering in the other target browsers. Check reduced motion and transparency where relevant. Use metrics to diagnose repeated or large lenses.

## Choose a reference

| Task | Read |
| --- | --- |
| Install, mount, style, or clean up a React or vanilla integration | [Website integration](references/integration.md) |
| Choose materials, configure a lens, design controls, or tune quality and performance | [Design and optics](references/design-and-optics.md) |
| Add gestures, active pills, toggles, dialogs, popovers, springs, or metaball merging | [Motion and controls](references/motion-and-controls.md) |
| Diagnose missing refraction, clipped overlays, browser differences, or slow rendering | [Troubleshooting](references/troubleshooting.md) |

Use the [QuickLiquid docs](https://quickliquid.vercel.app/docs/) for live API examples and the [playground](https://quickliquid.vercel.app/playground/) to compare materials, test backdrops, and copy a starting config. The [v0.2.0 package source](https://github.com/amarnath3003/quickLiquid/tree/v0.2.0/packages/quick-liquid) documents implementation details. When live examples and the installed version differ, follow the installed exports and runtime behavior.
