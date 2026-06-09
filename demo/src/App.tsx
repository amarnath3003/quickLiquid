import { useState, useCallback, useRef, useEffect } from 'react';
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
  const [config, setConfig] = useState<Partial<LiquidGlassConfig>>({
    ...GLASS_BASE,
    borderRadius: 32,
  });

  const handlePerf = useCallback((m: Metrics) => setMetrics(m), []);

  const mergeContainerRef = useRef<HTMLDivElement>(null);
  const tabBarRef = useRef<HTMLDivElement>(null);
  const tabItemsRef = useRef<(HTMLElement | null)[]>([]);
  const liquidGroupRef = useRef<LiquidGroup | null>(null);
  const tabBarCtrlRef = useRef<LiquidTabBar | null>(null);

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
      <LiquidGlass config={{ ...config, borderRadius: 12 }} className="perf-hud">
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
          config={{ ...config, borderRadius: 50 }}
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
          <LiquidGlass config={{ ...config, borderRadius: 999 }} className="glass-hero-pill" animateIn={200} />
        </div>

        <div className="section-header">
          <h2>Liquid Animations</h2>
          <p>Spring physics, merging blobs, gesture response.</p>
        </div>

        {/* Tab bar */}
        <div className="tab-bar-demo">
          <LiquidGlass config={{ ...config, borderRadius: 50 }} className="glass-tab-bar">
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
              <LiquidGlass key={l} config={{ ...config, borderRadius: 999 }} className="merge-blob" liquidPress>
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
            <LiquidGlass config={{ ...config, borderRadius: 50 }} className="glass-btn" liquidPress animateIn={0}>Bouncy</LiquidGlass>
            <LiquidGlass config={{ ...config, borderRadius: 14 }} className="glass-btn" liquidPress={{ scale: 0.88, squish: 0.04 }} animateIn={100}>Squishy</LiquidGlass>
            <LiquidGlass config={{ ...config, borderRadius: 50 }} className="glass-btn" liquidPress={{ scale: 0.96, squish: 0.01 }} animateIn={200}>Prismatic</LiquidGlass>
          </div>
        </div>

        {/* Showcase cards */}
        <div className="demo-grid">
          <LiquidGlass config={{ ...config, borderRadius: 28 }} className="glass-panel" animateIn={0} liquidPress>
            <h2>Liquid Glass</h2>
            <p>Pure glass — the scene shows through completely. Defined by a crisp rim, thin specular streak, and subtle edge highlights.</p>
          </LiquidGlass>

          <LiquidGlass config={{ ...config, borderRadius: 28 }} className="glass-panel" animateIn={120} liquidPress>
            <h2>Prismatic</h2>
            <p>Pure glass — the scene shows through completely. Defined by a crisp rim, thin specular streak, and subtle edge highlights.</p>
          </LiquidGlass>

          <LiquidGlass config={{ ...config, borderRadius: 28 }} className="glass-panel" animateIn={240} liquidPress>
            <h2>Frosted</h2>
            <p>Pure glass — the scene shows through completely. Defined by a crisp rim, thin specular streak, and subtle edge highlights.</p>
          </LiquidGlass>

          <LiquidGlass config={{ ...config, borderRadius: 28 }} className="glass-panel" animateIn={360} liquidPress>
            <h2>Crystal Clear</h2>
            <p>Pure glass — the scene shows through completely. Defined by a crisp rim, thin specular streak, and subtle edge highlights.</p>
          </LiquidGlass>
        </div>

        {/* Controls */}
        <LiquidGlass config={{ ...config, borderRadius: 24 }} className="controls" liquidPress>
          <h3>Live Configuration</h3>
          <div className="slider-row">
            <label>Blur</label>
            <input type="range" min="0" max="40" step="0.5" value={config.blur}
              onChange={e => setConfig(c => ({ ...c, blur: +e.target.value }))} />
            <span className="value">{config.blur}px</span>
          </div>
          <div className="slider-row">
            <label>Saturation</label>
            <input type="range" min="1.0" max="2.5" step="0.05" value={config.saturation}
              onChange={e => setConfig(c => ({ ...c, saturation: +e.target.value }))} />
            <span className="value">{config.saturation?.toFixed(2)}</span>
          </div>
          <div className="slider-row">
            <label>Edge Highlight</label>
            <input type="range" min="0" max="1" step="0.05" value={config.edgeHighlight}
              onChange={e => setConfig(c => ({ ...c, edgeHighlight: +e.target.value }))} />
            <span className="value">{config.edgeHighlight?.toFixed(2)}</span>
          </div>
          <div className="slider-row">
            <label>Specular</label>
            <input type="range" min="0" max="1" step="0.05" value={config.specularStrength}
              onChange={e => setConfig(c => ({ ...c, specularStrength: +e.target.value }))} />
            <span className="value">{config.specularStrength?.toFixed(2)}</span>
          </div>
          <div className="slider-row">
            <label>Chromatic Aberr.</label>
            <input type="range" min="0" max="1" step="0.05" value={config.chromaticAberration}
              onChange={e => setConfig(c => ({ ...c, chromaticAberration: +e.target.value }))} />
            <span className="value">{config.chromaticAberration?.toFixed(2)}</span>
          </div>
          <div className="slider-row">
            <label>Border Radius</label>
            <input type="range" min="4" max="64" step="1" value={config.borderRadius}
              onChange={e => setConfig(c => ({ ...c, borderRadius: +e.target.value }))} />
            <span className="value">{config.borderRadius}px</span>
          </div>
          <div className="slider-row">
            <label>Shadow Depth</label>
            <input type="range" min="0" max="16" step="1" value={config.thickness}
              onChange={e => setConfig(c => ({ ...c, thickness: +e.target.value }))} />
            <span className="value">{config.thickness}px</span>
          </div>
          <div className="slider-row">
            <label>Tint Opacity</label>
            <input type="range" min="0" max="0.20" step="0.005" value={config.tintOpacity}
              onChange={e => setConfig(c => ({ ...c, tintOpacity: +e.target.value }))} />
            <span className="value">{config.tintOpacity?.toFixed(3)}</span>
          </div>
          <div className="slider-row">
            <label>Refraction</label>
            <input type="range" min="0" max="50" step="1" value={config.refractionStrength}
              onChange={e => setConfig(c => ({ ...c, refractionStrength: +e.target.value }))} />
            <span className="value">{config.refractionStrength}</span>
          </div>
        </LiquidGlass>
      </div>
    </>
  );
}

export default App;
