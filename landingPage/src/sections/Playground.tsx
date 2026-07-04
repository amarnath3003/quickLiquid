import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LiquidGlass } from 'quick-liquid/react';
import type { LiquidGlassRef } from 'quick-liquid/react';
import { DEFAULT_CONFIG, MATERIAL_PRESETS, LiquidGesture } from 'quick-liquid';
import type { LiquidGlassConfig } from 'quick-liquid';
import { useLiquidTabBar } from '../components/useLiquidTabBar';
import { Droplet } from '../components/Droplet';
import {
  PROPERTIES,
  PROPERTIES_AZ,
  GROUP_ORDER,
  CURATED_PRESETS,
  rgbStringToHex,
  hexToRgbString,
} from '../data/properties';
import type { PropertyDef } from '../data/properties';
import { CodeBlock } from '../components/CodeBlock';

type SceneId = 'aurora' | 'sunset' | 'mesh' | 'night';

const SCENES: { id: SceneId; label: string; dark: boolean }[] = [
  { id: 'aurora', label: 'aurora', dark: false },
  { id: 'sunset', label: 'sunset', dark: false },
  { id: 'mesh', label: 'mesh', dark: false },
  { id: 'night', label: 'night', dark: true },
];

const MATERIALS = ['none', 'clear', 'thin', 'regular', 'thick', 'ultra', 'adaptive'] as const;

/* The handful of knobs that actually change the vibe — friendly names, no jargon.
   Everything else lives in the collapsed “all properties” drawer below. */
const ESSENTIALS: { key: keyof LiquidGlassConfig; label: string; hint: string }[] = [
  { key: 'blur', label: 'Frost', hint: 'how milky the backdrop turns' },
  { key: 'refractionStrength', label: 'Bend', hint: 'how hard the edges refract' },
  { key: 'saturation', label: 'Color', hint: 'punch up colors through the glass' },
  { key: 'tintOpacity', label: 'Tint', hint: 'strength of the material tint' },
  { key: 'chromaticAberration', label: 'Prism', hint: 'rainbow split at the rim' },
  { key: 'borderRadius', label: 'Roundness', hint: 'corner radius of the panel' },
];

interface Metrics {
  avgFrameTime: number;
  lastFrameTime: number;
  frameCount: number;
  quality: string;
  mapGenMs?: number;
  mapPixelsComputed?: number;
}

function fmtValue(v: unknown): string {
  return typeof v === 'string' ? `'${v}'` : String(v);
}

function buildConfigLines(material: string, overrides: Partial<LiquidGlassConfig>): string[] {
  const entries: [string, unknown][] = [];
  if (material !== 'none') entries.push(['material', material]);
  for (const [k, v] of Object.entries(overrides)) entries.push([k, v]);
  return entries.map(([k, v]) => `  ${k}: ${fmtValue(v)},`);
}

