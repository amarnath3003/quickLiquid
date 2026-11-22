import { CardGlass } from '../components/CardGlass';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AnimationScheduler,
  DEFAULT_CONFIG,
  LiquidGroup,
  LiquidScrollTrack,
  MATERIAL_PRESETS,
  SPRING_PRESETS,
  Spring,
  type LiquidGlassConfig,
  type SpringPreset,
} from 'quick-liquid';
import {
  LiquidGlass,
  LiquidGlassButton,
  LiquidSegmented,
  LiquidSwitcher,
  LiquidToggle,
  useLiquidInteractive,
  type LiquidGlassRef,
} from 'quick-liquid/react';
import {
  GROUP_ORDER,
  PROPERTIES_AZ,
  hexToRgbString,
  rgbStringToHex,
  type PropertyDef,
  type PropertyGroup,
} from '../data/properties';
import { CodeBlock } from '../components/CodeBlock';
import { GlassRange } from '../components/GlassControls';
import { LightField } from '../components/SiteShell';
import { useLiquidTabBar } from '../components/useLiquidTabBar';
import { useSceneBounds, useSceneDrag, type Point } from '../components/useSceneDrag';
import { flowBeamY, paintFlowScene } from './flow-scene';

export type DocTopic = 'configuration' | 'materials' | 'react' | 'metaballs' | 'toolkit' | 'browser';

const REACT_PROPS = [
  ['config', 'Partial<LiquidGlassConfig>', 'Engine configuration — any option from Configuration.'],
  ['as', 'keyof JSX.IntrinsicElements', "Host element tag. Defaults to 'div'."],
  ['active', 'boolean', 'Mount or unmount the engine while keeping the DOM. Defaults to true.'],
  ['liquidPress', 'boolean | { scale?, squish? }', 'Scale + bounce press physics on pointer down.'],
  ['animateIn', 'boolean | number', 'Spring scale-in on first mount; a number is delay in ms.'],
  ['jiggle', 'boolean | number', 'Jiggle on mount; a number sets intensity.'],
  ['onPerformanceUpdate', '(metrics) => void', 'Called every second with map-gen ms, frame time, and quality tier.'],
] as const;

const REF_API = [
  ['engine', 'LiquidGlassEngine | null', 'Direct handle to the underlying engine instance.'],
  ['getMetrics()', 'PerformanceMetrics | null', 'Map-gen cost, active quality tier, filter builds, and displacement taps.'],
  ['jiggle(intensity?)', 'void', 'Playful squash-and-stretch wobble.'],
  ['animateIn(delay?)', 'void', 'Replay the spring entrance.'],
  ['animateOut()', 'Promise<void>', 'Spring exit; resolves when the transition completes.'],
] as const;

