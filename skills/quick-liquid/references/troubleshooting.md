# Troubleshooting

## Glass is visible but the backdrop stays straight

1. Confirm the host is mounted in the browser, has measurable width and height (at least 8 px each for SVG), and sits above scene detail. Place an obvious line or piece of type across the rim and wait for the first asynchronous map to finish.
2. Inspect the active config. For a diagnostic use `material: 'clear'`, `blur: 0`, `refractionStrength: 28`, `ior: 1.5`, and `refractionMode: 'auto'`. Verify reduced transparency is off during this check. At normal magnification the center is intentionally clear. Compare with `refractionMode: 'css'` under the same conditions.
3. Check browser support visually. Chromium is the target for live page `backdrop-filter: url(...)`. Safari and Firefox can use the frost/tint/rim treatment. A computed `url(...)` or a positive feature probe alone cannot establish that pixels bend. If needed, explicitly select CSS fallback for the affected surface, or try a lens-aligned `opticalSource` when the app owns the scene. Compare the supplied scene against forced CSS mode too.
4. Inspect the host and ancestors between the lens and its intended backdrop. Remove or relocate `isolation: isolate`, `filter`, `opacity < 1`, and masks that trap or obscure the background. In particular, an ancestor fade can limit sampling while it runs. Move decorative fade or masking to foreground content or an independent visual layer. Keep the engine's internal `.ql-lens` stacking and filter styles intact. Its implementation may replace the node after a filter change.
5. If the SVG filter is active without visible distortion, inspect the Console and Network panels for blocked displacement maps. The engine creates a Canvas 2D PNG blob and references it from `feImage`. Use the app's approved policy for generated assets or select CSS mode under a policy that blocks those maps. Avoid loosening security headers as a default fix.

## Other symptoms

| Symptom | Check and remedy |
| --- | --- |
| White haze or low contrast | Set `appearance` for the actual backdrop and pair it with an appropriate foreground color. Tune `tintOpacity` and `blur` under dark and light parts of the scene, then consider a heavier material or an opaque base. Tint takes comma-separated RGB. |
| Rainbow fringes vanished | Check `chromaticAberration`, lens mode, blur and quality. `low` uses one displacement tap. Temporarily lower frost or compare `dispersionMode: 'exact'` on a higher tier. |
| Rounded corners do not align | Set `config.borderRadius` to match the intended footprint and give the host a measured size. Keep internal layers and the host on the same radius. |
| Child layout changed or popup is clipped | The engine inserts layers and provides a foreground wrapper. Put direct-child layouts on the foreground container. The host uses `overflow: hidden`. Put escaping UI in a portal, native dialog, or the app's overlay system. |
| Glass button seems plain or toggle thumb is absent | `LiquidGlassButton` defaults to motion with `glass={false}`. The optional glass surface needs a sized, positioned button. The toggle and segmented control need host-app CSS. See [Motion and controls](motion-and-controls.md). |
| Touch drag fights page scrolling | Keep `touch-action` changes on the drag surface. Preserve scrolling on the rest of the page and provide keyboard or native actions for essential behavior. |
| A config override persists | `updateConfig` patches the explicit override set. Clear an override with `undefined` or use `setConfig` to replace the declaration. Verify with `getConfig()`. |
| Animations fight or the surface jumps | Use one transform writer per element. Move app transforms, gesture transforms, and entrance/exit effects onto suitable separate elements. |
| Duplicate layers or listeners after navigation | Pair each imperative mount with `destroy()` or its returned disposer. In React, use the component or hook lifecycle unless there is a concrete reason to construct an engine manually. |
| Panel animates but cannot be dismissed reliably | Use the app's dialog/popover behavior for Escape, focus management, dismissal, and return focus. The liquid controllers handle the visual transition. Cancel interrupted motion and avoid unmounting before a desired exit completes. |

## Verify and profile

- In Chromium, compare actual edge displacement against forced CSS mode. Inspect Firefox and WebKit/Safari when available. Verify the fallback's legibility even if the preferred browser has full refraction. Browser emulation is useful for preferences but cannot substitute for testing a different engine.
- Try keyboard focus and activation, touch or a small viewport, and changing theme or accessibility preferences. Reduced transparency should yield an opaque surface. Motion should settle immediately or remain unobtrusive under reduced motion.
- Use `glass.getPerformanceMetrics()` or `LiquidGlassRef.getMetrics()` for `mapGenMs`, `mapEncodeMs`, `mapPixelsComputed`, `displacementTaps`, `filterBuilds`, and `mapError`. The frame metrics time engine-side work and do not measure full page paint or GPU cost. `LiquidGlassEngine.collectMetrics()` reports `engineCount`, `uniqueMaps`, `cacheHits`, and per-engine entries. Compare before and after mounting repeated surfaces and again after teardown. Measure paint, compositor, and scrolling cost with the browser's profiler.

See [browser diagnostics](https://quickliquid.vercel.app/docs/#browser) and the [v0.2.0 engine source](https://github.com/amarnath3003/quickLiquid/blob/v0.2.0/packages/quick-liquid/src/core/engine.ts).
