# Motion and controls

## Pick the primitive that owns the motion

| UI task | React | Vanilla, from `quick-liquid` |
| --- | --- | --- |
| Press feedback on a glass host | `LiquidGlass liquidPress` | `engine.enableLiquidPress()` |
| Tactile action or link, or ripple/sheen on existing markup | `LiquidGlassButton`, `useLiquidInteractive` | `LiquidInteractive` |
| Sliding selected pill | `LiquidSegmented` | `LiquidTabBar` |
| Stretching switch thumb | `LiquidToggle` | `LiquidSwitch` |
| Command palette, drop reveal, or shared-trigger morph | `useLiquidFlow` | `LiquidMorphModal` |
| Spring popover and optional hover/focus follower | Connect to existing React overlay behavior | `LiquidPopover` |
| Content transition on selection | `LiquidSwitcher` | `LiquidContentSwap` |
| Progress tied to a scroll container | Bind in a client effect | `LiquidScrollTrack` |
| Pointer drag, release, shape motion, or droplet merging | Bind in a client effect | `LiquidGesture`, `LiquidDrag`, `LiquidMorph`, `LiquidGroup` |

Keep native click, focus, keyboard, and state behavior in the app. Use a single transform writer per element. If combining the engine's press, gesture motion, and app positioning, assign each necessary transform to its own DOM layer. Verify reduced motion per interaction. The engine respects preferences by default and the shared animation scheduler can settle its springs immediately. App-authored CSS, keyframes, pointer behavior, and custom animation loops need their own treatment.

## React controls and their styling

- `LiquidGlassButton` renders a native button or an anchor when given `href`. It defaults to `interactive={true}`, `glass={false}`. Pass `glass` or a partial glass config to mount its decorative engine. Give it a positioned, sized host and align its CSS radius with the glass radius. Pass `interactive={false}` to disable its motion.
- `useLiquidInteractive<T>(config | false)` returns a ref for an existing element. With React 18 types, use the same `Ref<T>` annotation shown for `useLiquidGlass` in [Website integration](integration.md). Options include `pressScale`, `pressSquish`, `hoverLift`, `hoverScale`, `magnetic`, `ripple`, `sheen`, `spring`, and `hoverSpring`.
- `LiquidSegmented` is controlled through `options`, `value`, and `onChange`. Supply `ariaLabel`. Use the default button group for a setting. For a true tab interface, tie selections to panels and supply the app's tab keyboard behavior. `orientation="vertical"` also needs a vertical layout in CSS.
- `LiquidToggle` is controlled through `checked`, `onChange`, and `label`. It supplies a native button with switch semantics. The track and thumb need dimensions. The spring writes the thumb transform.
- `LiquidSwitcher` animates after `activeKey` changes. It accepts `direction={-1 | 0 | 1}` and `spring`. It briefly changes container opacity. For a nested live backdrop lens, test during the animation or animate only the foreground content so the filter can continue sampling.

The glass button and active pill apply their own optical overrides, including blur and dark appearance. A `material` key in `glass` leaves those overrides in place. For the preset's blur and bezel values, pass `glass={{ ...MATERIAL_PRESETS.thin, appearance: 'light' }}` with `MATERIAL_PRESETS` from `quick-liquid/core`, adjusting appearance for the real backdrop.

Example for a dark settings toolbar. The app can replace the CSS with its own tokens and layout.

```tsx
import { useState } from 'react';
import { LiquidGlassButton, LiquidSegmented, LiquidToggle } from 'quick-liquid/react';

const views = [
  { value: 'list', label: 'List' },
  { value: 'grid', label: 'Grid' },
] as const;

export function ViewControls() {
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [compact, setCompact] = useState(false);

  return (
    <div className="view-controls">
      <LiquidSegmented
        options={views}
        value={view}
        onChange={setView}
        ariaLabel="Layout"
        glass={{ quality: 'medium', elevation: 0 }}
      />
      <LiquidToggle checked={compact} onChange={setCompact} label="Compact layout" />
      <LiquidGlassButton className="view-controls__action" href="/settings" glass>
        Settings
      </LiquidGlassButton>
    </div>
  );
}
```