const TOOLKIT_ITEMS = [
  {
    name: 'Spring / SpringVector',
    desc: 'Analytical damped-harmonic spring solver with zero integration drift and velocity carry-over.',
    code: `import { Spring, AnimationScheduler } from 'quick-liquid';

const spring = new Spring(0, 'bouncy');
spring.setTarget(100);

AnimationScheduler.shared().schedule(now => {
  const moving = spring.tick(now);
  el.style.translate = \`\${spring.value}px 0\`;
  return moving;
});`,
  },
  {
    name: 'SPRING_PRESETS',
    desc: "Curated spring feels: 'default', 'snappy', 'bouncy', 'gentle', 'stiff', 'liquidMerge', 'liquidSplit'.",
    code: `import { Spring, SPRING_PRESETS } from 'quick-liquid';

const s = new Spring(0, SPRING_PRESETS.snappy);
s.setTarget(1);`,
  },
  {
    name: 'LiquidInteractive',
    desc: 'Non-blocking hover sheen, magnetic pointer pull, press squish, and expanding water ripples.',
    code: `import { LiquidInteractive } from 'quick-liquid';

const ctrl = new LiquidInteractive(buttonEl, {
  pressScale: 0.95,
  pressSquish: 0.045,
  hoverLift: 2.5,
  ripple: true,
});`,
  },
  {
    name: 'LiquidMorphModal',
    desc: 'Instant surface-tension drop + optical glass sheen reveal (or optional shared-element trigger flight).',
    code: `import { LiquidMorphModal } from 'quick-liquid';

const modal = new LiquidMorphModal({
  mode: 'drop',
  sheen: true,
  contentSelector: '.dialog__content',
});
await modal.openFrom(triggerEl, dialogEl, () => dialogEl.showModal());`,
  },
  {
    name: 'LiquidSwitch',
    desc: 'Spring-driven glass toggle thumb with velocity-coupled droplet stretch and press squish.',
    code: `import { LiquidSwitch } from 'quick-liquid';

const toggle = new LiquidSwitch(trackEl, thumbEl, false, {
  maxStretch: 0.28,
  pressSquish: 0.14,
});
toggle.setChecked(true);`,
  },
  {
    name: 'LiquidPopover',
    desc: 'Spring-blooming dropdown menus with a gliding liquid highlight pill across hovered items.',
    code: `import { LiquidPopover } from 'quick-liquid';

const pop = new LiquidPopover({ origin: 'top right' });
pop.open(menuEl);
const stopList = LiquidPopover.bindList(menuEl, '[role="option"]');`,
  },
  {
    name: 'LiquidContentSwap',
    desc: 'Directional spring transition when switching code tabs, panels, or documentation views.',
    code: `import { LiquidContentSwap } from 'quick-liquid';

LiquidContentSwap.animateSwap(panelEl, 1, 'snappy');`,
  },
  {
    name: 'LiquidScrollTrack',
    desc: 'Spring-smoothed scroll progress indicator for floating nav bars and scrollable lists.',
    code: `import { LiquidScrollTrack } from 'quick-liquid';

const track = new LiquidScrollTrack(window, barEl, {
  orientation: 'horizontal',
  spring: 'snappy',
});`,
  },
  {
    name: 'LiquidGesture',
    desc: 'Pointer physics with rubber-banding, press squish, flick carry-over, and spring release.',
    code: `import { LiquidGesture } from 'quick-liquid';

const gesture = new LiquidGesture(card, {
  pressScale: 0.96,
  pressSquish: 0.03,
  maxDragDistance: 120,
  releaseSpring: 'bouncy',
});`,
  },
  {
    name: 'LiquidButton / LiquidDrag',
    desc: 'Prewired gesture bindings for tactile buttons and free-drag glass surfaces.',
    code: `import { LiquidButton, LiquidDrag } from 'quick-liquid';

const btn = new LiquidButton(buttonEl);
const drag = new LiquidDrag(panelEl);`,
  },
  {
    name: 'LiquidGroup',
    desc: 'Shared SDF metaball glass surface — nearby glass elements bridge like liquid droplets.',
    code: `import { LiquidGroup, LiquidGesture } from 'quick-liquid';

const group = new LiquidGroup(stage, {
  mergeDistance: 24,
  blendRadius: 32,
});
group.add(dropA);
group.add(dropB);`,
  },
  {
    name: 'LiquidTabBar',
    desc: 'GPU-composited glass pill indicator with hover follower and optical LiquidGlass backing.',
    code: `import { LiquidTabBar } from 'quick-liquid';

const bar = new LiquidTabBar(navEl, tabs, {
  glass: true,
  hoverFollower: true,
  spring: 'bouncy',
});`,
  },
  {
    name: 'LiquidMorph / LiquidMetaball',
    desc: 'Shape morphing and SDF blob-field rendering primitives.',
    code: `import { LiquidMorph } from 'quick-liquid';

const morph = new LiquidMorph(el, { duration: 420 });
morph.to({ borderRadius: 40, width: 260, height: 140 });`,
  },
  {
    name: 'LiquidTransition / LiquidLayoutAnimation',
    desc: 'Spring-driven property transitions and FLIP layout animations.',
    code: `import { LiquidTransition } from 'quick-liquid';

const tx = new LiquidTransition(el, { spring: 'snappy' });
tx.to({ scale: 1.05, y: -6 });`,
  },
] as const;

const TINT_SWATCHES = [
  { label: 'Default', rgb: '255, 255, 255' },
  { label: 'Droplet', rgb: '122, 166, 214' },
  { label: 'Violet', rgb: '164, 146, 255' },
  { label: 'Mint', rgb: '122, 232, 206' },
  { label: 'Coral', rgb: '248, 138, 162' },
] as const;

const SPECIMEN_BASE: Partial<LiquidGlassConfig> = {
  appearance: 'dark',
  quality: 'high',
  borderRadius: 28,
  blur: 2,
  refractionStrength: 28,
  bezelWidth: 34,
  thickness: 26,
  chromaticAberration: 0.24,
  tintOpacity: 0.05,
  specularStrength: 0.36,
  edgeHighlight: 0.9,
};

