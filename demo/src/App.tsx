import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { CSSProperties } from 'react';
import { LiquidGlass } from 'quick-liquid/react';
import type { LiquidGlassConfig } from 'quick-liquid';
import { LiquidGroup, LiquidGesture, LiquidTabBar } from 'quick-liquid';

interface Metrics {
  avgFrameTime: number;
  lastFrameTime: number;
  frameCount: number;
  quality: string;
  mapGenMs?: number;
  mapPixelsComputed?: number;
}

type NumericConfigKey =
  | 'blur'
  | 'saturation'
  | 'refractionStrength'
  | 'bezelWidth'
  | 'edgeHighlight'
  | 'specularStrength'
  | 'fresnelPower'
  | 'chromaticAberration'
  | 'ior'
  | 'thickness'
  | 'borderRadius'
  | 'tintOpacity'
  | 'noiseOpacity'
  | 'lightAngle';

type SliderControl = {
  key: NumericConfigKey;
  label: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
  precision?: number;
};

const GLASS_BASE: Partial<LiquidGlassConfig> = {
  blur: 3,
  saturation: 1.5,
  refractionStrength: 22,
  bezelWidth: 34,
  thickness: 24,
  edgeHighlight: 0.9,
  specularStrength: 0.42,
  chromaticAberration: 0.3,
  borderRadius: 28,
  dynamicLighting: false,
  tintOpacity: 0.04,
  ior: 1.5,
  lightAngle: -35,
  quality: 'high',
  refractionMode: 'svg',
  fresnelPower: 2.2,
  noiseOpacity: 0,
  noiseScale: 1,
  hoverLighting: false,
};

const LIVE_CONTROLS: SliderControl[] = [
  { key: 'blur', label: 'Frost Blur', min: 0, max: 32, step: 0.5, unit: 'px', precision: 1 },
  { key: 'saturation', label: 'Saturation', min: 1, max: 2.4, step: 0.05, precision: 2 },
  { key: 'refractionStrength', label: 'Refraction', min: 0, max: 64, step: 1, unit: 'px', precision: 0 },
  { key: 'bezelWidth', label: 'Bezel Width', min: 6, max: 80, step: 1, unit: 'px', precision: 0 },
  { key: 'thickness', label: 'Glass Depth', min: 2, max: 48, step: 1, unit: 'px', precision: 0 },
  { key: 'ior', label: 'IOR', min: 1.1, max: 1.8, step: 0.01, precision: 2 },
  { key: 'chromaticAberration', label: 'Prism Split', min: 0, max: 1, step: 0.02, precision: 2 },
  { key: 'edgeHighlight', label: 'Rim Light', min: 0, max: 1, step: 0.02, precision: 2 },
  { key: 'specularStrength', label: 'Bezel Sheen', min: 0, max: 1, step: 0.02, precision: 2 },
  { key: 'fresnelPower', label: 'Lobe Focus', min: 1, max: 5, step: 0.1, precision: 1 },
  { key: 'borderRadius', label: 'Radius', min: 4, max: 72, step: 1, unit: 'px', precision: 0 },
  { key: 'tintOpacity', label: 'Tint Opacity', min: 0, max: 0.22, step: 0.005, precision: 3 },
  { key: 'noiseOpacity', label: 'Micro Texture', min: 0, max: 0.03, step: 0.001, precision: 3 },
  { key: 'lightAngle', label: 'Light Angle', min: -180, max: 180, step: 5, unit: 'deg', precision: 0 },
];