```css
.view-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  color: #f5f8ff;
}

.view-controls .liquid-segmented {
  position: relative;
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
}

.view-controls .liquid-segmented__item,
.view-controls .view-controls__action {
  position: relative;
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 0.8rem;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: inherit;
  font: inherit;
}

.view-controls .liquid-segmented__item[aria-pressed='true'] {
  font-weight: 700;
}

.view-controls .liquid-toggle {
  display: inline-grid;
  place-items: center;
  min-height: 44px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
}

.view-controls .liquid-toggle__track {
  position: relative;
  display: block;
  width: 52px;
  height: 30px;
  border-radius: 999px;
  background: #43516a;
}

.view-controls .liquid-toggle[data-checked='true'] .liquid-toggle__track {
  background: #246b61;
}

.view-controls .liquid-toggle__thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  background: #d7e8ff;
}

.view-controls .liquid-toggle__glass {
  width: 100%;
  height: 100%;
}

.view-controls :focus-visible {
  outline: 2px solid #c4e6ff;
  outline-offset: 2px;
}
```

## Dialog and popover transitions

`useLiquidFlow(config?)` returns `openFrom(trigger, target, show?)`, `closeTo(trigger, target, hide?)`, and `cancel()`. In vanilla, create `new LiquidMorphModal(config)` and destroy it on teardown. `mode: 'drop'` gives a fast vertical reveal independent of trigger position. `mode: 'flow'` measures the trigger and target and starts the dialog partway toward the trigger at a reduced scale. The `show` callback should make the target measurable synchronously. Preserve the target until the close callback. Use `contentSelector` to point at the actual foreground content if it should animate independently.

For a glass sheet, animate the dialog wrapper and place a separate `LiquidGlass` surface inside it so the motion controller and engine can manage their own styles. Keep page dimming on the overlay backdrop and verify a legible surface in the browser's top layer.

```tsx
import { useRef } from 'react';
import { useLiquidFlow } from 'quick-liquid/react';

export function FilterDialog() {
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const closing = useRef(false);
  const { openFrom, closeTo, cancel } = useLiquidFlow({
    mode: 'flow',
    contentSelector: '.filter-dialog__body',
  });

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="dialog"
        onClick={() => {
          const target = dialog.current;
          if (target && !target.open) {
            void openFrom(trigger.current, target, () => target.showModal());
          }
        }}
      >
        Open filters
      </button>
      <dialog
        ref={dialog}
        aria-label="Filters"
        onCancel={() => cancel()}
        onClose={() => {
          closing.current = false;
          trigger.current?.focus();
        }}
      >
        <div className="filter-dialog__body">
          <button
            type="button"
            onClick={() => {
              const target = dialog.current;
              if (!target?.open || closing.current) return;
              closing.current = true;
              void closeTo(trigger.current, target, () => target.close());
            }}
          >
            Close
          </button>
        </div>
      </dialog>
    </>
  );
}
```

`LiquidPopover` animates menu elements via `open(menuEl)` and `close(menuEl)`. Show the menu before opening, then await close before hiding. Use the existing popover implementation for positioning, focus, dismissal, and semantics. `LiquidPopover.bindList(listEl, itemSelector, spring?)` adds a follower for hovered or focused items and returns its own cleanup function. Dispose of that binding and the popover controller separately.

## Vanilla controllers and advanced motion