function ConfigExplorer() {
  const [group, setGroup] = useState<'All' | PropertyGroup>('All');
  const [filter, setFilter] = useState('');
  const [selectedKey, setSelectedKey] = useState<keyof LiquidGlassConfig>('refractionStrength');
  const [overrides, setOverrides] = useState<Partial<LiquidGlassConfig>>({});
  const listRef = useRef<HTMLDivElement>(null);
  const trackBarRef = useRef<HTMLSpanElement>(null);
  const trackerRef = useRef<LiquidScrollTrack | null>(null);

  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return PROPERTIES_AZ.filter(p => {
      if (group !== 'All' && p.group !== group) return false;
      if (!q) return true;
      return (
        String(p.key).toLowerCase().includes(q) ||
        p.label.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      );
    });
  }, [group, filter]);

  useEffect(() => {
    if (!listRef.current || !trackBarRef.current) return;
    const track = new LiquidScrollTrack(listRef.current, trackBarRef.current, {
      orientation: 'vertical',
      spring: 'snappy',
    });
    trackerRef.current = track;
    return () => {
      track.destroy();
      trackerRef.current = null;
    };
  }, []);

  useEffect(() => {
    trackerRef.current?.refresh();
  }, [rows.length]);

  const selected: PropertyDef =
    rows.find(p => p.key === selectedKey) ??
    PROPERTIES_AZ.find(p => p.key === selectedKey) ??
    PROPERTIES_AZ[0];

  const liveConfig: Partial<LiquidGlassConfig> = useMemo(
    () => ({ ...SPECIMEN_BASE, ...overrides }),
    [overrides],
  );

  const effectiveValue =
    overrides[selected.key] ??
    liveConfig[selected.key] ??
    DEFAULT_CONFIG[selected.key];

  function patch(key: keyof LiquidGlassConfig, value: unknown) {
    setOverrides(prev => {
      const next = { ...prev } as Record<string, unknown>;
      if (value === undefined) delete next[key as string];
      else next[key as string] = value;
      return next as Partial<LiquidGlassConfig>;
    });
  }

  const snippetEntries = Object.keys(overrides).length > 0
    ? Object.entries(overrides)
    : [[selected.key, effectiveValue ?? DEFAULT_CONFIG[selected.key]]];

  const snippet = `<LiquidGlass
  config={{
${snippetEntries
  .filter(([, val]) => val !== undefined)
  .map(([k, val]) => `    ${k}: ${JSON.stringify(val)},`)
  .join('\n')}
  }}
>
  <div className="panel">Hello, glass.</div>
</LiquidGlass>`;

  const modifiedCount = Object.keys(overrides).length;

  function renderControl(prop: PropertyDef) {
    const ctrl = prop.control;
    if (ctrl.kind === 'slider') {
      const numeric = typeof effectiveValue === 'number'
        ? effectiveValue
        : (DEFAULT_CONFIG[prop.key] as number | undefined) ?? ctrl.min;
      const precision = ctrl.precision ?? (ctrl.step < 1 ? 1 : 0);
      return (
        <GlassRange
          label={prop.label}
          min={ctrl.min}
          max={ctrl.max}
          step={ctrl.step}
          value={numeric}
          valueText={`${numeric.toFixed(precision)}${ctrl.unit ?? ''}`}
          onChange={val => patch(prop.key, val)}
        />
      );
    }
    if (ctrl.kind === 'toggle') {
      const checked = Boolean(effectiveValue);
      return (
        <div className="docs-control-row">
          <span>{prop.label}</span>
          <LiquidToggle
            checked={checked}
            onChange={next => patch(prop.key, next)}
            label={prop.label}
          />
        </div>
      );
    }
    if (ctrl.kind === 'select') {
      const current = String(effectiveValue ?? (prop.key === 'material' ? 'none' : ctrl.options[0]));
      return (
        <div className="docs-control-stack">
          <span className="docs-control-label">{prop.label}</span>
          <LiquidSegmented
            options={ctrl.options.map(option => ({ value: option, label: option }))}
            value={current}
            onChange={option => patch(prop.key, option === 'none' ? undefined : option)}
            glass
            ariaLabel={prop.label}
            className="docs-segments"
          />
        </div>
      );
    }
    const rgb = typeof effectiveValue === 'string' ? effectiveValue : '255, 255, 255';
    return (
      <div className="docs-control-stack">
        <div className="docs-control-row">
          <span className="docs-control-label">{prop.label}</span>
          <input
            type="color"
            className="docs-color-input"
            aria-label="Pick tint color"
            value={rgbStringToHex(rgb)}
            onChange={e => patch(prop.key, hexToRgbString(e.target.value))}
          />
        </div>
        <div className="docs-swatches">
          {TINT_SWATCHES.map(swatch => (
            <LiquidGlassButton
              key={swatch.label}
              className="glass-button docs-swatch-btn"
              aria-pressed={rgb === swatch.rgb}
              onClick={() => patch(prop.key, swatch.rgb)}
            >
              <i style={{ background: `rgb(${swatch.rgb})` }} aria-hidden />
              {swatch.label}
            </LiquidGlassButton>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="docs-config-panel">
      <div className="docs-toolbar glass-pane">
        <CardGlass />
        <div className="docs-toolbar__top">
          <input
            className="docs-filter"
            type="search"
            placeholder={`Search ${PROPERTIES_AZ.length} config options…`}
            value={filter}
            onChange={e => setFilter(e.target.value)}
            aria-label="Filter configuration options"
          />
          {modifiedCount > 0 && (
            <LiquidGlassButton className="glass-button" onClick={() => setOverrides({})}>
              Reset ({modifiedCount})
            </LiquidGlassButton>
          )}
        </div>
        <div className="docs-pills" role="group" aria-label="Option categories">
          {(['All', ...GROUP_ORDER] as const).map(item => (
            <LiquidGlassButton
              key={item}
              className="docs-pill"
              aria-pressed={group === item}
              interactive={{ hoverLift: 0, hoverScale: 1, pressScale: 0.95, pressSquish: 0.03, ripple: true }}
              onClick={() => setGroup(item)}
            >
              {item}
            </LiquidGlassButton>
          ))}
        </div>
      </div>

      <div className="docs-split">
        <div className="docs-prop-wrap glass-pane">
          <CardGlass />
          <div className="docs-prop-list" ref={listRef} role="listbox" aria-label="Configuration options">
            {rows.map(prop => {
              const isSelected = prop.key === selected.key;
              const isModified = prop.key in overrides;
              return (
                <button
                  key={String(prop.key)}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className="docs-prop-item"
                  onClick={() => setSelectedKey(prop.key)}
                >
                  <span className="docs-prop-item__head">
                    <code>{String(prop.key)}</code>
                    <span className="docs-prop-item__meta">
                      {isModified && <i className="docs-dot" title="Modified" />}
                      <code className="t-default">{prop.defaultValue}</code>
                    </span>
                  </span>
                  <span className="docs-prop-item__desc">{prop.description}</span>
                </button>
              );
            })}
            {rows.length === 0 && <p className="docs-empty">No option matches “{filter}”.</p>}
          </div>
          <div className="docs-scroll-track" aria-hidden="true">
            <span ref={trackBarRef} className="docs-scroll-track__fill" />
          </div>
        </div>

        <aside className="docs-inspector glass-pane" aria-label="Live property inspector">
          <CardGlass />
          <div className="docs-stage">
            <LightField className="docs-stage__beam" />
            <LiquidGlass className="docs-specimen" config={liveConfig}>
              <div className="docs-specimen__body">
                <span>{selected.label}</span>
                <code>{String(selected.key)}</code>
              </div>
            </LiquidGlass>
          </div>

          <LiquidSwitcher activeKey={String(selected.key)} direction={0}>
            <div className="docs-inspector__control">
              {renderControl(selected)}
            </div>

            <div className="docs-inspector__meta">
              <div className="docs-spec-tags">
                <code>{String(selected.key)}</code>
                <code className="t-type">{selected.type}</code>
                <code className="t-default">default: {selected.defaultValue}</code>
              </div>
              <p>{selected.description}</p>
            </div>
          </LiquidSwitcher>

          <CodeBlock key={snippet} code={snippet} lang="tsx" title="Live config" />
        </aside>
      </div>
    </div>
  );
}

function MaterialsExplorer() {
  const names = Object.keys(MATERIAL_PRESETS);
  const [selected, setSelected] = useState<string>('clear');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [lang, setLang] = useState<'React' | 'Vanilla JS'>('React');
  const [langDir, setLangDir] = useState<-1 | 1>(1);
  const preset = MATERIAL_PRESETS[selected];
  const dark = theme === 'dark';

  const code = lang === 'React'
    ? `<LiquidGlass config={{ material: '${selected}', appearance: '${theme}' }}>
  <div className="surface">${selected}</div>
</LiquidGlass>`
    : `new LiquidGlassEngine(element, {
  material: '${selected}',
  appearance: '${theme}',
});`;

  return (
    <section className="docs-block glass-pane">
      <CardGlass />
      <div className="docs-panel-head">
        <div>
          <h2>Material presets</h2>
          <p className="docs-lead">Switch presets to compare frost, edge refraction, and bezel depth live.</p>
        </div>
        <LiquidSegmented
          options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }]}
          value={theme}
          onChange={setTheme}
          glass
          ariaLabel="Backdrop theme"
        />
      </div>

      <LiquidSegmented
        options={names.map(name => ({ value: name, label: name }))}
        value={selected}
        onChange={setSelected}
        glass
        ariaLabel="Material presets"
        className="docs-material-tabs"
      />

      <div className="docs-stage docs-stage--tall" data-theme={theme}>
        <LightField className="docs-stage__beam" />
        <LiquidGlass
          className="docs-specimen docs-specimen--wide"
          config={{
            material: selected as LiquidGlassConfig['material'],
            appearance: theme,
            borderRadius: 34,
            cursorTracking: true,
          }}
        >
          <div className="docs-specimen__body">
            <span>material: &apos;{selected}&apos;</span>
            <strong>{selected}</strong>
          </div>
        </LiquidGlass>
      </div>

      <div className="docs-metrics-grid">
        <div><span>blur</span><strong>{preset.blur} px</strong></div>
        <div><span>refraction</span><strong>{preset.refractionStrength} px</strong></div>
        <div><span>bezel</span><strong>{preset.bezelWidth} px</strong></div>
        <div><span>thickness</span><strong>{preset.thickness} px</strong></div>
        <div><span>tint α</span><strong>{preset.tintOpacity}</strong></div>
        <div><span>saturation</span><strong>{preset.saturation}×</strong></div>
      </div>

      <div className="docs-code-head">
        <LiquidSegmented
          options={[{ value: 'React', label: 'React' }, { value: 'Vanilla JS', label: 'Vanilla JS' }]}
          value={lang}
          onChange={next => {
            setLangDir(next === 'Vanilla JS' ? 1 : -1);
            setLang(next);
          }}
          glass
          ariaLabel="Snippet language"
        />
      </div>
      <LiquidSwitcher activeKey={`${selected}-${lang}-${dark}`} direction={langDir}>
        <CodeBlock key={code} code={code} lang={lang === 'React' ? 'tsx' : 'ts'} title={lang === 'React' ? 'Material.tsx' : 'material.ts'} />
      </LiquidSwitcher>
    </section>
  );
}

