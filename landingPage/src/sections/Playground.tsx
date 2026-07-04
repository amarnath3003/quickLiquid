import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LiquidGlass } from 'quick-liquid/react';
import type { LiquidGlassRef } from 'quick-liquid/react';
import { DEFAULT_CONFIG, MATERIAL_PRESETS, LiquidGesture } from 'quick-liquid';
import type { LiquidGlassConfig } from 'quick-liquid';
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
  { id: 'aurora', label: '🫧 Aurora', dark: false },
  { id: 'sunset', label: '🌇 Sunset', dark: false },
  { id: 'mesh', label: '📐 Mesh', dark: false },
  { id: 'night', label: '🌙 Night', dark: true },
];

const MATERIALS = ['none', 'clear', 'thin', 'regular', 'thick', 'ultra', 'adaptive'] as const;

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
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [flashKey, setFlashKey] = useState<string | null>(null);
  const [exportTab, setExportTab] = useState<'react' | 'vanilla'>('react');

  const lensRef = useRef<LiquidGlassRef>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const flashTimer = useRef<number>(0);

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

  const setValue = useCallback((key: string, value: unknown) => {
    setOverrides(prev => ({ ...prev, [key]: value }) as Partial<LiquidGlassConfig>);
  }, []);

  const resetKey = useCallback((key: string) => {
    setOverrides(prev => {
      const next = { ...prev } as Record<string, unknown>;
      delete next[key];
      return next as Partial<LiquidGlassConfig>;
    });
  }, []);

  const resetAll = useCallback(() => {
    setOverrides({});
    setMaterial('none');
  }, []);

  const pickMaterial = useCallback((m: string) => {
    setMaterial(m);
    setOverrides({}); // presets read cleanly; tweak after picking
  }, []);

  const applyCurated = useCallback((config: Partial<LiquidGlassConfig>) => {
    setMaterial('none');
    setOverrides({ ...config });
  }, []);

  const jumpTo = useCallback((key: string) => {
    controlsRef.current
      ?.querySelector(`#ctl-${key}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

  /* ── control renderers ─────────────────────────────────────── */

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

  /* ── layout ────────────────────────────────────────────────── */

  return (
    <section className="section section--wide" id="playground">
      <div className="section-head">
        <span className="section-kicker">Playground</span>
        <h2>
          Every glass property, <span className="grad-text">A to Z.</span>
        </h2>
        <p>
          All {PROPERTIES.length} public config options are live below — drag the lens around, break
          the physics, then copy the exact config into your app.
        </p>
      </div>

      <div className="pg">
        <div className="pg-left">
          <div className="pg-scenes" role="tablist" aria-label="Backdrop scene">
            {SCENES.map(s => (
              <button
                key={s.id}
                role="tab"
                aria-selected={scene === s.id}
                className={`tab-chip${scene === s.id ? ' is-active' : ''}`}
                onClick={() => setScene(s.id)}
                type="button"
              >
                {s.label}
              </button>
            ))}
            <span className="pg-scene-note">appearance: {sceneDark ? `'dark'` : `'light'`}</span>
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
                    💧
                  </span>
                  <div>
                    <b>Test Lens</b>
                    <small>drag me over the scene</small>
                  </div>
                </div>
                <div className="pg-lens__controls" aria-hidden>
                  <span className="pill" />
                  <span className="pill pill--short" />
                </div>
              </div>
            </LiquidGlass>
          </div>

          <div className="pg-actions">
            <button className="btn btn--small" onClick={() => lensRef.current?.jiggle(1.4)} type="button">
              Jiggle
            </button>
            <button className="btn btn--small" onClick={replayEntrance} type="button">
              Replay entrance
            </button>
            <button className="btn btn--small btn--danger" onClick={resetAll} type="button">
              Reset all
            </button>
            <div className="pg-hud" aria-live="off">
              {fps ? (
                <>
                  <span>
                    <b>{fps.toFixed(0)}</b> fps
                  </span>
                  <span>
                    <b>{metrics!.avgFrameTime.toFixed(2)}</b> ms/frame
                  </span>
                  {typeof metrics!.mapGenMs === 'number' && (
                    <span>
                      map <b>{metrics!.mapGenMs.toFixed(1)}</b> ms
                    </span>
                  )}
                  <span>
                    quality <b>{metrics!.quality}</b>
                  </span>
                </>
              ) : (
                <span>measuring…</span>
              )}
            </div>
          </div>

          <div className="pg-export">
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
            {exportTab === 'react' ? (
              <CodeBlock code={reactExport} lang="tsx" title="your config — live" />
            ) : (
              <CodeBlock code={vanillaExport} lang="ts" title="your config — live" />
            )}
          </div>
        </div>

        <aside className="pg-controls" ref={controlsRef}>
          <div className="pg-panel">
            <h3>Curated presets</h3>
            <div className="preset-grid">
              {CURATED_PRESETS.map(p => (
                <button key={p.name} type="button" className="preset-card" onClick={() => applyCurated(p.config)}>
                  <b>{p.name}</b>
                  <span>{p.note}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="pg-panel">
            <h3>
              A–Z index <small>{PROPERTIES_AZ.length} properties</small>
            </h3>
            <div className="az-index">
              {PROPERTIES_AZ.map(p => (
                <button key={p.key} type="button" className="az-chip" onClick={() => jumpTo(p.key as string)}>
                  {p.key}
                </button>
              ))}
            </div>
          </div>

          {GROUP_ORDER.map(group => (
            <div className="pg-panel" key={group}>
              <h3>{group}</h3>
              {PROPERTIES.filter(p => p.group === group).map(renderControl)}
            </div>
          ))}
        </aside>
      </div>
    </section>
  );
}
