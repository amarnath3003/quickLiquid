import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { CSSProperties } from 'react';
import { LiquidGlass } from 'quick-liquid/react';
import type { LiquidGlassConfig } from 'quick-liquid';
import { LiquidGroup, LiquidGesture, LiquidTabBar } from 'quick-liquid';

interface Metrics { avgFrameTime: number; lastFrameTime: number; frameCount: number; quality: string; }

type NumericConfigKey =
  | 'blur'
  | 'saturation'
  | 'refractionStrength'
  | 'edgeDistortion'
  | 'edgeHighlight'
  | 'specularStrength'
  | 'fresnelPower'
  | 'chromaticAberration'
  | 'ior'
  | 'thickness'
  | 'borderRadius'
  | 'tintOpacity'
  | 'tintStrength'
  | 'edgeBlurModifier'
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
  blur: 10,
  saturation: 1.45,
  refractionStrength: 34,
  edgeHighlight: 0.85,
  specularStrength: 0.78,
  chromaticAberration: 0.16,
  thickness: 3,
  borderRadius: 28,
  dynamicLighting: false,
  tintOpacity: 0.08,
  ior: 1.45,
  lightAngle: -60,
  quality: 'high',
  refractionMode: 'svg',
  tint: '255,255,255',
  edgeBlurModifier: 1.35,
  edgeDistortion: 0.42,
  fresnelPower: 2,
  noiseOpacity: 0.012,
  noiseScale: 1,
  tintStrength: 1,
};

const LIVE_CONTROLS: SliderControl[] = [
  { key: 'blur', label: 'Blur', min: 0, max: 32, step: 0.5, unit: 'px', precision: 1 },
  { key: 'saturation', label: 'Saturation', min: 1, max: 2.4, step: 0.05, precision: 2 },
  { key: 'refractionStrength', label: 'Refraction', min: 0, max: 64, step: 1, precision: 0 },
  { key: 'edgeDistortion', label: 'Edge Bend', min: 0, max: 0.8, step: 0.02, precision: 2 },
  { key: 'edgeHighlight', label: 'Edge Highlight', min: 0, max: 1, step: 0.02, precision: 2 },
  { key: 'specularStrength', label: 'Specular', min: 0, max: 1, step: 0.02, precision: 2 },
  { key: 'fresnelPower', label: 'Fresnel', min: 0.8, max: 4, step: 0.1, precision: 1 },
  { key: 'chromaticAberration', label: 'Prism Split', min: 0, max: 0.8, step: 0.02, precision: 2 },
  { key: 'ior', label: 'IOR', min: 1.1, max: 1.8, step: 0.01, precision: 2 },
  { key: 'thickness', label: 'Thickness', min: 0, max: 9, step: 0.25, unit: 'px', precision: 2 },
  { key: 'borderRadius', label: 'Radius', min: 4, max: 72, step: 1, unit: 'px', precision: 0 },
  { key: 'tintOpacity', label: 'Tint Opacity', min: 0, max: 0.22, step: 0.005, precision: 3 },
  { key: 'tintStrength', label: 'Tint Strength', min: 0.4, max: 1.6, step: 0.05, precision: 2 },
  { key: 'edgeBlurModifier', label: 'Edge Frost', min: 1, max: 2.2, step: 0.05, precision: 2 },
  { key: 'noiseOpacity', label: 'Micro Texture', min: 0, max: 0.03, step: 0.001, precision: 3 },
  { key: 'lightAngle', label: 'Light Angle', min: -180, max: 180, step: 5, unit: 'deg', precision: 0 },
];

function App() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [userConfig, setUserConfig] = useState<Partial<LiquidGlassConfig>>({});

  const getConfig = useCallback(
    (fixedOverrides: Partial<LiquidGlassConfig> = {}) => ({
      ...GLASS_BASE,
      ...userConfig,
      ...fixedOverrides,
      dynamicLighting: false,
    }),
    [userConfig],
  );

  const getLiveConfig = useCallback(
    (extraOverrides: Partial<LiquidGlassConfig> = {}) => ({
      ...GLASS_BASE,
      ...userConfig,
      ...extraOverrides,
      dynamicLighting: false,
    }),
    [userConfig],
  );

  const handlePerf = useCallback((m: Metrics) => setMetrics(m), []);

  const mergeContainerRef = useRef<HTMLDivElement>(null);
  const tabBarRef = useRef<HTMLDivElement>(null);
  const tabItemsRef = useRef<(HTMLElement | null)[]>([]);
  const liquidGroupRef = useRef<LiquidGroup | null>(null);
  const tabBarCtrlRef = useRef<LiquidTabBar | null>(null);

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
        Avg: {metrics ? `${metrics.avgFrameTime.toFixed(2)}ms` : '-'}<br />
        Frames: {metrics?.frameCount ?? 0}
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

          <LiquidGlass config={getConfig({ borderRadius: 28, chromaticAberration: 0.8, refractionStrength: 35 })} className="glass-panel" animateIn={120} liquidPress>
            <h2>Prismatic</h2>
            <p>High chromatic aberration splits the light like a prism, creating beautiful colorful fringing at the edges.</p>
          </LiquidGlass>

          <LiquidGlass config={getConfig({ borderRadius: 28, blur: 22, tintOpacity: 0.14, edgeBlurModifier: 1.85 })} className="glass-panel" animateIn={240} liquidPress>
            <h2>Frosted</h2>
            <p>Heavy blur and tint opacity with minimal optical distortion. Perfect for modal backdrops and floating panels.</p>
          </LiquidGlass>

          <LiquidGlass config={getConfig({ borderRadius: 28, blur: 2, refractionStrength: 45, tintOpacity: 0.0 })} className="glass-panel" animateIn={360} liquidPress>
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
