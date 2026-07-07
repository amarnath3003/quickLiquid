/**
 * QuickLiquid compare bench — v7 (base) vs v8 (optimized) side by side.
 *
 * Verification protocol lives in packages/quick-liquid/OPTIMIZATION.md §9:
 *   1. Wipe mode + same profile  → pixel-level parity inspection
 *   2. Clear preset              → CA must stay visible; frosted → gated
 *   3. Stress ×N + motion + solo → throughput comparison (FPS / p95)
 */
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import {
  LiquidGlassEngine,
  LiquidGlassEngineOpt,
  MATERIAL_PRESETS,
} from 'quick-liquid';
import type { LiquidGlassOptConfig } from 'quick-liquid';

type EngineKind = 'base' | 'opt';
type Profile = Partial<LiquidGlassOptConfig>;

/* ───────────────────────── profiles ───────────────────────── */

const PROFILE_A_START: Profile = {
  // "clear" — strong lensing, visible chromatic aberration
  blur: 2, saturation: 1.55, refractionStrength: 26, bezelWidth: 36,
  thickness: 26, ior: 1.5, chromaticAberration: 0.3, edgeHighlight: 0.9,
  specularStrength: 0.42, fresnelPower: 2.2, borderRadius: 28,
  tintOpacity: 0.03, lightAngle: -35, quality: 'high', refractionMode: 'svg',
};

const PROFILE_B_START: Profile = {
  // "regular" — frosted; the CA gate should trip here [OPTIMIZATION.md §1]
  blur: 14, saturation: 1.7, refractionStrength: 16, bezelWidth: 30,
  thickness: 20, ior: 1.5, chromaticAberration: 0.3, edgeHighlight: 0.9,
  specularStrength: 0.42, fresnelPower: 2.2, borderRadius: 28,
  tintOpacity: 0.09, lightAngle: -35, quality: 'high', refractionMode: 'svg',
};

interface SliderDef {
  key: keyof Profile;
  label: string;
  min: number;
  max: number;
  step: number;
  precision?: number;
}

const SLIDERS: SliderDef[] = [
  { key: 'blur', label: 'Frost blur', min: 0, max: 32, step: 0.5, precision: 1 },
  { key: 'saturation', label: 'Saturation', min: 1, max: 2.4, step: 0.05, precision: 2 },
  { key: 'refractionStrength', label: 'Refraction', min: 0, max: 64, step: 1 },
  { key: 'bezelWidth', label: 'Bezel width', min: 6, max: 80, step: 1 },
  { key: 'thickness', label: 'Glass depth', min: 2, max: 48, step: 1 },
  { key: 'ior', label: 'IOR', min: 1.1, max: 1.8, step: 0.01, precision: 2 },
  { key: 'chromaticAberration', label: 'Prism split', min: 0, max: 1, step: 0.02, precision: 2 },
  { key: 'edgeHighlight', label: 'Rim light', min: 0, max: 1, step: 0.02, precision: 2 },
  { key: 'specularStrength', label: 'Bezel sheen', min: 0, max: 1, step: 0.02, precision: 2 },
  { key: 'fresnelPower', label: 'Lobe focus', min: 1, max: 5, step: 0.1, precision: 1 },
  { key: 'borderRadius', label: 'Radius', min: 4, max: 72, step: 1 },
  { key: 'tintOpacity', label: 'Tint opacity', min: 0, max: 0.22, step: 0.005, precision: 3 },
  { key: 'lightAngle', label: 'Light angle', min: -180, max: 180, step: 5 },
];

const PRESETS = ['clear', 'thin', 'regular', 'thick', 'ultra'] as const;

/* ───────────────────────── glass card ───────────────────────── */

