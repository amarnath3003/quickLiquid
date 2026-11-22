import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type Ref } from 'react';
import {
  LiquidGesture,
  LiquidPopover,
  SPRING_PRESETS,
  type SpringConfig,
  type SpringPreset,
} from 'quick-liquid';
import {
  LiquidGlass,
  LiquidGlassButton,
  LiquidSegmented,
  LiquidSwitcher,
  LiquidToggle,
  useLiquidFlow,
  type LiquidGlassRef,
} from 'quick-liquid/react';
import { CardGlass } from '../components/CardGlass';
import { CodeBlock } from '../components/CodeBlock';
import { GlassRange } from '../components/GlassControls';
import { LightField } from '../components/SiteShell';

const SPRING_NAMES = Object.keys(SPRING_PRESETS) as SpringPreset[];
const SPRING_OPTIONS = SPRING_NAMES.map(value => ({ value, label: value }));

const TAB_ITEMS = [
  { id: 'React', detail: '<LiquidGlass liquidPress animateIn />' },
  { id: 'Vanilla JS', detail: 'new LiquidInteractive(el, cfg)' },
  { id: 'Optics', detail: 'Snell LUT · RGB dispersion' },
  { id: 'Motion', detail: 'AnimationScheduler · 60fps' },
] as const;

type TabId = (typeof TAB_ITEMS)[number]['id'];
const TAB_OPTIONS = TAB_ITEMS.map(item => ({ value: item.id, label: item.id }));

const MENU_ITEMS = [
  'Clear refraction',
  'Chromatic prism',
  'Droplet bridge',
  'Spring bounce',
] as const;

interface StudioSettings {
  preset: SpringPreset | null;
  stiffness: number;
  damping: number;
  mass: number;
  pressSquish: number;
  hoverLift: number;
  ripple: boolean;
  refractivePill: boolean;
}

const DEFAULT_SETTINGS: StudioSettings = {
  preset: 'snappy',
  ...SPRING_PRESETS.snappy,
  pressSquish: 0.035,
  hoverLift: 2,
  ripple: true,
  refractivePill: true,
};