| API | Wiring |
| --- | --- |
| `new LiquidInteractive(element, config?)` | Attach to an existing action for press, ripple, sheen, or magnetism. Update with `updateConfig(partial)`. |
| `new LiquidTabBar(container, items, config?)` | Style and position the container and supply actual item elements. Call `select(index)` from app selection, `selectImmediate(index)` on initial alignment or remeasurement, and `updateItems(items, activeIndex?)` if the items change. Config supports `spring`, `orientation`, `glass`, `hoverFollower`, and `stretch`. |
| `new LiquidSwitch(track, thumb, initialChecked, config?)` | Size and position both nodes. Reflect application state with `setChecked(checked, immediate?)` and drive press feedback with `press(down)`. |
| `LiquidContentSwap.animateSwap(el, direction?, spring?)` | Call after replacing content on a stable wrapper. Keep the returned animation cleanup. |
| `new LiquidScrollTrack(source, bar, config?)` | Pass `window` or a scrolling element and a dedicated progress-bar element. Set `orientation` and call `refresh()` after changes to scroll geometry if needed. |
| `new LiquidGesture(element, config?)` | Subscribe via `onDragStart`, `onDrag`, `onDragEnd`, `onPress`, `onRelease`, and `onTap`. Tune drag/release springs and rubber-band limits on the intended pointer surface. |
| `LiquidButton`, `LiquidDrag` | Preset gesture wrappers. `LiquidDrag.setSnapTargets()` and `.onSnap()` are placeholders in v0.2.0. Implement application snapping with `LiquidGesture` callbacks if needed. |
| `LiquidTransition`, `LiquidLayoutAnimation` | Use `to()`, `set()`, `release()`, and `reset()` for properties. For FLIP, capture positions before the layout change and animate from them after it. |
| `LiquidMorph`, `LiquidMetaball`, `generateMergeBlob` | Low-level shapes. Use `morphTo({ x, y, width, height, borderRadius })` or `morphToElement(el)` on `LiquidMorph`. Prefer `LiquidGroup` for the shared glass surface. |

Call `destroy()` on owned controller instances at teardown. A pure `Spring` or `SpringVector` needs ticks from a loop or `AnimationScheduler.shared().schedule(callback)`, whose callback returns true while active. The presets are `default`, `snappy`, `bouncy`, `gentle`, `stiff`, `liquidMerge`, and `liquidSplit`. Cancel your own scheduled IDs on teardown. Keep the shared scheduler available for other consumers. Geometry helpers exported at the package root include `computeFlowRect`, `computeLiquidDropTransform`, `computeSwitchStretch`, and `computeBoundedJellyBox`.

## Merging droplets

`LiquidGroup` paints a shared SDF metaball surface inside the stage. Members provide their measured geometry and can remain native controls with transparent surfaces. Register members with `add()` and `remove()`. Call `updatePositions()` after drag/position changes or to refresh an optional origin-clean backdrop canvas. Tune `mergeDistance` and `blendRadius` with the rendered shapes. Increase the pixel step `resolution` or constrain the stage when the shared rendering is expensive. Use `onMerge` and `onSplit` for callbacks. Destroy the group and any separate drag controllers.

```ts
import { LiquidGesture, LiquidGroup } from 'quick-liquid';

export function mountDroplets(stage: HTMLElement, droplets: HTMLElement[]) {
  const group = new LiquidGroup(stage, { mergeDistance: 28, blendRadius: 32 });
  const gestures = droplets.map((drop) => {
    group.add(drop);
    return new LiquidGesture(drop, { scaleOnPress: false, wobbleOnPress: false })
      .onDrag(() => group.updatePositions())
      .onDragEnd(() => group.updatePositions());
  });

  return () => {
    gestures.forEach((gesture) => gesture.destroy());
    group.destroy();
  };
}
```

See the [animation toolkit](https://quickliquid.vercel.app/docs/#toolkit), [droplet lab](https://quickliquid.vercel.app/docs/#metaballs), [animation studio](https://quickliquid.vercel.app/playground/#animations), and [v0.2.0 public exports](https://github.com/amarnath3003/quickLiquid/blob/v0.2.0/packages/quick-liquid/src/index.ts).