function App() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [userConfig, setUserConfig] = useState<Partial<LiquidGlassConfig>>({});
  const [darkScene, setDarkScene] = useState(false);

  useEffect(() => {
    document.body.classList.toggle('dark-scene', darkScene);
  }, [darkScene]);

  const getConfig = useCallback(
    (fixedOverrides: Partial<LiquidGlassConfig> = {}) => ({
      ...GLASS_BASE,
      appearance: (darkScene ? 'dark' : 'light') as LiquidGlassConfig['appearance'],
      ...userConfig,
      ...fixedOverrides,
      dynamicLighting: false,
    }),
    [userConfig, darkScene],
  );

  const getLiveConfig = useCallback(
    (extraOverrides: Partial<LiquidGlassConfig> = {}) => ({
      ...GLASS_BASE,
      appearance: (darkScene ? 'dark' : 'light') as LiquidGlassConfig['appearance'],
      ...userConfig,
      ...extraOverrides,
      dynamicLighting: false,
    }),
    [userConfig, darkScene],
  );

  const handlePerf = useCallback((m: Metrics) => setMetrics(m), []);

  const mergeContainerRef = useRef<HTMLDivElement>(null);
  const tabBarRef = useRef<HTMLDivElement>(null);
  const tabItemsRef = useRef<(HTMLElement | null)[]>([]);
  const liquidGroupRef = useRef<LiquidGroup | null>(null);
  const tabBarCtrlRef = useRef<LiquidTabBar | null>(null);
  const playgroundRef = useRef<HTMLDivElement>(null);

  // Draggable refraction playground lens
  useEffect(() => {
    const container = playgroundRef.current;
    if (!container) return;
    const lens = container.querySelector<HTMLElement>('.playground-lens');
    if (!lens) return;
    const gesture = new LiquidGesture(lens, { pressScale: 1.04, pressSquish: 0, wobbleOnPress: false, releaseSpring: 'default' });
    return () => gesture.destroy();
  }, []);

  const sliderValues = useMemo(
    () => ({ ...GLASS_BASE, ...userConfig }),
    [userConfig],
  );

  const formatSliderValue = useCallback((control: SliderControl) => {
    const raw = sliderValues[control.key];
    const value = typeof raw === 'number' ? raw : 0;
    return `${value.toFixed(control.precision ?? 0)}${control.unit ?? ''}`;
  }, [sliderValues]);

  useEffect(() => {
    if (!mergeContainerRef.current) return;
    const container = mergeContainerRef.current;
    const blobs = container.querySelectorAll<HTMLElement>('.merge-blob');
    if (blobs.length < 2) return;
    const group = new LiquidGroup(container, { mergeDistance: 50, blendRadius: 28, bridgeOpacity: 0.2, resolution: 3 });
    blobs.forEach(blob => group.add(blob));
    liquidGroupRef.current = group;
    blobs.forEach(blob => {
      const gesture = new LiquidGesture(blob, { pressScale: 1.05, pressSquish: 0, wobbleOnPress: false, releaseSpring: 'bouncy' });
      gesture.onDrag(() => group.updatePositions());
    });
    return () => group.destroy();
  }, []);

  useEffect(() => {
    if (!tabBarRef.current) return;
    const items = tabBarRef.current.querySelectorAll<HTMLElement>('.tab-item');
    if (items.length === 0) return;
    const tabBar = new LiquidTabBar(tabBarRef.current, [...items], { spring: 'default' });
    tabBarCtrlRef.current = tabBar;
    return () => tabBar.destroy();
  }, []);

  const handleTabClick = (index: number) => {
    setActiveTab(index);
    tabBarCtrlRef.current?.select(index);
  };

  return (
    <>
      <div className="scene-background" />
      <div className="geo-pattern">
        {Array.from({ length: 8 }).map((_, i) => <div key={i} className="orb" />)}
      </div>
      <div className="grid-pattern" />

      <LiquidGlass config={getConfig({ borderRadius: 12 })} className="perf-hud">
        <strong>Perf</strong><br />
        Map gen: {metrics?.mapGenMs != null ? `${metrics.mapGenMs.toFixed(1)}ms` : '-'}<br />
        Map px: {metrics?.mapPixelsComputed?.toLocaleString() ?? '-'}<br />
        Light: {metrics ? `${metrics.avgFrameTime.toFixed(2)}ms/f` : '-'}
      </LiquidGlass>

      <LiquidGlass
        config={getConfig({ borderRadius: 999 })}
        className="scene-toggle"
        liquidPress
        onClick={() => setDarkScene(d => !d)}
        role="button"
        aria-pressed={darkScene}
      >
        {darkScene ? '☀️ Light scene' : '🌙 Dark scene'}
      </LiquidGlass>

      <div className="demo-container">
        <div className="demo-header">
          <h1>Quick Liquid</h1>
          <p>Production-quality liquid glass for the web.</p>
        </div>

        <LiquidGlass
          config={getConfig({ borderRadius: 50 })}
          className="glass-nav"
          onPerformanceUpdate={handlePerf}
          liquidPress
        >
          <span className="nav-brand">QuickLiquid</span>
          <span>Home</span><span>Docs</span><span>API</span><span>GitHub</span>
        </LiquidGlass>

        <div className="hero-scene">
          <div className="hero-bg-text" aria-hidden="true">Liquid Glass</div>
          <LiquidGlass config={getConfig({ borderRadius: 999 })} className="glass-hero-pill" animateIn={200} />
        </div>

        <div className="playground-demo">
          <h3>Refraction Playground</h3>
          <p>Drag the lens — exact Snell's-law refraction of everything beneath it.</p>
          <div className="playground" ref={playgroundRef}>
            <div className="pg-bg" aria-hidden="true">
              <div className="pg-stripes" />
              <div className="pg-type">
                <span>LIGHT</span><span>BENDS</span><span>AT THE</span><span>BEZEL</span>
              </div>
              <div className="pg-swatches">
                {['#ff3b72', '#ffb340', '#25d98a', '#2576ff', '#8d63ff', '#ff4f9f'].map(c => (
                  <i key={c} style={{ background: c }} />
                ))}
              </div>
            </div>
            <LiquidGlass
              config={getConfig({ borderRadius: 999, blur: 1, refractionStrength: 34, tintOpacity: 0.015, thickness: 30, bezelWidth: 42, appearance: 'dark' })}
              className="playground-lens"
            />
          </div>
        </div>

        <div className="motion-demo">
          <h3>Motion Behind Glass</h3>
          <p>The backdrop is alive — watch the lens re-process everything that moves beneath it, every frame.</p>
          <div className="motion-stage">
            <div className="motion-bg" aria-hidden="true">
              <div className="motion-beam" />
              <div className="motion-marquee">
                <span>LIQUID GLASS BENDS LIGHT · REFRACTS MOTION · </span>
                <span>LIQUID GLASS BENDS LIGHT · REFRACTS MOTION · </span>
              </div>
              <div className="motion-ball mb-1" />
              <div className="motion-ball mb-2" />
              <div className="motion-ball mb-3" />
              <div className="motion-ball mb-4" />
              <div className="motion-grid" />
            </div>
            <LiquidGlass
              config={getConfig({ borderRadius: 26, blur: 1.5, refractionStrength: 24, tintOpacity: 0.015, thickness: 22, bezelWidth: 20, appearance: 'dark' })}
              className="motion-glass motion-glass-clear"
            >
              <span className="motion-label">clear — pure lens</span>
            </LiquidGlass>
            <LiquidGlass
              config={getConfig({ borderRadius: 26, blur: 16, tintOpacity: 0.09, refractionStrength: 14, thickness: 20, bezelWidth: 20, appearance: 'dark' })}
              className="motion-glass motion-glass-frosted"
            >
              <span className="motion-label">frosted — blur + tint</span>
            </LiquidGlass>
          </div>
        </div>

        <div className="materials-demo">
          <h3>Materials</h3>
          <p>Apple material presets — from water-clear to heavy frost.</p>
          <div className="materials-strip">
            {(['clear', 'regular', 'thick', 'ultra'] as const).map((m, i) => (
              <LiquidGlass
                key={m}
                config={{ material: m, borderRadius: 24, quality: 'high', refractionMode: 'svg', appearance: 'dark' }}
                className="material-card"
                animateIn={i * 90}
                liquidPress
              >
                <h4>{m}</h4>
                <span className="material-sub">material="{m}"</span>
              </LiquidGlass>
            ))}
          </div>
        </div>

        <div className="section-header">
          <h2>Liquid Animations</h2>
          <p>Spring physics, merging blobs, gesture response.</p>
        </div>

        <div className="tab-bar-demo">
          <LiquidGlass config={getConfig({ borderRadius: 50 })} className="glass-tab-bar">
            <div className="tab-bar-inner" ref={tabBarRef}>
              {['Home', 'Search', 'Library', 'Profile'].map((label, i) => (
                <button key={label} className={`tab-item ${activeTab === i ? 'active' : ''}`}
                  onClick={() => handleTabClick(i)} ref={el => { tabItemsRef.current[i] = el; }}>
                  {label}
                </button>
              ))}
            </div>
          </LiquidGlass>
        </div>

        <div className="merge-demo">
          <h3>Water Droplet Merge</h3>
          <p>Drag the glass blobs close together.</p>
          <div className="merge-container" ref={mergeContainerRef}>
            {['A', 'B', 'C'].map(l => (
              <LiquidGlass key={l} config={getConfig({ borderRadius: 999 })} className="merge-blob" liquidPress>
                <span>{l}</span>
              </LiquidGlass>
            ))}
          </div>
        </div>

        <div className="spring-buttons-demo">
          <h3>Liquid Buttons</h3>
          <p>Press and hold - spring physics.</p>
          <div className="button-row">
            <LiquidGlass config={getConfig({ borderRadius: 50 })} className="glass-btn" liquidPress animateIn={0}>Bouncy</LiquidGlass>
            <LiquidGlass config={getConfig({ borderRadius: 14 })} className="glass-btn" liquidPress={{ scale: 0.88, squish: 0.04 }} animateIn={100}>Squishy</LiquidGlass>
            <LiquidGlass config={getConfig({ borderRadius: 50 })} className="glass-btn" liquidPress={{ scale: 0.96, squish: 0.01 }} animateIn={200}>Prismatic</LiquidGlass>
          </div>
        </div>

        <div className="demo-grid">
          <LiquidGlass config={getConfig({ borderRadius: 28 })} className="glass-panel" animateIn={0} liquidPress>
            <h2>Liquid Glass</h2>
            <p>The standard Apple-like default. Deep frosted blur, subtle edge highlights, and pure optical refraction.</p>
          </LiquidGlass>

          <LiquidGlass config={getConfig({ borderRadius: 28, chromaticAberration: 1, refractionStrength: 34 })} className="glass-panel" animateIn={120} liquidPress>
            <h2>Prismatic</h2>
            <p>High chromatic aberration splits the light like a prism, creating beautiful colorful fringing at the edges.</p>
          </LiquidGlass>

          <LiquidGlass config={getConfig({ borderRadius: 28, blur: 18, tintOpacity: 0.12, refractionStrength: 14 })} className="glass-panel" animateIn={240} liquidPress>
            <h2>Frosted</h2>
            <p>Heavy blur and tint opacity with gentle optical distortion. Perfect for modal backdrops and floating panels.</p>
          </LiquidGlass>

          <LiquidGlass config={getConfig({ borderRadius: 28, blur: 0.5, refractionStrength: 40, tintOpacity: 0.0, thickness: 34, bezelWidth: 44 })} className="glass-panel" animateIn={360} liquidPress>
            <h2>Crystal Clear</h2>
            <p>Almost zero blur but massive refraction and intense specular highlights. Looks like a polished, heavy piece of crystal.</p>
          </LiquidGlass>
        </div>

        <div className="controls-section">
          <LiquidGlass config={getLiveConfig()} className="controls">
            <h3>Live Configuration</h3>
            <div className="slider-stack">
              {LIVE_CONTROLS.map(control => {
                const numericValue = Number(sliderValues[control.key] ?? 0);
                const progress = ((numericValue - control.min) / (control.max - control.min)) * 100;
                return (
                  <div className="slider-row" key={control.key}>
                    <label htmlFor={`control-${control.key}`}>{control.label}</label>
                    <input
                      id={`control-${control.key}`}
                      type="range"
                      min={control.min}
                      max={control.max}
                      step={control.step}
                      value={numericValue}
                      style={{ '--slider-progress': `${Math.min(100, Math.max(0, progress))}%` } as CSSProperties}
                      onInput={e => {
                        const value = +(e.target as HTMLInputElement).value;
                        setUserConfig(c => ({ ...c, [control.key]: value }));
                      }}
                    />
                    <span className="value">{formatSliderValue(control)}</span>
                  </div>
                );
              })}
            </div>
          </LiquidGlass>

          <LiquidGlass config={getLiveConfig()} className="live-preview-box" animateIn={0} liquidPress>
            <h3>Live Preview</h3>
            <p>This box reflects the exact values of your sliders, allowing you to instantly preview changes.</p>
          </LiquidGlass>
        </div>
      </div>
    </>
  );
}

export default App;