function ReactRefSandbox() {
  const glassRef = useRef<LiquidGlassRef>(null);
  const [active, setActive] = useState(true);
  const [press, setPress] = useState(true);
  const [tab, setTab] = useState<'props' | 'ref'>('props');
  const [metrics, setMetrics] = useState<ReturnType<NonNullable<LiquidGlassRef['getMetrics']>> | null>(null);
  const [busy, setBusy] = useState(false);

  const readMetrics = () => {
    const next = glassRef.current?.getMetrics() ?? null;
    setMetrics(next);
  };

  useEffect(() => {
    const id = window.setTimeout(readMetrics, 180);
    return () => window.clearTimeout(id);
  }, [active]);

  async function triggerExit() {
    if (!glassRef.current || busy) return;
    setBusy(true);
    await glassRef.current.animateOut();
    window.setTimeout(() => {
      glassRef.current?.animateIn(0);
      setBusy(false);
    }, 320);
  }

  const refSnippet = `const ref = useRef<LiquidGlassRef>(null);

<LiquidGlass ref={ref} active={${active}} liquidPress={${press}}>
  <div className="card">Press or trigger via ref</div>
</LiquidGlass>

ref.current?.jiggle(1.2);
const metrics = ref.current?.getMetrics();`;

  return (
    <section className="docs-block glass-pane">
      <CardGlass />
      <div className="docs-panel-head">
        <div>
          <h2>React &amp; Imperative Ref</h2>
          <p className="docs-lead">Trigger real lifecycle animations, press physics, and inspect live engine metrics.</p>
        </div>
      </div>

      <div className="docs-ref-sandbox">
        <div className="docs-stage">
          <LightField className="docs-stage__beam" />
          <LiquidGlass
            ref={glassRef}
            active={active}
            liquidPress={press}
            className="docs-specimen docs-specimen--interactive"
            config={{
              appearance: 'dark',
              borderRadius: 30,
              blur: 2,
              refractionStrength: 28,
              bezelWidth: 34,
              thickness: 26,
              chromaticAberration: 0.22,
              tintOpacity: 0.06,
              specularStrength: 0.42,
              edgeHighlight: 0.92,
            }}
          >
            <div className="docs-specimen__body">
              <span>{press ? 'Press & hold me' : 'LiquidGlass'}</span>
              <code>{active ? 'engine: active' : 'engine: unmounted'}</code>
            </div>
          </LiquidGlass>
        </div>

        <div className="docs-action-bar">
          <LiquidGlassButton className="glass-button glass-button--bright" disabled={!active} onClick={() => glassRef.current?.jiggle(1.25)}>
            jiggle()
          </LiquidGlassButton>
          <LiquidGlassButton className="glass-button" disabled={!active} onClick={() => glassRef.current?.animateIn(0)}>
            animateIn()
          </LiquidGlassButton>
          <LiquidGlassButton className="glass-button" disabled={!active || busy} onClick={triggerExit}>
            animateOut()
          </LiquidGlassButton>
          <LiquidGlassButton className="glass-button" aria-pressed={active} onClick={() => setActive(v => !v)}>
            active: {String(active)}
          </LiquidGlassButton>
          <LiquidGlassButton className="glass-button" aria-pressed={press} onClick={() => setPress(v => !v)}>
            liquidPress: {String(press)}
          </LiquidGlassButton>
          <LiquidGlassButton className="glass-button" disabled={!active} onClick={readMetrics}>
            getMetrics()
          </LiquidGlassButton>
        </div>

        {metrics && (
          <div className="docs-metrics-grid">
            <div><span>quality</span><strong>{metrics.quality}</strong></div>
            <div><span>map gen</span><strong>{metrics.mapGenMs.toFixed(2)} ms</strong></div>
            <div><span>disp taps</span><strong>{metrics.displacementTaps}</strong></div>
            <div><span>filter builds</span><strong>{metrics.filterBuilds}</strong></div>
            <div><span>light bakes</span><strong>{metrics.lightBakes}</strong></div>
            <div><span>pixels</span><strong>{metrics.mapPixelsComputed.toLocaleString()}</strong></div>
          </div>
        )}
      </div>

      <div className="docs-code-head">
        <LiquidSegmented
          options={[{ value: 'props', label: 'React props' }, { value: 'ref', label: 'Imperative ref' }]}
          value={tab}
          onChange={setTab}
          glass
          ariaLabel="React API section"
        />
      </div>

      <LiquidSwitcher activeKey={tab} direction={tab === 'ref' ? 1 : -1}>
        <div className="table-scroll">
          <table className="docs-table docs-table--tight">
            <thead>
              <tr>
                <th>{tab === 'props' ? 'Prop' : 'Member'}</th>
                <th>Type</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {(tab === 'props' ? REACT_PROPS : REF_API).map(([name, type, desc]) => (
                <tr key={name}>
                  <td><code>{name}</code></td>
                  <td><code className="t-type">{type}</code></td>
                  <td>{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </LiquidSwitcher>

      <CodeBlock key={refSnippet} code={refSnippet} lang="tsx" title="LiquidRef.tsx" />
    </section>
  );
}

function clampDrop([x, y]: Point, width: number, height: number, inset: number): Point {
  return [
    Math.max(inset, Math.min(width - inset, x)),
    Math.max(inset, Math.min(height - inset, y)),
  ];
}

function MetaballLab() {
  const { stage, width, height } = useSceneBounds();
  const backdrop = useRef<HTMLCanvasElement>(null);
  const groupRef = useRef<LiquidGroup | null>(null);
  const first = useRef<HTMLDivElement>(null);
  const second = useRef<HTMLDivElement>(null);
  const [mergeDistance, setMergeDistance] = useState(28);
  const [blendRadius, setBlendRadius] = useState(32);
  const [positions, setPositions] = useState<[Point, Point] | null>(null);

  const diameter = Math.min(104, width * 0.24 || 96);
  const inset = diameter / 2 + 8;

  const initial: [Point, Point] = [
    clampDrop([width * 0.36, flowBeamY(0.36) * height], width, height, inset),
    clampDrop([width * 0.64, flowBeamY(0.64) * height], width, height, inset),
  ];

  const points: readonly [Point, Point] = positions
    ? [clampDrop(positions[0], width, height, inset), clampDrop(positions[1], width, height, inset)]
    : initial;

  useEffect(() => {
    const viewport = stage.current;
    if (!viewport || !backdrop.current || !first.current || !second.current) return;
    if (width && height) paintFlowScene(backdrop.current, width, height);
    const group = new LiquidGroup(viewport, {
      backdrop: backdrop.current,
      blendRadius,
      mergeDistance,
      resolution: 1 / Math.min(1.5, window.devicePixelRatio || 1),
      bridgeOpacity: 0.72,
      bridgeColor: 'rgba(122, 166, 214, 0.19)',
      bridgeRimColor: 'rgba(228, 246, 255, 0.96)',
      bridgeRimWidth: 1.3,
    });
    groupRef.current = group;
    group.add(first.current);
    group.add(second.current);
    return () => {
      groupRef.current = null;
      group.destroy();
    };
  }, [stage, blendRadius, mergeDistance, width, height]);

  const grip = useSceneDrag((index, point) => {
    setPositions(index === 0 ? [point, points[1]] : [points[0], point]);
  });

  const code = `import { LiquidGroup, LiquidGesture } from 'quick-liquid';

const group = new LiquidGroup(container, {
  mergeDistance: ${mergeDistance},
  blendRadius: ${blendRadius},
});

blobs.forEach(blob => {
  group.add(blob);
  new LiquidGesture(blob).onDrag(() => group.updatePositions());
});`;

  return (
    <section className="docs-block glass-pane">
      <CardGlass />
      <h2>Droplet merging</h2>
      <p className="docs-lead">Drag the droplets together and adjust the bridge geometry live.</p>

      <div className="docs-metaball-stage" ref={stage}>
        <canvas ref={backdrop} className="docs-metaball-canvas" aria-hidden />
        {[first, second].map((ref, index) => (
          <div
            key={index}
            ref={ref}
            tabIndex={0}
            role="group"
            aria-label={index === 0 ? 'First droplet' : 'Second droplet'}
            className="docs-metaball-drop"
            style={{
              left: points[index][0],
              top: points[index][1],
              width: diameter,
              height: diameter,
              borderRadius: diameter / 2,
            }}
            {...grip(index, points[index])}
          />
        ))}
      </div>

      <div className="docs-sliders-row">
        <GlassRange label="mergeDistance" min={8} max={72} value={mergeDistance} valueText={`${mergeDistance} px`} onChange={setMergeDistance} />
        <GlassRange label="blendRadius" min={8} max={56} value={blendRadius} valueText={`${blendRadius} px`} onChange={setBlendRadius} />
      </div>

      <CodeBlock key={code} code={code} lang="ts" title="metaballs.ts" />
    </section>
  );
}

const SPRING_NAMES = Object.keys(SPRING_PRESETS) as SpringPreset[];
const DEMO_TABS = ['Optics', 'Springs', 'Gestures'] as const;

function ToolkitItemButton({
  item,
  selected,
  onSelect,
}: {
  item: (typeof TOOLKIT_ITEMS)[number];
  selected: boolean;
  onSelect: () => void;
}) {
  const interactiveRef = useLiquidInteractive<HTMLButtonElement>({
    hoverLift: 0,
    hoverScale: 1,
    pressScale: 0.98,
    pressSquish: 0.015,
    ripple: true,
  });

  return (
    <button
      ref={interactiveRef}
      type="button"
      className="toolkit-item"
      aria-pressed={selected}
      onClick={onSelect}
    >
      <code>{item.name}</code>
      <span>{item.desc}</span>
    </button>
  );
}

function ToolkitExplorer() {
  const [preset, setPreset] = useState<SpringPreset>('bouncy');
  const [puckEnd, setPuckEnd] = useState(false);
  const [puckPct, setPuckPct] = useState(0);
  const [activeTab, setActiveTab] = useState(0);
  const [selectedItem, setSelectedItem] = useState(0);
  const animId = useRef<number | null>(null);
  const springVal = useRef(0);
  const { containerRef, select } = useLiquidTabBar(0);

  useEffect(() => () => {
    if (animId.current !== null) AnimationScheduler.shared().cancel(animId.current);
  }, []);

  function launch(nextPreset: SpringPreset, toggleEnd: boolean) {
    setPreset(nextPreset);
    const targetEnd = toggleEnd ? !puckEnd : true;
    setPuckEnd(targetEnd);
    const target = targetEnd ? 1 : 0;
    if (animId.current !== null) {
      AnimationScheduler.shared().cancel(animId.current);
      animId.current = null;
    }
    if (AnimationScheduler.prefersReducedMotion()) {
      springVal.current = target;
      setPuckPct(target);
      return;
    }
    const spring = new Spring(springVal.current, nextPreset);
    spring.setTarget(target);
    animId.current = AnimationScheduler.shared().schedule(now => {
      const moving = spring.tick(now);
      springVal.current = spring.value;
      setPuckPct(spring.value);
      if (!moving) animId.current = null;
      return moving;
    });
  }

  const cfg = SPRING_PRESETS[preset];
  const currentItem = TOOLKIT_ITEMS[selectedItem];

  return (
    <div className="docs-stack">
      <section className="docs-block glass-pane">
        <CardGlass />
        <div className="docs-panel-head">
          <div>
            <h2>Spring physics &amp; tab bar</h2>
            <p className="docs-lead">Pick a spring preset to launch the glass puck with analytical damped-harmonic physics.</p>
          </div>
          <LiquidGlassButton className="glass-button glass-button--bright" onClick={() => launch(preset, true)}>
            Launch
          </LiquidGlassButton>
        </div>

        <LiquidSegmented
          options={SPRING_NAMES.map(name => ({ value: name, label: name }))}
          value={preset}
          onChange={name => launch(name, true)}
          glass
          ariaLabel="Spring presets"
          className="docs-segments"
        />

        <div className="docs-spring-track" onClick={() => launch(preset, true)}>
          <LightField className="docs-spring-track__beam" />
          <div className="docs-spring-puck-wrap" style={{ left: `calc(10px + (100% - 92px) * ${puckPct})` }}>
            <LiquidGlass
              className="docs-spring-puck"
              animateIn={false}
              config={{
                appearance: 'dark',
                borderRadius: 999,
                blur: 1,
                refractionStrength: 24,
                bezelWidth: 18,
                tintOpacity: 0.08,
                specularStrength: 0.45,
                edgeHighlight: 0.92,
              }}
            >
              <span>{preset}</span>
            </LiquidGlass>
          </div>
        </div>

        <div className="docs-metrics-grid docs-metrics-grid--three">
          <div><span>stiffness</span><strong>{cfg.stiffness}</strong></div>
          <div><span>damping</span><strong>{cfg.damping}</strong></div>
          <div><span>mass</span><strong>{cfg.mass}</strong></div>
        </div>

        <div className="docs-tabbar-row">
          <span className="docs-control-label">Live LiquidTabBar</span>
          <div className="docs-lt-bar" ref={containerRef} role="tablist" aria-label="LiquidTabBar demo">
            {DEMO_TABS.map((label, i) => (
              <button
                key={label}
                type="button"
                role="tab"
                aria-selected={activeTab === i}
                className="lt-item"
                onClick={() => {
                  setActiveTab(i);
                  select(i);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="docs-block glass-pane">
        <CardGlass />
        <h2>Toolkit primitives</h2>
        <div className="toolkit-grid">
          {TOOLKIT_ITEMS.map((item, idx) => (
            <ToolkitItemButton
              key={item.name}
              item={item}
              selected={selectedItem === idx}
              onSelect={() => setSelectedItem(idx)}
            />
          ))}
        </div>
        <LiquidSwitcher activeKey={currentItem.name} direction={1}>
          <CodeBlock key={currentItem.name} code={currentItem.code} lang="ts" title={`${currentItem.name}.ts`} />
        </LiquidSwitcher>
      </section>
    </div>
  );
}

function BrowserLab() {
  const [mode, setMode] = useState<'svg' | 'css'>('svg');
  const [svgSupported] = useState(() => {
    try {
      const probe = document.createElement('div');
      probe.style.backdropFilter = 'url(#probe)';
      return probe.style.backdropFilter.includes('url(');
    } catch {
      return false;
    }
  });
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const reducedTransparency = matchMedia('(prefers-reduced-transparency: reduce)').matches;
  const dpr = Math.round((window.devicePixelRatio || 1) * 100) / 100;

  return (
    <section className="docs-block glass-pane">
      <CardGlass />
      <div className="docs-panel-head">
        <div>
          <h2>Browser diagnostics &amp; fallback</h2>
          <p className="docs-lead">Compare live SVG backdrop refraction against the CSS frost + rim fallback.</p>
        </div>
        <LiquidSegmented
          options={[
            { value: 'svg', label: 'svg (Chromium)' },
            { value: 'css', label: 'css (Fallback)' },
          ]}
          value={mode}
          onChange={setMode}
          glass
          ariaLabel="Refraction mode"
        />
      </div>

      <div className="docs-stage">
        <LightField className="docs-stage__beam" />
        <LiquidGlass
          className="docs-specimen docs-specimen--wide"
          config={{
            appearance: 'dark',
            refractionMode: mode,
            borderRadius: 34,
            blur: mode === 'css' ? 12 : 1,
            refractionStrength: 34,
            bezelWidth: 34,
            thickness: 26,
            chromaticAberration: 0.3,
            tintOpacity: 0.06,
            specularStrength: 0.45,
            edgeHighlight: 0.92,
          }}
        >
          <div className="docs-specimen__body">
            <span>refractionMode: &apos;{mode}&apos;</span>
            <strong>{mode === 'svg' ? 'SVG displacement lens' : 'CSS frost + specular rim'}</strong>
          </div>
        </LiquidGlass>
      </div>

      <div className="docs-metrics-grid">
        <div><span>SVG backdrop-filter</span><strong>{svgSupported ? 'Supported' : 'CSS fallback'}</strong></div>
        <div><span>Device pixel ratio</span><strong>{dpr}×</strong></div>
        <div><span>Reduced motion</span><strong>{reducedMotion ? 'On' : 'Off'}</strong></div>
        <div><span>Reduced transparency</span><strong>{reducedTransparency ? 'On' : 'Off'}</strong></div>
      </div>

      <ul className="docs-rules">
        <li>
          Full lenticular refraction (<code>backdrop-filter: url()</code>) renders in <b>Chromium</b>.
          Safari and Firefox keep the frost, tint, shadow, and lighting fallback automatically (or force it via <code>refractionMode: &apos;css&apos;</code>).
        </li>
        <li>
          Never apply <code>isolation</code>, <code>filter</code>, <code>opacity</code>, or <code>mask</code> to the glass host element—each creates a backdrop root in Chromium and disables refraction.
        </li>
        <li>
          Never assign an explicit <code>z-index</code> to the internal lens layer; the engine manages stacking purely by DOM order.
        </li>
      </ul>
    </section>
  );
}

export function Docs({ activeTopic }: { activeTopic: DocTopic }) {
  switch (activeTopic) {
    case 'configuration':
      return <ConfigExplorer />;
    case 'materials':
      return <MaterialsExplorer />;
    case 'react':
      return <ReactRefSandbox />;
    case 'metaballs':
      return <MetaballLab />;
    case 'toolkit':
      return <ToolkitExplorer />;
    case 'browser':
      return <BrowserLab />;
  }
}