export function Playground() {
  const [scene, setScene] = useState<SceneId>('aurora');
  const [material, setMaterial] = useState<string>('none');
  const [overrides, setOverrides] = useState<Partial<LiquidGlassConfig>>({});
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [flashKey, setFlashKey] = useState<string | null>(null);
  const [exportTab, setExportTab] = useState<'react' | 'vanilla'>('react');

  const lensRef = useRef<LiquidGlassRef>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const advancedRef = useRef<HTMLDetailsElement>(null);
  const flashTimer = useRef<number>(0);

  /* Scene switcher is a real LiquidTabBar — the selection flows between tabs */
  const { containerRef: sceneBarRef, select: selectScene } = useLiquidTabBar(0);

  const pickScene = useCallback(
    (index: number) => {
      setScene(SCENES[index].id);
      selectScene(index);
    },
    [selectScene],
  );

  const sceneDark = SCENES.find(s => s.id === scene)!.dark;

  /* Effective values shown on the controls = defaults ⊕ material preset ⊕ user overrides */
  const effective = useMemo(() => {
    const presetLayer = material !== 'none' ? (MATERIAL_PRESETS[material] ?? {}) : {};
    return {
      ...DEFAULT_CONFIG,
      ...presetLayer,
      appearance: sceneDark ? 'dark' : 'light',
      ...overrides,
    } as LiquidGlassConfig & Record<string, unknown>;
  }, [material, overrides, sceneDark]);

  /* What actually goes into the engine — explicit keys win over the material preset */
  const engineConfig = useMemo<Partial<LiquidGlassConfig>>(
    () => ({
      ...(material !== 'none' ? { material: material as LiquidGlassConfig['material'] } : {}),
      appearance: sceneDark ? 'dark' : 'light',
      ...overrides,
    }),
    [material, overrides, sceneDark],
  );

  /* Any manual tweak means the config no longer matches the picked preset. */
  const setValue = useCallback((key: string, value: unknown) => {
    setActivePreset(null);
    setOverrides(prev => ({ ...prev, [key]: value }) as Partial<LiquidGlassConfig>);
  }, []);

  const resetKey = useCallback((key: string) => {
    setActivePreset(null);
    setOverrides(prev => {
      const next = { ...prev } as Record<string, unknown>;
      delete next[key];
      return next as Partial<LiquidGlassConfig>;
    });
  }, []);

  const resetAll = useCallback(() => {
    setActivePreset(null);
    setOverrides({});
    setMaterial('none');
  }, []);

  const pickMaterial = useCallback((m: string) => {
    setActivePreset(null);
    setMaterial(m);
    setOverrides({}); // presets read cleanly; tweak after picking
  }, []);

  const applyCurated = useCallback((preset: { name: string; config: Partial<LiquidGlassConfig> }) => {
    setActivePreset(preset.name);
    setMaterial('none');
    setOverrides({ ...preset.config });
  }, []);

  const jumpTo = useCallback((key: string) => {
    if (advancedRef.current) advancedRef.current.open = true;
    // wait a frame so the freshly-opened drawer has laid out before scrolling
    requestAnimationFrame(() => {
      controlsRef.current
        ?.querySelector(`#ctl-${key}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    setFlashKey(key);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlashKey(null), 1400);
  }, []);

  const handlePerf = useCallback((m: Metrics) => setMetrics(m), []);

  /* Draggable lens with spring-home physics — dogfoods LiquidGesture */
  useEffect(() => {
    const host = stageRef.current?.querySelector<HTMLElement>('.pg-lens');
    if (!host) return;
    const gesture = new LiquidGesture(host, {
      pressScale: 1.02,
      pressSquish: 0.01,
      wobbleOnPress: false,
      releaseSpring: 'bouncy',
    });
    return () => gesture.destroy();
  }, []);

  const replayEntrance = useCallback(() => {
    const api = lensRef.current;
    if (!api) return;
    api.animateOut().then(() => api.animateIn(120));
  }, []);

  const fps = metrics && metrics.avgFrameTime > 0 ? Math.min(120, 1000 / metrics.avgFrameTime) : null;
  const isTouched = material !== 'none' || Object.keys(overrides).length > 0;

  const configLines = buildConfigLines(material, overrides);
  const reactExport = `import { LiquidGlass } from 'quick-liquid/react';

<LiquidGlass
  config={{
${configLines.length ? configLines.map(l => '  ' + l).join('\n') : '    // engine defaults — move a slider!'}
  }}
>
  {children}
</LiquidGlass>`;
  const vanillaExport = `import { LiquidGlassEngine } from 'quick-liquid';

const engine = new LiquidGlassEngine(element, {
${configLines.length ? configLines.join('\n') : '  // engine defaults — move a slider!'}
});`;

  /* ── essential slider (friendly, no API jargon) ────────────────── */

  const renderEasy = (item: (typeof ESSENTIALS)[number]) => {
    const key = item.key as string;
    const def = PROPERTIES.find(p => p.key === item.key);
    if (!def || def.control.kind !== 'slider') return null;
    const spec = def.control;
    const raw = effective[key];
    const num = typeof raw === 'number' ? raw : 0;
    const overridden = key in overrides;
    const pct = ((num - spec.min) / (spec.max - spec.min)) * 100;

    return (
      <div className={`easy${flashKey === key ? ' ctl-flash' : ''}`} key={key} id={`ctl-easy-${key}`}>
        <div className="easy-head">
          <span className="easy-label">{item.label}</span>
          <span className="easy-value">
            {num.toFixed(spec.precision ?? 0)}
            {spec.unit ?? ''}
            {overridden && (
              <button type="button" className="ctl-reset" onClick={() => resetKey(key)} title="Reset">
                ↺
              </button>
            )}
          </span>
        </div>
        <input
          type="range"
          min={spec.min}
          max={spec.max}
          step={spec.step}
          value={num}
          onChange={e => setValue(key, parseFloat(e.target.value))}
          aria-label={item.label}
          style={{ ['--pct' as string]: `${pct}%` }}
        />
        <span className="easy-hint">{item.hint}</span>
      </div>
    );
  };

  /* ── full control renderer (advanced drawer) ───────────────────── */

  const renderControl = (def: PropertyDef) => {
    const key = def.key as string;
    const overridden = key === 'material' ? material !== 'none' : key in overrides;

    let input: React.ReactNode;
    let valueLabel = '';

    if (key === 'material') {
      valueLabel = material;
      input = (
        <div className="ctl-options">
          {MATERIALS.map(m => (
            <button
              key={m}
              type="button"
              className={`opt-chip${material === m ? ' is-active' : ''}`}
              onClick={() => pickMaterial(m)}
            >
              {m}
            </button>
          ))}
        </div>
      );
    } else if (def.control.kind === 'slider') {
      const spec = def.control;
      const fallback = def.optional ? (sceneDark ? 0.1 : 0.8) : 0;
      const raw = effective[key];
      const num = typeof raw === 'number' ? raw : fallback;
      const isAuto = def.optional && !(key in overrides);
      valueLabel = isAuto
        ? 'auto'
        : `${num.toFixed(spec.precision ?? 0)}${spec.unit ?? ''}`;
      input = (
        <input
          type="range"
          min={spec.min}
          max={spec.max}
          step={spec.step}
          value={num}
          onChange={e => setValue(key, parseFloat(e.target.value))}
          aria-label={def.label}
        />
      );
    } else if (def.control.kind === 'toggle') {
      const on = Boolean(effective[key]);
      valueLabel = on ? 'on' : 'off';
      input = (
        <button
          type="button"
          role="switch"
          aria-checked={on}
          className={`ctl-switch${on ? ' is-on' : ''}`}
          onClick={() => setValue(key, !on)}
        >
          <i />
        </button>
      );
    } else if (def.control.kind === 'select') {
      const current = String(effective[key]);
      valueLabel = current;
      input = (
        <div className="ctl-options">
          {def.control.options.map(opt => (
            <button
              key={opt}
              type="button"
              className={`opt-chip${current === opt ? ' is-active' : ''}`}
              onClick={() => setValue(key, opt)}
            >
              {opt}
            </button>
          ))}
        </div>
      );
    } else {
      // color
      const rgb = typeof effective[key] === 'string' ? (effective[key] as string) : '255, 255, 255';
      valueLabel = `rgb(${rgb})`;
      input = (
        <div className="ctl-color">
          <input
            type="color"
            value={rgbStringToHex(rgb)}
            onChange={e => setValue(key, hexToRgbString(e.target.value))}
            aria-label={def.label}
          />
          <code>{rgb}</code>
        </div>
      );
    }

    return (
      <div
        key={key}
        id={`ctl-${key}`}
        className={`ctl${flashKey === key ? ' ctl-flash' : ''}`}
        title={def.description}
      >
        <div className="ctl-head">
          <span className="ctl-label">
            {def.label} <code>{key}</code>
          </span>
          <span className="ctl-value">
            {valueLabel}
            {overridden && key !== 'material' && (
              <button
                type="button"
                className="ctl-reset"
                onClick={() => resetKey(key)}
                title="Reset to default"
              >
                ↺
              </button>
            )}
          </span>
        </div>
        {input}
      </div>
    );
  };

  /* ── layout ────────────────────────────────────────────────────── */

  return (
    <section className="section section--wide" id="playground">
      <div className="section-head">
        <span className="section-kicker">the playground</span>
        <h2 className="display">
          Play with the <em className="ink">glass.</em>
        </h2>
        <p>
          Pick a look, nudge a few sliders, grab the code. Every one of the {PROPERTIES.length}{' '}
          properties is still here — tucked into “all properties” for when you want to go deep.
        </p>
      </div>

      <div className="pg">
        <div className="pg-left">
          <div className="pg-scenes">
            <div className="scene-tabs" role="tablist" aria-label="Backdrop scene" ref={sceneBarRef}>
              {SCENES.map((s, i) => (
                <button
                  key={s.id}
                  role="tab"
                  aria-selected={scene === s.id}
                  className={`lt-item${scene === s.id ? ' is-active' : ''}`}
                  onClick={() => pickScene(i)}
                  type="button"
                >
                  {s.label}
                </button>
              ))}
            </div>
            <span className="pg-scene-note">
              drag the lens ·{' '}
              {fps ? (
                <>
                  <b>{fps.toFixed(0)}</b> fps
                </>
              ) : (
                'measuring…'
              )}
            </span>
          </div>

          <div className={`pg-stage scene-${scene}`} ref={stageRef}>
            <div className="pg-scenery" aria-hidden>
              <i className="pg-orb o1" />
              <i className="pg-orb o2" />
              <i className="pg-orb o3" />
              <i className="pg-bar b1" />
              <i className="pg-bar b2" />
              <span className="pg-word">liquid</span>
              <span className="pg-word pg-word--two">glass</span>
            </div>

            <LiquidGlass
              ref={lensRef}
              className="pg-lens"
              animateIn={150}
              config={engineConfig}
              onPerformanceUpdate={handlePerf}
            >
              <div className="pg-lens__body">
                <div className="pg-lens__row">
                  <span className="pg-lens__icon" aria-hidden>
                    <Droplet size={34} poke={false} />
                  </span>
                  <div>
                    <b>the test lens</b>
                    <small>drag me over the scene</small>
                  </div>
                </div>
                <div className="pg-lens__controls" aria-hidden>
                  <span className="pill" />
                  <span className="pill pill--short" />
                </div>
              </div>
            </LiquidGlass>

            <div className="pg-stage-actions">
              <button className="stage-btn" onClick={() => lensRef.current?.jiggle(1.4)} type="button" title="Jiggle">
                Jiggle
              </button>
              <button className="stage-btn" onClick={replayEntrance} type="button" title="Replay entrance">
                Replay
              </button>
              <button
                className={`stage-btn stage-btn--reset${isTouched ? ' is-live' : ''}`}
                onClick={resetAll}
                type="button"
                title="Reset everything"
              >
                Reset
              </button>
            </div>
          </div>

          <div className="pg-export">
            <div className="pg-export-head">
              <div className="tab-row" role="tablist" aria-label="Export format">
                <button
                  role="tab"
                  aria-selected={exportTab === 'react'}
                  className={`tab-chip${exportTab === 'react' ? ' is-active' : ''}`}
                  onClick={() => setExportTab('react')}
                  type="button"
                >
                  ⚛️ React
                </button>
                <button
                  role="tab"
                  aria-selected={exportTab === 'vanilla'}
                  className={`tab-chip${exportTab === 'vanilla' ? ' is-active' : ''}`}
                  onClick={() => setExportTab('vanilla')}
                  type="button"
                >
                  ⚡ Vanilla
                </button>
              </div>
              <span className="pg-export-note">updates as you tweak →</span>
            </div>
            {exportTab === 'react' ? (
              <CodeBlock code={reactExport} lang="tsx" title="your config — live" />
            ) : (
              <CodeBlock code={vanillaExport} lang="ts" title="your config — live" />
            )}
          </div>
        </div>

        <aside className="pg-controls" ref={controlsRef}>
          <div className="pg-panel pg-step">
            <h3>
              <span className="pg-step-num">1</span>
              Pick a look
            </h3>
            <div className="preset-grid">
              {CURATED_PRESETS.map(p => (
                <button
                  key={p.name}
                  type="button"
                  className={`preset-card${activePreset === p.name ? ' is-active' : ''}`}
                  onClick={() => applyCurated(p)}
                >
                  <b>{p.name}</b>
                  <span>{p.note}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="pg-panel pg-step">
            <h3>
              <span className="pg-step-num">2</span>
              Fine-tune the feel
            </h3>
            <div className="easy-grid">{ESSENTIALS.map(renderEasy)}</div>
          </div>

          <details className="pg-advanced" ref={advancedRef}>
            <summary>
              <span className="pg-adv-title">All {PROPERTIES.length} properties</span>
              <span className="pg-adv-sub">material, lighting, dispersion, texture…</span>
              <span className="pg-adv-chevron" aria-hidden>
                ⌄
              </span>
            </summary>

            <div className="pg-advanced-body">
              <div className="az-index">
                {PROPERTIES_AZ.map(p => (
                  <button key={p.key} type="button" className="az-chip" onClick={() => jumpTo(p.key as string)}>
                    {p.key}
                  </button>
                ))}
              </div>

              {GROUP_ORDER.map(group => (
                <div className="pg-adv-group" key={group}>
                  <h4>{group}</h4>
                  {PROPERTIES.filter(p => p.group === group).map(renderControl)}
                </div>
              ))}
            </div>
          </details>
        </aside>
      </div>
    </section>
  );
}