export function AnimationStudio() {
  const [settings, setSettings] = useState<StudioSettings>(DEFAULT_SETTINGS);

  // Flow modal state
  const flowTriggerRef = useRef<HTMLButtonElement>(null);
  const flowModalRef = useRef<HTMLDivElement>(null);
  const [flowOpen, setFlowOpen] = useState(false);

  // Button counter
  const [clicks, setClicks] = useState(0);

  // Tab switcher state
  const [tab, setTab] = useState<TabId>('React');
  const [tabDir, setTabDir] = useState<-1 | 1>(1);

  // Toggle switch state
  const [autoOptics, setAutoOptics] = useState(true);
  const [edgePrism, setEdgePrism] = useState(false);

  // Popover menu state
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuValue, setMenuValue] = useState<(typeof MENU_ITEMS)[number]>(MENU_ITEMS[0]);
  const menuWrapRef = useRef<HTMLDivElement>(null);
  const menuListRef = useRef<HTMLUListElement>(null);
  const popoverRef = useRef<LiquidPopover | null>(null);
  const menuClosingRef = useRef(false);

  // Elastic surface refs
  const elasticRef = useRef<LiquidGlassRef>(null);
  const elasticHostRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<LiquidGesture | null>(null);

  const springConfig = useMemo<Partial<SpringConfig>>(() => ({
    stiffness: settings.stiffness,
    damping: settings.damping,
    mass: settings.mass,
    restDisplacementThreshold: 0.5,
    restThreshold: 12,
  }), [settings.stiffness, settings.damping, settings.mass]);

  const flowSpringConfig = useMemo<Partial<SpringConfig>>(() => ({
    stiffness: Math.max(settings.stiffness, 620),
    damping: Math.max(settings.damping, 34),
    mass: Math.min(settings.mass, 0.9),
    restDisplacementThreshold: 0.004,
    restThreshold: 0.05,
  }), [settings.stiffness, settings.damping, settings.mass]);

  const interactiveCfg = useMemo(() => ({
    pressScale: Math.max(0.86, 1 - settings.pressSquish * 1.1),
    pressSquish: settings.pressSquish,
    hoverLift: settings.hoverLift,
    hoverScale: 1.016,
    ripple: settings.ripple,
    spring: {
      stiffness: settings.stiffness,
      damping: settings.damping,
      mass: settings.mass,
      restDisplacementThreshold: 0.002,
      restThreshold: 0.03,
    },
  }), [settings.pressSquish, settings.hoverLift, settings.ripple, settings.stiffness, settings.damping, settings.mass]);

  const { openFrom, closeTo } = useLiquidFlow({
    mode: 'drop',
    contentSelector: '.lab-flow-card__inner',
    openSpring: flowSpringConfig,
    sheen: true,
  });

  function choosePreset(preset: SpringPreset) {
    const p = SPRING_PRESETS[preset];
    setSettings(prev => ({
      ...prev,
      preset,
      stiffness: p.stiffness,
      damping: p.damping,
      mass: p.mass,
    }));
  }

  function openFlow() {
    const target = flowModalRef.current;
    if (!target || flowOpen) return;
    setFlowOpen(true);
    void openFrom(flowTriggerRef.current, target, () => {
      target.hidden = false;
    });
  }

  function closeFlow() {
    const target = flowModalRef.current;
    if (!target || !flowOpen) return;
    void closeTo(flowTriggerRef.current, target, () => {
      target.hidden = true;
      setFlowOpen(false);
    });
  }

  // Popover lifecycle
  useEffect(() => {
    popoverRef.current = new LiquidPopover({ origin: 'top left' });
    return () => {
      popoverRef.current?.destroy();
      popoverRef.current = null;
    };
  }, []);

  const closeMenu = useCallback(() => {
    if (!menuOpen || menuClosingRef.current) return;
    const el = menuListRef.current;
    if (!el || !popoverRef.current) {
      setMenuOpen(false);
      return;
    }
    menuClosingRef.current = true;
    void popoverRef.current.close(el).then(() => {
      menuClosingRef.current = false;
      setMenuOpen(false);
    });
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen || !menuListRef.current) return;
    popoverRef.current?.open(menuListRef.current);

    function onPointerDown(e: PointerEvent) {
      if (menuWrapRef.current && !menuWrapRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeMenu();
    }
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen, closeMenu]);

  function onMenuKeyDown(event: ReactKeyboardEvent<HTMLUListElement>) {
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]'));
    if (!items.length) return;
    const currentIdx = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      items[(currentIdx + 1) % items.length]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      items[(currentIdx - 1 + items.length) % items.length]?.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      items[0]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      items[items.length - 1]?.focus();
    } else if (event.key === 'Tab') {
      closeMenu();
    }
  }

  // Elastic draggable card gesture
  useEffect(() => {
    const host = elasticHostRef.current;
    if (!host) return;
    const gesture = new LiquidGesture(host, {
      pressScale: 0.96,
      pressSquish: settings.pressSquish,
      maxDragDistance: 72,
      rubberBandFactor: 0.25,
      flickMultiplier: 0.4,
      releaseSpring: springConfig,
    });
    gestureRef.current = gesture;
    return () => {
      gesture.destroy();
      gestureRef.current = null;
    };
  }, [springConfig, settings.pressSquish]);

  const code = `import { LiquidInteractive, LiquidTabBar, LiquidMorphModal } from 'quick-liquid';

const spring = { stiffness: ${settings.stiffness}, damping: ${settings.damping}, mass: ${settings.mass.toFixed(1)} };

new LiquidInteractive(buttonEl, {
  pressSquish: ${settings.pressSquish.toFixed(3)},
  hoverLift: ${settings.hoverLift.toFixed(1)},
  ripple: ${settings.ripple},
  spring,
});

new LiquidTabBar(tabsEl, items, { glass: ${settings.refractivePill}, spring });`;

  return (
    <section className="lab-anim-studio" id="animations" aria-labelledby="animations-title">
      <div className="lab-family__head">
        <h2 id="animations-title">Liquid animations</h2>
        <a className="glass-button" href="/docs/#toolkit">Animation toolkit</a>
      </div>

      <div className="lab-anim-workbench glass-pane">
        <CardGlass />

        <div className="lab-anim-showcase">
          <div className="lab-anim-grid">
            {/* 1. Glass Modal */}
            <article className="lab-anim-card glass-pane">
              <CardGlass />
              <div className="lab-anim-card__head">
                <h3>Glass modal</h3>
                <span>LiquidMorphModal</span>
              </div>
              <div className="lab-anim-stage lab-anim-stage--flow">
                <LightField className="lab-anim-beam" />
                <LiquidGlassButton
                  ref={flowTriggerRef as Ref<HTMLElement>}
                  glass={{ borderRadius: 999 }}
                  interactive={interactiveCfg}
                  className="glass-button lab-flow-trigger"
                  onClick={openFlow}
                >
                  Open glass modal
                </LiquidGlassButton>

                {flowOpen && (
                  <button
                    type="button"
                    aria-label="Close flow overlay"
                    className="lab-flow-scrim"
                    onClick={closeFlow}
                  />
                )}

                <div
                  ref={flowModalRef}
                  hidden
                  className="lab-flow-card glass-pane"
                  role="dialog"
                  aria-label="Flow preview modal"
                >
                  <LiquidGlass
                    className="lab-flow-card__glass"
                    config={{
                      appearance: 'dark',
                      quality: 'medium',
                      borderRadius: 20,
                      blur: 5,
                      refractionStrength: 24,
                      bezelWidth: 20,
                      thickness: 20,
                      chromaticAberration: 0.25,
                      tintOpacity: 0.14,
                      specularStrength: 0.45,
                      edgeHighlight: 0.9,
                      elevation: 1.2,
                    }}
                  >
                    <div className="lab-flow-card__inner">
                      <div className="lab-flow-card__top">
                        <strong>Glass Command</strong>
                        <LiquidGlassButton
                          interactive={interactiveCfg}
                          className="glass-button lab-flow-close"
                          onClick={closeFlow}
                        >
                          Close
                        </LiquidGlassButton>
                      </div>
                      <p>Instant surface-tension drop with a refractive sheen sweep.</p>
                    </div>
                  </LiquidGlass>
                </div>
              </div>
            </article>

            {/* 2. Liquid Buttons & Ripples */}
            <article className="lab-anim-card glass-pane">
              <CardGlass />
              <div className="lab-anim-card__head">
                <h3>Liquid buttons &amp; ripples</h3>
                <span>{clicks} {clicks === 1 ? 'click' : 'clicks'}</span>
              </div>
              <div className="lab-anim-stage lab-anim-stage--buttons">
                <LightField className="lab-anim-beam" />
                <div className="lab-anim-row">
                  <LiquidGlassButton
                    className="glass-button glass-button--bright"
                    interactive={interactiveCfg}
                    onClick={() => setClicks(c => c + 1)}
                  >
                    Primary
                  </LiquidGlassButton>
                  <LiquidGlassButton
                    className="glass-button"
                    glass={{ borderRadius: 12, refractionStrength: 18 }}
                    interactive={interactiveCfg}
                    onClick={() => setClicks(c => c + 1)}
                  >
                    Refractive
                  </LiquidGlassButton>
                  <LiquidGlassButton
                    className="glass-button lab-anim-orb"
                    glass={{ borderRadius: 999, refractionStrength: 20 }}
                    interactive={{ ...interactiveCfg, hoverScale: 1.06 }}
                    aria-label="Liquid pulse button"
                    onClick={() => setClicks(c => c + 1)}
                  >
                    ✦
                  </LiquidGlassButton>
                </div>
              </div>
            </article>

            {/* 3. Liquid Tabs & Content Flow */}
            <article className="lab-anim-card glass-pane">
              <CardGlass />
              <div className="lab-anim-card__head">
                <h3>Liquid tabs &amp; content swap</h3>
                <span>LiquidTabBar</span>
              </div>
              <div className="lab-anim-stage lab-anim-stage--stack">
                <LightField className="lab-anim-beam" />
                <LiquidSegmented
                  options={TAB_OPTIONS}
                  value={tab}
                  onChange={next => {
                    const nextIdx = TAB_ITEMS.findIndex(t => t.id === next);
                    const curIdx = TAB_ITEMS.findIndex(t => t.id === tab);
                    setTabDir(nextIdx >= curIdx ? 1 : -1);
                    setTab(next);
                  }}
                  glass={settings.refractivePill}
                  spring={springConfig}
                  ariaLabel="Framework demo tabs"
                />
                <LiquidSwitcher activeKey={tab} direction={tabDir} spring={springConfig} className="lab-anim-swap-wrap">
                  <div className="lab-anim-swap-pill">
                    <code>{TAB_ITEMS.find(t => t.id === tab)?.detail}</code>
                  </div>
                </LiquidSwitcher>
              </div>
            </article>

            {/* 4. Liquid Toggle Switches */}
            <article className="lab-anim-card glass-pane">
              <CardGlass />
              <div className="lab-anim-card__head">
                <h3>Droplet switches</h3>
                <span>LiquidSwitch</span>
              </div>
              <div className="lab-anim-stage lab-anim-stage--stack">
                <LightField className="lab-anim-beam" />
                <div className="lab-switch-list">
                  <div className="lab-switch-row">
                    <span>Auto optics</span>
                    <LiquidToggle
                      checked={autoOptics}
                      onChange={setAutoOptics}
                      label="Auto optics"
                      spring={springConfig}
                      maxStretch={Math.min(0.42, 0.16 + settings.pressSquish * 2.4)}
                    />
                  </div>
                  <div className="lab-switch-row">
                    <span>Chromatic rim</span>
                    <LiquidToggle
                      checked={edgePrism}
                      onChange={setEdgePrism}
                      label="Chromatic rim"
                      spring={springConfig}
                      maxStretch={Math.min(0.42, 0.16 + settings.pressSquish * 2.4)}
                    />
                  </div>
                </div>
              </div>
            </article>

            {/* 5. Liquid Menu / Popover */}
            <article className="lab-anim-card glass-pane">
              <CardGlass />
              <div className="lab-anim-card__head">
                <h3>Liquid popover menu</h3>
                <span>LiquidPopover</span>
              </div>
              <div className="lab-anim-stage lab-anim-stage--menu">
                <LightField className="lab-anim-beam" />
                <div className="lab-menu-anchor" ref={menuWrapRef}>
                  <LiquidGlassButton
                    className="glass-button"
                    glass={{ borderRadius: 10 }}
                    interactive={interactiveCfg}
                    aria-haspopup="listbox"
                    aria-expanded={menuOpen}
                    onClick={() => {
                      if (menuOpen) closeMenu();
                      else {
                        menuClosingRef.current = false;
                        setMenuOpen(true);
                      }
                    }}
                  >
                    <span>{menuValue}</span>
                    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4.2 6.2 8 10l3.8-3.8" />
                    </svg>
                  </LiquidGlassButton>

                  {menuOpen && (
                    <ul
                      ref={menuListRef}
                      className="lab-select__menu lab-anim-menu"
                      role="listbox"
                      aria-label="Glass effect options"
                      onKeyDown={onMenuKeyDown}
                    >
                      {MENU_ITEMS.map(item => (
                        <li key={item} role="presentation">
                          <button
                            type="button"
                            role="option"
                            aria-selected={item === menuValue}
                            className="lab-select__option"
                            onClick={() => {
                              setMenuValue(item);
                              closeMenu();
                            }}
                          >
                            <span className="lab-select__option-head">
                              <strong>{item}</strong>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </article>

            {/* 6. Elastic Surface */}
            <article className="lab-anim-card glass-pane">
              <CardGlass />
              <div className="lab-anim-card__head">
                <h3>Elastic surface</h3>
                <div className="lab-anim-card__btns">
                  <LiquidGlassButton
                    className="glass-button lab-mini-btn"
                    interactive={interactiveCfg}
                    onClick={() => elasticRef.current?.jiggle(1.3)}
                  >
                    Jiggle
                  </LiquidGlassButton>
                  <LiquidGlassButton
                    className="glass-button lab-mini-btn"
                    interactive={interactiveCfg}
                    onClick={() => elasticRef.current?.animateIn(0)}
                  >
                    Pop in
                  </LiquidGlassButton>
                </div>
              </div>
              <div className="lab-anim-stage lab-anim-stage--elastic">
                <LightField className="lab-anim-beam" />
                <div ref={elasticHostRef} className="lab-elastic-wrap">
                  <LiquidGlass
                    ref={elasticRef}
                    className="lab-elastic-card"
                    liquidPress={{ scale: 0.94, squish: settings.pressSquish }}
                    config={{
                      appearance: 'dark',
                      quality: 'medium',
                      borderRadius: 24,
                      blur: 2,
                      refractionStrength: 24,
                      bezelWidth: 24,
                      thickness: 22,
                      chromaticAberration: 0.28,
                      tintOpacity: 0.1,
                      specularStrength: 0.45,
                      edgeHighlight: 0.92,
                      cursorTracking: true,
                    }}
                  >
                    <div className="lab-elastic-card__body">
                      <strong>Drag or tap</strong>
                      <span>Elastic release</span>
                    </div>
                  </LiquidGlass>
                </div>
              </div>
            </article>
          </div>

          <div className="lab-export glass-pane">
            <CardGlass />
            <CodeBlock key={code} code={code} lang="ts" title="Animation configuration" />
          </div>
        </div>

        <aside className="lab-controls glass-pane" aria-label="Animation settings">
          <CardGlass />
          <div className="lab-control-title">
            <h3>Animation settings</h3>
            <LiquidGlassButton
              className="glass-button"
              interactive={interactiveCfg}
              onClick={() => setSettings(DEFAULT_SETTINGS)}
            >
              Reset
            </LiquidGlassButton>
          </div>

          <div className="lab-control-row lab-control-row--materials">
            <span>Spring preset</span>
            <LiquidSegmented
              options={SPRING_OPTIONS}
              value={settings.preset ?? 'snappy'}
              onChange={choosePreset}
              glass={settings.refractivePill}
              spring={springConfig}
              ariaLabel="Spring preset"
              className={`lab-spring-presets${settings.preset === null ? ' lab-spring-presets--custom' : ''}`}
            />
          </div>

          <div className="lab-sliders">
            <GlassRange
              label="Stiffness"
              min={80}
              max={700}
              step={10}
              value={settings.stiffness}
              valueText={String(settings.stiffness)}
              onChange={v => setSettings(s => ({ ...s, preset: null, stiffness: v }))}
            />
            <GlassRange
              label="Damping"
              min={8}
              max={45}
              step={1}
              value={settings.damping}
              valueText={String(settings.damping)}
              onChange={v => setSettings(s => ({ ...s, preset: null, damping: v }))}
            />
            <GlassRange
              label="Mass"
              min={0.5}
              max={2.5}
              step={0.1}
              value={settings.mass}
              valueText={settings.mass.toFixed(1)}
              onChange={v => setSettings(s => ({ ...s, preset: null, mass: v }))}
            />
            <GlassRange
              label="Press squish"
              min={0}
              max={0.12}
              step={0.005}
              value={settings.pressSquish}
              valueText={settings.pressSquish.toFixed(3)}
              onChange={v => setSettings(s => ({ ...s, pressSquish: v }))}
            />
            <GlassRange
              label="Hover lift"
              min={0}
              max={10}
              step={0.5}
              value={settings.hoverLift}
              valueText={`${settings.hoverLift.toFixed(1)} px`}
              onChange={v => setSettings(s => ({ ...s, hoverLift: v }))}
            />
          </div>

          <div className="lab-anim-switches">
            <div className="lab-control-row">
              <span>Water ripple</span>
              <LiquidToggle
                checked={settings.ripple}
                onChange={ripple => setSettings(s => ({ ...s, ripple }))}
                label="Water ripple"
                spring={springConfig}
              />
            </div>
            <div className="lab-control-row">
              <span>Refractive pill</span>
              <LiquidToggle
                checked={settings.refractivePill}
                onChange={refractivePill => setSettings(s => ({ ...s, refractivePill }))}
                label="Refractive pill"
                spring={springConfig}
              />
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
