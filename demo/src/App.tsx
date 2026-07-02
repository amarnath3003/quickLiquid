import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { LiquidGlass } from 'quick-liquid/react';
import type { LiquidGlassConfig } from 'quick-liquid';
import { LiquidGroup, LiquidGesture, LiquidTabBar } from 'quick-liquid';

interface Metrics { avgFrameTime: number; lastFrameTime: number; frameCount: number; quality: string; }

const GLASS_BASE: Partial<LiquidGlassConfig> = {
  blur: 24,
  saturation: 1.8,
  refractionStrength: 18,
  edgeHighlight: 0.4,
  specularStrength: 0.3,
  chromaticAberration: 0.05,
  thickness: 2,
  // Bug fix #8: include borderRadius so slider shows a real default
  borderRadius: 28,
  dynamicLighting: false,
  tintOpacity: 0.15,
  ior: 1.45,
  lightAngle: -60,
  quality: 'high',
  refractionMode: 'auto',
  tint: '255,255,255',
};

function App() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [userConfig, setUserConfig] = useState<Partial<LiquidGlassConfig>>({});

  // Bug fix #4: restructure config merging.
  //
  // Problem: previously localOverrides spread LAST, so showcase card hardcoded
  // values (e.g. blur:2 for Crystal Clear, blur:40 for Frosted) always won over
  // whatever the user set with sliders, making sliders appear broken on those cards.
  //
  // Fix strategy:
  //   getConfig(fixedOverrides)  → used for showcase cards whose identity depends
  //                                on specific values; those properties are always
  //                                locked. The user slider CANNOT change them.
  //   getBaseConfig()            → used for the Live Preview box and nav — fully
  //                                responds to every slider.
  //
  // Spread order:  GLASS_BASE  <  userConfig  <  fixedOverrides
  // fixedOverrides should only set the ONE or TWO properties that define the card's
  // showcase identity (e.g. blur, chromaticAberration) and leave the rest to the
  // user's slider values.
  const getConfig = useCallback(
    (fixedOverrides: Partial<LiquidGlassConfig> = {}) => ({
      ...GLASS_BASE,
      ...userConfig,
      ...fixedOverrides,
      dynamicLighting: false,
    }),
    [userConfig],
  );

  // Convenience: fully slider-driven config with no overrides (for Live Preview)
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

  // We need a stable reference to the slider config for displaying current values.
  // Read directly from GLASS_BASE + userConfig (no overrides)
  const sliderValues = useMemo(
    () => ({ ...GLASS_BASE, ...userConfig }),
    [userConfig],
  );

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

      {/* Perf HUD */}
      <LiquidGlass config={getLiveConfig({ borderRadius: 12 })} className="perf-hud">
        <strong>Perf</strong><br />
        Avg: {metrics ? `${metrics.avgFrameTime.toFixed(2)}ms` : '—'}<br />
        Frames: {metrics?.frameCount ?? 0}
      </LiquidGlass>

      <div className="demo-container">
        <div className="demo-header">
          <h1>Quick Liquid</h1>
          <p>Production-quality liquid glass for the web.</p>
        </div>

        {/* Nav bar */}
        <LiquidGlass
          config={getLiveConfig({ borderRadius: 50 })}
          className="glass-nav"
          onPerformanceUpdate={handlePerf}
          liquidPress
        >
          <span className="nav-brand">QuickLiquid</span>
          <span>Home</span><span>Docs</span><span>API</span><span>GitHub</span>
        </LiquidGlass>

        {/* Hero pill */}
        <div className="hero-scene">
          <div className="hero-bg-text" aria-hidden="true">Liquid Glass</div>
          <LiquidGlass config={getLiveConfig({ borderRadius: 999 })} className="glass-hero-pill" animateIn={200} />
        </div>

        <div className="section-header">
          <h2>Liquid Animations</h2>
          <p>Spring physics, merging blobs, gesture response.</p>
        </div>

        {/* Tab bar */}
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

        {/* Merge demo */}
        <div className="merge-demo">
          <h3>Water Droplet Merge</h3>
          <p>Drag the glass blobs close together.</p>
          <div className="merge-container" ref={mergeContainerRef}>
            {['A','B','C'].map(l => (
              <LiquidGlass key={l} config={getConfig({ borderRadius: 999 })} className="merge-blob" liquidPress>
                <span>{l}</span>
              </LiquidGlass>
            ))}
          </div>
        </div>

        {/* Spring buttons */}
        <div className="spring-buttons-demo">
          <h3>Liquid Buttons</h3>
          <p>Press and hold — spring physics.</p>
          <div className="button-row">
            <LiquidGlass config={getConfig({ borderRadius: 50 })} className="glass-btn" liquidPress animateIn={0}>Bouncy</LiquidGlass>
            <LiquidGlass config={getConfig({ borderRadius: 14 })} className="glass-btn" liquidPress={{ scale: 0.88, squish: 0.04 }} animateIn={100}>Squishy</LiquidGlass>
            <LiquidGlass config={getConfig({ borderRadius: 50 })} className="glass-btn" liquidPress={{ scale: 0.96, squish: 0.01 }} animateIn={200}>Prismatic</LiquidGlass>
          </div>
        </div>

        {/* Showcase cards — each locks ONLY its identity-defining properties.
             All other properties (blur, saturation, etc.) respond to sliders. */}
        <div className="demo-grid">
          {/* Default: fully slider-driven */}
          <LiquidGlass config={getLiveConfig({ borderRadius: 28 })} className="glass-panel" animateIn={0} liquidPress>
            <h2>Liquid Glass</h2>
            <p>The standard Apple-like default. Deep frosted blur, subtle edge highlights, and pure optical refraction.</p>
          </LiquidGlass>

          {/* Prismatic: locks CA and refraction — slider blur/saturation still applies */}
          <LiquidGlass config={getConfig({ borderRadius: 28, chromaticAberration: 0.8, refractionStrength: 35 })} className="glass-panel" animateIn={120} liquidPress>
            <h2>Prismatic</h2>
            <p>High chromatic aberration splits the light like a prism, creating beautiful colorful fringing at the edges.</p>
          </LiquidGlass>

          {/* Frosted: locks blur and tint — slider saturation/refraction still applies */}
          <LiquidGlass config={getConfig({ borderRadius: 28, blur: 40, tintOpacity: 0.35 })} className="glass-panel" animateIn={240} liquidPress>
            <h2>Frosted</h2>
            <p>Heavy blur and tint opacity with minimal optical distortion. Perfect for modal backdrops and floating panels.</p>
          </LiquidGlass>

          {/* Crystal Clear: locks blur and tint — slider CA/specular/edgeHighlight still applies */}
          <LiquidGlass config={getConfig({ borderRadius: 28, blur: 2, refractionStrength: 45, tintOpacity: 0.0 })} className="glass-panel" animateIn={360} liquidPress>
            <h2>Crystal Clear</h2>
            <p>Almost zero blur but massive refraction and intense specular highlights. Looks like a polished, heavy piece of crystal.</p>
          </LiquidGlass>
        </div>

        {/* Controls Section */}
        <div className="controls-section">
          <LiquidGlass config={getLiveConfig({ borderRadius: 24 })} className="controls">
            <h3>Live Configuration</h3>
            <div className="slider-row">
              <label>Blur</label>
              <input type="range" min="0" max="60" step="0.5" value={sliderValues.blur ?? 24}
                onInput={e => setUserConfig(c => ({ ...c, blur: +(e.target as HTMLInputElement).value }))} />
              <span className="value">{sliderValues.blur}px</span>
            </div>
            <div className="slider-row">
              <label>Saturation</label>
              <input type="range" min="1.0" max="2.5" step="0.05" value={sliderValues.saturation ?? 1.8}
                onInput={e => setUserConfig(c => ({ ...c, saturation: +(e.target as HTMLInputElement).value }))} />
              <span className="value">{sliderValues.saturation?.toFixed(2)}</span>
            </div>
            <div className="slider-row">
              <label>Edge Highlight</label>
              <input type="range" min="0" max="1" step="0.05" value={sliderValues.edgeHighlight ?? 0.4}
                onInput={e => setUserConfig(c => ({ ...c, edgeHighlight: +(e.target as HTMLInputElement).value }))} />
              <span className="value">{sliderValues.edgeHighlight?.toFixed(2)}</span>
            </div>
            <div className="slider-row">
              <label>Specular</label>
              <input type="range" min="0" max="1" step="0.05" value={sliderValues.specularStrength ?? 0.3}
                onInput={e => setUserConfig(c => ({ ...c, specularStrength: +(e.target as HTMLInputElement).value }))} />
              <span className="value">{sliderValues.specularStrength?.toFixed(2)}</span>
            </div>
            <div className="slider-row">
              <label>Chromatic Aberr.</label>
              <input type="range" min="0" max="1" step="0.05" value={sliderValues.chromaticAberration ?? 0.05}
                onInput={e => setUserConfig(c => ({ ...c, chromaticAberration: +(e.target as HTMLInputElement).value }))} />
              <span className="value">{sliderValues.chromaticAberration?.toFixed(2)}</span>
            </div>
            <div className="slider-row">
              <label>Border Radius</label>
              {/* Bug fix #8: default fallback to 28 so slider always shows a number */}
              <input type="range" min="4" max="64" step="1" value={sliderValues.borderRadius ?? 28}
                onInput={e => setUserConfig(c => ({ ...c, borderRadius: +(e.target as HTMLInputElement).value }))} />
              <span className="value">{sliderValues.borderRadius ?? 28}px</span>
            </div>
            <div className="slider-row">
              <label>Shadow Depth</label>
              <input type="range" min="0" max="16" step="1" value={sliderValues.thickness ?? 2}
                onInput={e => setUserConfig(c => ({ ...c, thickness: +(e.target as HTMLInputElement).value }))} />
              <span className="value">{sliderValues.thickness ?? 2}px</span>
            </div>
            <div className="slider-row">
              <label>Tint Opacity</label>
              <input type="range" min="0" max="0.40" step="0.005" value={sliderValues.tintOpacity ?? 0.15}
                onInput={e => setUserConfig(c => ({ ...c, tintOpacity: +(e.target as HTMLInputElement).value }))} />
              <span className="value">{(sliderValues.tintOpacity ?? 0.15).toFixed(3)}</span>
            </div>
            <div className="slider-row">
              <label>Refraction</label>
              <input type="range" min="0" max="60" step="1" value={sliderValues.refractionStrength ?? 18}
                onInput={e => setUserConfig(c => ({ ...c, refractionStrength: +(e.target as HTMLInputElement).value }))} />
              <span className="value">{sliderValues.refractionStrength}</span>
            </div>
          </LiquidGlass>

          {/* Live Preview Box — fully slider-driven, no fixed overrides */}
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
