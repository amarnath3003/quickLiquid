import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LiquidGlassEngine, DEFAULT_CONFIG, MATERIAL_PRESETS, type LiquidGlassConfig } from 'quick-liquid';
import { LiquidGlass } from 'quick-liquid/react';
import '@fontsource-variable/outfit';
import '@fontsource-variable/jetbrains-mono';
import './material-lab.css';

type Scene = 'spectrum' | 'video' | 'photo' | 'type' | 'lines' | 'contrast';
type Shape = 'card' | 'pill' | 'circle';

const SCENES: { id: Scene; label: string; note: string }[] = [
  { id: 'spectrum', label: 'Color', note: 'Broad color boundaries reveal bending and dispersion.' },
  { id: 'video', label: 'Video', note: 'Stock pool footage tests refraction while highlights and reflections move.' },
  { id: 'photo', label: 'Photo', note: 'Architecture, water, foliage, and hard edges test natural detail.' },
  { id: 'type', label: 'Typography', note: 'Large and small text expose blur, doubling, and center drift.' },
  { id: 'lines', label: 'Fine lines', note: 'A calibration grid makes edge displacement easy to inspect.' },
  { id: 'contrast', label: 'Contrast', note: 'Black, white, and color bars stress tint and rim visibility.' },
];

function Lab() {
  const [dark, setDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);
  const [scene, setScene] = useState<Scene>('spectrum');
  const [shape, setShape] = useState<Shape>('card');
  const [material, setMaterial] = useState('clear');
  const [overrides, setOverrides] = useState<Partial<LiquidGlassConfig>>({});
  const [motion, setMotion] = useState(false);
  const [copied, setCopied] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const engine = useRef<LiquidGlassEngine | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const offset = useRef({ x: 0, y: 0 });
  const pointer = useRef<{ id: number; x: number; y: number; ox: number; oy: number } | null>(null);
  const lensRadius = shape === 'card' ? 44 : 999;
  const effective = { ...DEFAULT_CONFIG, ...MATERIAL_PRESETS[material], ...overrides };
  const config: Partial<LiquidGlassConfig> = {
    ...effective,
    material: material as LiquidGlassConfig['material'], borderRadius: lensRadius,
    appearance: dark ? 'dark' : 'light', cursorTracking: true,
    ...overrides, refractionMode: 'auto',
  };
  const configStr = JSON.stringify(config);

  useEffect(() => {
    if (!host.current) return;
    const e = new LiquidGlassEngine(host.current, JSON.parse(configStr));
    engine.current = e;
    return () => { e.destroy(); engine.current = null; };
  }, []);
  useEffect(() => {
    const e = engine.current;
    if (e) e.setConfig(JSON.parse(configStr));
  }, [configStr]);
  useEffect(() => setCopied(false), [configStr]);
  useEffect(() => {
    const media = video.current;
    if (!media) return;
    if (scene === 'video' && motion && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      void media.play().catch(() => setMotion(false));
    } else media.pause();
  }, [scene, motion]);

  const move = (x: number, y: number) => {
    if (!host.current || !stage.current) return;
    const maxX = Math.max(0, (stage.current.clientWidth - host.current.offsetWidth) / 2 - 12);
    const maxY = Math.max(0, (stage.current.clientHeight - host.current.offsetHeight) / 2 - 12);
    offset.current = { x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) };
    host.current.style.translate = `${offset.current.x}px ${offset.current.y}px`;
  };
  const reset = () => { setOverrides({}); setMaterial('clear'); setShape('card'); move(0, 0); };
  const snippet = `config={{\n  material: '${material}',\n  borderRadius: ${lensRadius},\n${Object.entries(overrides).map(([k,v]) => `  ${k}: ${JSON.stringify(v)},\n`).join('')}  appearance: '${dark ? 'dark' : 'light'}',\n}}`;
  const sceneNote = SCENES.find(item => item.id === scene)!.note;

  return <div className="lab" data-theme={dark ? 'dark' : 'light'}>
    <nav className="lab-nav"><a href="/">quickLiquid<span> / playground</span></a><div><a href="/docs/">Docs</a><button onClick={() => setDark(!dark)}>{dark ? 'Light' : 'Dark'} appearance</button></div></nav>
    <main>
      <header className="lab-intro"><p>One playground. Real optics.</p><h1>See what the lens sees.</h1><p>Move one live lens across video, photography, type, color, and calibration scenes. Then copy the result.</p></header>
      <div className="lab-workbench">
        <section className="lab-preview" aria-label="Material preview">
          <div className="lab-toolbar"><div role="group" aria-label="Backdrop">{SCENES.map(item => <button key={item.id} aria-pressed={scene === item.id} onClick={() => { setScene(item.id); if (item.id === 'video') setMotion(true); }}>{item.label}</button>)}</div><button aria-pressed={motion} onClick={() => setMotion(!motion)}>{motion ? 'Pause scene' : scene === 'video' ? 'Play video' : 'Move scene'}</button></div>
          <p className="lab-scene-meta" aria-live="polite"><span>{sceneNote}</span>{scene === 'video' && <a href="https://www.pexels.com/video/sunlight-over-building-and-swimming-pool-in-city-11157345/" target="_blank" rel="noreferrer">Video by Atif Dar on Pexels</a>}</p>
          <div className={`lab-stage lab-stage--${scene}${motion ? ' is-moving' : ''}`} ref={stage}>
            <div className="lab-scenery" aria-hidden="true"><div className="lab-spectrum"/><video ref={video} className="lab-media" src="/stock-pool.mp4" poster="/stock-pool-poster.jpg" muted loop playsInline preload="metadata"/><img className="lab-photo" src="/playground-coast.webp" alt=""/><div className="lab-lines"><span>1 px</span><span>8 px</span><span>24 px</span></div><div className="lab-contrast"><span>Aa</span><span>Aa</span><i/></div><div className="lab-type"><b>Refraction<br/><span>stays readable.</span></b><div><small>ABCDEFG 0123456789</small><p>Edges should bend. The quiet center should hold every letter in place.</p></div></div><span className="lab-scene-word">liquid</span></div>
            <div className={`lab-lens lab-lens--${shape}`} ref={host} tabIndex={0} role="group" aria-label="Draggable glass lens. Use arrow keys to move."
              onPointerDown={e => { if (e.button !== 0) return; pointer.current = { id: e.pointerId, x: e.clientX, y: e.clientY, ox: offset.current.x, oy: offset.current.y }; e.currentTarget.setPointerCapture(e.pointerId); }}
              onPointerMove={e => { const p = pointer.current; if (p?.id === e.pointerId) move(p.ox + e.clientX - p.x, p.oy + e.clientY - p.y); }}
              onPointerUp={() => { pointer.current = null; }} onPointerCancel={() => { pointer.current = null; }}
              onKeyDown={e => { const delta: Record<string, [number, number]> = { ArrowLeft: [-16,0], ArrowRight: [16,0], ArrowUp: [0,-16], ArrowDown: [0,16] }; if (delta[e.key]) { e.preventDefault(); const [x,y] = delta[e.key]; move(offset.current.x + x, offset.current.y + y); } }}>
              <div className="ql-content"><div className="lab-lens-label"><span className="lab-lens-symbol" aria-hidden="true">↗</span><div><strong>{material.charAt(0).toUpperCase() + material.slice(1)} glass</strong><span>The world comes through.</span></div></div></div>
            </div>
          </div>
          <div className="lab-caption"><span>Drag the lens or use arrow keys.</span><button onClick={() => move(0,0)}>Recenter</button></div>
        </section>
        <aside className="lab-controls" aria-label="Material controls"><div className="lab-control-title"><h2>Make it yours.</h2><button onClick={reset}>Reset</button></div>
          <div className="lab-shapes"><span>Lens shape</span><div role="group" aria-label="Lens shape">{(['card','pill','circle'] as const).map(value => <button key={value} aria-pressed={shape === value} onClick={() => { setShape(value); move(0, 0); }}>{value}</button>)}</div></div>
          <div className="lab-materials" role="group" aria-label="Material">{['clear','thin','regular','thick'].map(m => <button key={m} aria-pressed={material === m} onClick={() => { setMaterial(m); setOverrides({}); }}>{m}</button>)}</div>
          {([
            ['blur','Frost',0,30,.5,'px'], ['refractionStrength','Refraction',0,50,1,'px'], ['bezelWidth','Bezel',8,60,1,'px'],
            ['chromaticAberration','Dispersion',0,1,.01,''], ['lightAngle','Light direction',-180,180,1,'°'], ['specularStrength','Surface reflection',0,1,.01,''],
          ] as const).map(([key,label,min,max,step,unit]) => <label className="lab-slider" key={key}><span>{label}<output>{Number(effective[key]).toFixed(step < 1 ? 2 : 0)}{unit}</output></span><input type="range" aria-label={label} min={min} max={max} step={step} value={effective[key]} onChange={e => setOverrides(o => ({ ...o, [key]: Number(e.target.value) }))}/></label>)}
          <label className="lab-check"><input type="checkbox" checked={overrides.dispersionMode === 'exact'} onChange={e => setOverrides(o => ({...o, dispersionMode: e.target.checked ? 'exact' : 'auto'}))}/> Always use exact dispersion</label>
          <p className="lab-note">Automatic mode skips color splitting under heavy frost. Clear glass retains exact RGB sampling.</p>
          <div className="lab-export"><div><span>React configuration</span><button onClick={async () => { try { await navigator.clipboard.writeText(snippet); setCopied(true); } catch { setCopied(false); } }}>{copied ? 'Copied' : 'Copy'}</button></div><pre>{snippet}</pre></div>
        </aside>
      </div>
      <section className="lab-proof"><div><p>Built to be seen, not babysat.</p><h2>One lens. The scenes that expose everything.</h2></div><dl>
        <div><dt>6</dt><dd>real-world scenes</dd><small>Motion, type, photography, color, contrast, and one-pixel lines.</small></div>
        <div><dt>4</dt><dd>tuned materials</dd><small>Clear through thick, ready to use and easy to shape.</small></div>
        <div><dt>0</dt><dd>pre-rendered mockups</dd><small>Every lens on this page is live, draggable, and yours to tune.</small></div>
      </dl></section>
      <section className="lab-material-strip" aria-label="Material family">{['clear','regular','thick'].map(m => <div key={m}><div className="lab-swatch"><LiquidGlass config={{material: m as LiquidGlassConfig['material'], appearance: dark ? 'dark' : 'light', borderRadius: 30}}><span>{m}</span></LiquidGlass></div><p>{m === 'clear' ? 'A view through the material.' : m === 'regular' ? 'Separation for everyday controls.' : 'More privacy, more scattering.'}</p></div>)}</section>
    </main><footer className="lab-footer"><a href="/">Back to quickLiquid</a><p>Independent web optics inspired by Liquid Glass. Browser rendering and performance vary.</p></footer>
  </div>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><Lab/></React.StrictMode>);