function GlassCard({
  kind, config, style, children,
}: { kind: EngineKind; config: Profile; style?: CSSProperties; children?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const engineRef = useRef<LiquidGlassEngine | LiquidGlassEngineOpt | null>(null);
  const cfgJson = JSON.stringify(config);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const cfg = JSON.parse(cfgJson) as Profile;
    const engine = kind === 'base'
      ? new LiquidGlassEngine(el, cfg)
      : new LiquidGlassEngineOpt(el, cfg);
    engineRef.current = engine;
    return () => { engine.destroy(); engineRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  useEffect(() => {
    engineRef.current?.updateConfig(JSON.parse(cfgJson) as Profile);
  }, [cfgJson]);

  return (
    <div ref={ref} className="cmp-card" style={style}>
      <div className="ql-content cmp-card-content">{children}</div>
    </div>
  );
}

/* ───────────────────────── backdrop scene ───────────────────────── */

const MARQUEE_COLORS = ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#00c7be', '#007aff', '#5856d6', '#af52de', '#ff2d55', '#1d1d1f'];

function MarqueeContent() {
  return (
    <>
      {MARQUEE_COLORS.map((c, i) => (
        <div key={i} className="cmp-tile" style={{ background: c }}>
          <span>Aa 39</span>
          <span className="tile-dot" />
        </div>
      ))}
    </>
  );
}

function Scene({
  kind, profileA, profileB, stress, label,
}: {
  kind: EngineKind;
  profileA: Profile;
  profileB: Profile;
  stress: number;
  label: string;
}) {
  return (
    <div className="cmp-scene">
      <div className="cmp-backdrop">
        <div className="bd-gradient" />
        <div className="bd-text">liquid<br />glass</div>
        <div className="bd-stripes" />
        <div className="bd-checker" />
        <div className="bd-rings" />
        <div className="cmp-marquee">
          <div className="cmp-marquee-track">
            <MarqueeContent />
            <MarqueeContent />
          </div>
        </div>
      </div>

      <GlassCard kind={kind} config={profileA}
        style={{ position: 'absolute', left: '5%', top: '12%', width: 340, height: 205 }}>
        <div className="card-kicker">Profile A</div>
        <div className="card-title">Clear lens</div>
        <div className="card-row"><span className="chip">Bezel</span><span className="chip">Snell</span><span className="chip">CA</span></div>
      </GlassCard>

      <GlassCard kind={kind} config={profileB}
        style={{ position: 'absolute', left: '42%', top: '50%', width: 320, height: 195 }}>
        <div className="card-kicker">Profile B</div>
        <div className="card-title">Frosted sheet</div>
        <div className="card-row"><span className="chip">Blur</span><span className="chip">Tint</span><span className="chip">Rim</span></div>
      </GlassCard>

      {Array.from({ length: stress }).map((_, i) => (
        <GlassCard key={`s${i}`} kind={kind}
          config={{ ...profileA, borderRadius: 18 }}
          style={{
            position: 'absolute',
            left: `${4 + (i % 6) * 16}%`,
            top: `${76 + Math.floor(i / 6) * 12}%`,
            width: 120, height: 64,
          }}>
          <span className="stress-label">×{i + 1}</span>
        </GlassCard>
      ))}

      <div className="cmp-scene-label">{label}</div>
    </div>
  );
}

/* ───────────────────────── meters ───────────────────────── */

function useFps() {
  const [stats, setStats] = useState({ fps: 0, p95: 0, long: 0 });
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const deltas: number[] = [];
    const loop = (now: number) => {
      const dt = now - last;
      last = now;
      deltas.push(dt);
      if (deltas.length > 120) deltas.shift();
      acc += dt;
      if (acc > 500) {
        acc = 0;
        const sorted = [...deltas].sort((a, b) => a - b);
        const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0;
        const avg = deltas.reduce((s, d) => s + d, 0) / deltas.length;
        setStats({ fps: 1000 / avg, p95, long: deltas.filter(d => d > 25).length });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return stats;
}

interface EngineStats {
  engineCount: number;
  uniqueMaps: number;
  genMs: string;
  extra: string;
}

function collectStats(kind: EngineKind): EngineStats {
  const m = kind === 'base'
    ? LiquidGlassEngine.collectMetrics()
    : LiquidGlassEngineOpt.collectMetrics();
  const genMs = m.engines.reduce((s: number, e: { mapGenMs: number }) => s + (e.mapGenMs || 0), 0);
  let extra = '';
  if (kind === 'opt') {
    const e0 = (m.engines as Array<{ graph?: string; dispTaps?: number; regionCssPx?: number }>)[0];
    if (e0) extra = `graph ${e0.graph} · taps ${e0.dispTaps} · region ${((e0.regionCssPx || 0) / 1000).toFixed(0)}k px`;
  }
  return { engineCount: m.engineCount, uniqueMaps: m.uniqueMaps, genMs: genMs.toFixed(1), extra };
}

/* ───────────────────────── controls ───────────────────────── */

function ProfilePanel({
  name, profile, onChange, isOpt,
}: {
  name: string;
  profile: Profile;
  onChange: (p: Profile) => void;
  isOpt: boolean;
}) {
  const [open, setOpen] = useState(name === 'Profile A');
  return (
    <section className="ctl-section">
      <button className="ctl-heading" onClick={() => setOpen(o => !o)}>
        {name} <span>{open ? '−' : '+'}</span>
      </button>
      {open && (
        <>
          <label className="ctl-row">
            <span>Preset</span>
            <select
              defaultValue=""
              onChange={e => {
                const preset = MATERIAL_PRESETS[e.target.value];
                if (preset) onChange({ ...profile, ...preset });
              }}>
              <option value="" disabled>apply…</option>
              {PRESETS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          {SLIDERS.map(s => {
            const val = (profile[s.key] as number) ?? 0;
            return (
              <label className="ctl-row" key={String(s.key)}>
                <span>{s.label}</span>
                <input type="range" min={s.min} max={s.max} step={s.step} value={val}
                  onChange={e => onChange({ ...profile, [s.key]: Number(e.target.value) })} />
                <em>{val.toFixed(s.precision ?? 0)}</em>
              </label>
            );
          })}
          {isOpt && (
            <>
              <label className="ctl-row">
                <span>v8 CA graph</span>
                <select value={profile.caMode ?? 'fast'}
                  onChange={e => onChange({ ...profile, caMode: e.target.value as 'fast' | 'exact' })}>
                  <option value="fast">fast (2 taps)</option>
                  <option value="exact">exact (v7 graph)</option>
                </select>
              </label>
              <label className="ctl-row check">
                <input type="checkbox" checked={profile.autoGate !== false}
                  onChange={e => onChange({ ...profile, autoGate: e.target.checked })} />
                <span>v8 perceptual gates (§1)</span>
              </label>
              <label className="ctl-row">
                <span>v8 map density</span>
                <select value={profile.mapDensity ? 'v7' : 'auto'}
                  onChange={e => onChange({ ...profile, mapDensity: e.target.value === 'v7' ? 1 : undefined })}>
                  <option value="auto">v8 auto (§6)</option>
                  <option value="v7">v7 (1 px/cell)</option>
                </select>
              </label>
            </>
          )}
        </>
      )}
    </section>
  );
}

/* ───────────────────────── app ───────────────────────── */

export default function App() {
  const [mode, setMode] = useState<'side' | 'wipe'>('side');
  const [solo, setSolo] = useState<'both' | 'base' | 'opt'>('both');
  const [motion, setMotion] = useState(true);
  const [dark, setDark] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [stress, setStress] = useState(0);
  const [wipe, setWipe] = useState(50);
  const [profileA, setProfileA] = useState<Profile>(PROFILE_A_START);
  const [profileB, setProfileB] = useState<Profile>(PROFILE_B_START);
  const [stats, setStatsTick] = useState<{ base: EngineStats; opt: EngineStats } | null>(null);

  const fps = useFps();
  const motionRef = useRef(motion);
  motionRef.current = motion;
  const stageRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  // Single driver for the scrolling backdrop — both panes stay pixel-synced.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let t = 0;
    const ROW = 96;
    const LOOP = MARQUEE_COLORS.length * ROW;
    const loop = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      if (motionRef.current) {
        t = (t + dt * 0.08) % LOOP;
        document.querySelectorAll<HTMLElement>('.cmp-marquee-track').forEach(el => {
          el.style.transform = `translate3d(0, ${(-t).toFixed(2)}px, 0)`;
        });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    document.body.classList.toggle('dark-scene', dark);
  }, [dark]);

  useEffect(() => {
    const id = setInterval(() => {
      setStatsTick({ base: collectStats('base'), opt: collectStats('opt') });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const withGlobals = (p: Profile): Profile => ({
    ...p,
    appearance: dark ? 'dark' : 'light',
    cursorTracking: tracking,
    dynamicLighting: false,
  });

  const cfgA = withGlobals(profileA);
  const cfgB = withGlobals(profileB);

  const onWipeDrag = (clientX: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    setWipe(Math.max(2, Math.min(98, ((clientX - rect.left) / rect.width) * 100)));
  };

  const showBase = solo !== 'opt';
  const showOpt = solo !== 'base';

  return (
    <div className="cmp-app">
      <div
        ref={stageRef}
        className={`cmp-stage ${mode}`}
        onPointerMove={e => { if (draggingRef.current) onWipeDrag(e.clientX); }}
        onPointerUp={() => { draggingRef.current = false; }}
      >
        {mode === 'side' ? (
          <>
            <div className="cmp-half" style={{ display: showBase ? 'block' : 'none' }}>
              <Scene kind="base" profileA={cfgA} profileB={cfgB} stress={stress} label="v7 · base" />
            </div>
            <div className="cmp-half" style={{ display: showOpt ? 'block' : 'none' }}>
              <Scene kind="opt" profileA={cfgA} profileB={cfgB} stress={stress} label="v8 · optimized" />
            </div>
          </>
        ) : (
          <>
            <div className="cmp-layer">
              <Scene kind="base" profileA={cfgA} profileB={cfgB} stress={stress} label="v7 · base" />
            </div>
            <div className="cmp-layer" style={{ clipPath: `inset(0 0 0 ${wipe}%)` }}>
              <Scene kind="opt" profileA={cfgA} profileB={cfgB} stress={stress} label="v8 · optimized" />
            </div>
            <div
              className="cmp-divider"
              style={{ left: `${wipe}%` }}
              onPointerDown={e => {
                draggingRef.current = true;
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
              }}
              onPointerMove={e => { if (draggingRef.current) onWipeDrag(e.clientX); }}
              onPointerUp={() => { draggingRef.current = false; }}
            >
              <span>⟨ v7 | v8 ⟩</span>
            </div>
          </>
        )}

        <div className="cmp-fps">
          <b>{fps.fps.toFixed(0)} fps</b>
          <span>p95 {fps.p95.toFixed(1)} ms</span>
          <span>{fps.long} long frames</span>
          {stats && (
            <>
              <span className="fps-sub">v7: {stats.base.engineCount} eng · {stats.base.uniqueMaps} maps · gen {stats.base.genMs} ms</span>
              <span className="fps-sub">v8: {stats.opt.engineCount} eng · {stats.opt.uniqueMaps} maps · gen {stats.opt.genMs} ms</span>
              {stats.opt.extra && <span className="fps-sub">v8 {stats.opt.extra}</span>}
            </>
          )}
        </div>
      </div>

      <aside className="cmp-rail">
        <h1>QuickLiquid<br /><span>v7 → v8 bench</span></h1>

        <section className="ctl-section">
          <div className="ctl-heading static">View</div>
          <div className="btn-group">
            <button className={mode === 'side' ? 'on' : ''} onClick={() => setMode('side')}>Side by side</button>
            <button className={mode === 'wipe' ? 'on' : ''} onClick={() => setMode('wipe')}>Wipe</button>
          </div>
          {mode === 'side' && (
            <div className="btn-group">
              <button className={solo === 'both' ? 'on' : ''} onClick={() => setSolo('both')}>Both</button>
              <button className={solo === 'base' ? 'on' : ''} onClick={() => setSolo('base')}>v7 solo</button>
              <button className={solo === 'opt' ? 'on' : ''} onClick={() => setSolo('opt')}>v8 solo</button>
            </div>
          )}
          <label className="ctl-row check">
            <input type="checkbox" checked={motion} onChange={e => setMotion(e.target.checked)} />
            <span>Backdrop motion (stress refilter)</span>
          </label>
          <label className="ctl-row check">
            <input type="checkbox" checked={tracking} onChange={e => setTracking(e.target.checked)} />
            <span>Cursor light tracking</span>
          </label>
          <label className="ctl-row check">
            <input type="checkbox" checked={dark} onChange={e => setDark(e.target.checked)} />
            <span>Dark scene</span>
          </label>
          <label className="ctl-row">
            <span>Stress cards</span>
            <input type="range" min={0} max={12} step={1} value={stress}
              onChange={e => setStress(Number(e.target.value))} />
            <em>{stress}</em>
          </label>
        </section>

        <ProfilePanel name="Profile A" profile={profileA} onChange={setProfileA} isOpt />
        <ProfilePanel name="Profile B" profile={profileB} onChange={setProfileB} isOpt />

        <p className="rail-note">
          Wipe with identical profiles = parity check. v8 knobs (CA graph,
          gates, map density) only affect the right/v8 pane — set “exact +
          gates off + v7 density” to make v8 render the literal v7 pipeline.
          Derivations: <code>packages/quick-liquid/OPTIMIZATION.md</code>.
        </p>
      </aside>
    </div>
  );
}
