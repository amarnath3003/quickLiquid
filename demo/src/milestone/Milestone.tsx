import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { LiquidGlass } from 'quick-liquid/react';
import type { LiquidGlassConfig } from 'quick-liquid';
import './milestone.css';

const W = 1080;
const H = 1350;
const CX = W / 2;
const CY = 660;
const DURATION = 22_000;

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const inv = (t: number, a: number, b: number) => clamp((t - a) / (b - a || 1));
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
const smooth = (p: number) => p * p * (3 - 2 * p);
const inOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const outExpo = (p: number) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p));
const px = (v: number) => `${v.toFixed(2)}px`;
const pulse = (t: number, a: number, b: number) => Math.sin(inv(t, a, b) * Math.PI);
const q = (v: number, step: number) => Math.round(v / step) * step;

function spring(p: number, freq = 1.08, damping = 0.54) {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  const w = freq * Math.PI * 2;
  const z = clamp(damping);
  const wd = w * Math.sqrt(Math.max(1e-6, 1 - z * z));
  return 1 - Math.exp(-z * w * p) * (Math.cos(wd * p) + ((z * w) / wd) * Math.sin(wd * p));
}

function fadeWindow(t: number, enterA: number, enterB: number, exitA: number, exitB: number) {
  return smooth(inv(t, enterA, enterB)) * (1 - smooth(inv(t, exitA, exitB)));
}

function Star({ outline = false }: { outline?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path
        d="m12 2.55 2.9 5.88 6.49.94-4.7 4.58 1.11 6.47L12 17.37l-5.8 3.05 1.11-6.47-4.7-4.58 6.49-.94L12 2.55Z"
        fill={outline ? 'none' : 'currentColor'}
        stroke="currentColor"
        strokeWidth={outline ? 0.8 : 0.3}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function useClock(duration: number, autoplay: boolean) {
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(autoplay);
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let previous = performance.now();
    const frame = (now: number) => {
      const next = Math.min(duration, tRef.current + now - previous);
      previous = now;
      setT(next);
      if (next < duration) raf = requestAnimationFrame(frame);
      else setPlaying(false);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [duration, playing]);

  return {
    t,
    playing,
    seek: (value: number) => setT(Math.max(0, Math.min(duration, value))),
    toggle: () => setPlaying((value) => !value),
    restart: () => { setT(0); setPlaying(true); },
  };
}

type Rect = { x: number; y: number; w: number; h: number; r: number; sx: number; sy: number };
const actorTransform = (f: Rect) =>
  `translate(-50%, -50%) scale(${Math.max(0.001, f.sx).toFixed(4)}, ${Math.max(0.001, f.sy).toFixed(4)})`;

const ORBIT = [
  { angle: -2.72, size: 116, lag: 0 },
  { angle: -2.03, size: 88, lag: 110 },
  { angle: -1.22, size: 128, lag: 220 },
  { angle: -0.43, size: 96, lag: 330 },
  { angle: 0.45, size: 118, lag: 440 },
  { angle: 1.28, size: 90, lag: 550 },
  { angle: 2.08, size: 126, lag: 660 },
  { angle: 2.78, size: 98, lag: 770 },
] as const;

function composition(t: number) {
  const ignite = spring(inv(t, 250, 1850), 0.96, 0.62);
  const macroExit = smooth(inv(t, 2900, 3500));
  const orbitIn = spring(inv(t, 3000, 4550), 1.1, 0.55);
  const orbitTurn = inv(t, 3500, 7200) * Math.PI * 0.74;
  const gather = inOut(inv(t, 6900, 8250));
  const bar = spring(inv(t, 7900, 9250), 1.04, 0.5);
  const slab = inOut(inv(t, 10_450, 11_650));
  const collapse = inOut(inv(t, 14_650, 15_650));
  const sweep = inOut(inv(t, 15_450, 18_100));
  const finish = smooth(inv(t, 18_000, 18_750));

  let hero: Rect;
  if (t < 3200) {
    const size = lerp(42, 356, ignite);
    hero = { x: CX, y: CY - 40, w: size, h: size, r: size / 2, sx: 1, sy: 1 };
  } else if (t < 7900) {
    const size = lerp(356, 176, orbitIn);
    hero = { x: CX, y: CY - 10, w: size, h: size, r: size / 2, sx: 1 - macroExit * 0.08, sy: 1 + macroExit * 0.08 };
  } else if (t < 10_450) {
    hero = {
      x: CX, y: CY,
      w: lerp(176, 850, bar), h: lerp(176, 220, bar), r: lerp(88, 110, bar),
      sx: 1 + 0.08 * Math.sin(inv(t, 7900, 8600) * Math.PI) * (1 - bar),
      sy: 1 - 0.14 * Math.sin(inv(t, 7900, 8600) * Math.PI) * (1 - bar),
    };
  } else if (t < 14_650) {
    hero = {
      x: CX, y: lerp(CY, 625, slab),
      w: lerp(850, 900, slab), h: lerp(220, 520, slab), r: lerp(110, 132, slab), sx: 1, sy: 1,
    };
  } else {
    hero = {
      x: lerp(CX, 870, sweep), y: lerp(625, 650, sweep),
      w: lerp(900, 360, collapse), h: lerp(520, 610, collapse), r: lerp(132, 180, collapse),
      sx: lerp(1, 0.001, finish), sy: lerp(1, 0.78, sweep) * lerp(1, 0.001, finish),
    };
  }

  hero = { ...hero, w: q(hero.w, 8), h: q(hero.h, 8), r: q(hero.r, 4) };

  const satellites = ORBIT.map((item, index) => {
    const born = spring(inv(t, 3150 + item.lag, 4150 + item.lag), 1.22, 0.5);
    const theta = item.angle + orbitTurn;
    const radiusX = lerp(120, 380, orbitIn) * (1 - gather);
    const radiusY = lerp(90, 315, orbitIn) * (1 - gather);
    const absorb = 1 - smooth(inv(t, 7850 + index * 24, 8420 + index * 24));
    return {
      x: CX + Math.cos(theta) * radiusX,
      y: CY - 10 + Math.sin(theta) * radiusY,
      w: item.size, h: item.size, r: item.size / 2,
      sx: born * absorb * lerp(1, 0.24, gather), sy: born * absorb * lerp(1, 0.24, gather),
    } as Rect;
  });

  return { hero, satellites, ignite, macroExit, orbitIn, gather, bar, slab, collapse, sweep, finish };
}

const satelliteConfig: Partial<LiquidGlassConfig> = {
  material: 'clear', blur: 2.4, saturation: 1.7, refractionStrength: 26, bezelWidth: 31,
  thickness: 25, ior: 1.52, chromaticAberration: 0.46, edgeHighlight: 1,
  specularStrength: 0.42, fresnelPower: 2, tintOpacity: 0.02, elevation: 1.35,
  appearance: 'dark', quality: 'high', refractionMode: 'svg',
};

export default function Milestone() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const clean = params.get('clean') === '1';
  const clock = useClock(DURATION, params.get('paused') !== '1');
  const [fit, setFit] = useState(1);
  const t = clock.t;
  const c = composition(t);

  useLayoutEffect(() => {
    const resize = () => setFit(Math.min(1, window.innerWidth / W, window.innerHeight / H));
    resize(); window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const seekRef = useRef(clock.seek);
  seekRef.current = clock.seek;
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__MILESTONE__ = {
      duration: DURATION, frame: `${W}x${H}`, seek: (ms: number) => seekRef.current(ms),
    };
    document.body.dataset.milestoneReady = '1';
  }, []);

  const macroCopy = fadeWindow(t, 600, 1250, 2450, 3100);
  const orbitCopy = fadeWindow(t, 3650, 4500, 6500, 7200);
  const numberIn = smooth(inv(t, 8200, 9000));
  const numberOut = 1 - smooth(inv(t, 10_350, 10_850));
  const featureIn = smooth(inv(t, 10_550, 11_350));
  const featureOut = 1 - smooth(inv(t, 14_250, 14_850));
  const titleIn = smooth(inv(t, 15_400, 16_250));
  const titleMask = t < 15_450 ? -300 : lerp(-160, 1280, c.sweep);
  const titleOut = 1 - smooth(inv(t, 18_000, 18_650));
  const endIn = smooth(inv(t, 18_500, 19_300));
  const impact = pulse(t, 8150, 9050);
  const flare = pulse(t, 15_350, 18_250);

  const heroConfig: Partial<LiquidGlassConfig> = {
    material: 'clear', blur: lerp(2, 7, c.slab), saturation: 1.72,
    refractionStrength: lerp(39, 29, c.slab), bezelWidth: lerp(48, 60, c.slab),
    thickness: 32, ior: 1.54, chromaticAberration: lerp(0.58, 0.36, c.slab),
    lightAngle: lerp(-42, 24, c.sweep), edgeHighlight: 1, specularStrength: 0.4,
    fresnelPower: 2.05, tintOpacity: 0.028, borderRadius: c.hero.r, elevation: 1.5,
    appearance: 'dark', quality: 'high', refractionMode: 'svg',
  };

  const frameStyle = { '--film-t': t.toFixed(0), width: px(W), height: px(H), zoom: fit } as CSSProperties;
  const mask = `linear-gradient(90deg, #000 ${titleMask - 36}px, transparent ${titleMask + 36}px)`;

  return (
    <div className="milestone-page">
      <main className="milestone-frame" style={frameStyle}>
        <div className="stage" aria-hidden>
          <i className="base" /><i className="color color-cyan" /><i className="color color-blue" />
          <i className="color color-violet" /><i className="color color-mint" />
          <i className="rings" /><i className="grid" /><i className="horizon" />
          <div className="dispersion dispersion-red" style={{ transform: `translateX(${lerp(-160, 1250, inv(t, 1500, 3100))}px) rotate(15deg)` }} />
          <div className="dispersion dispersion-blue" style={{ transform: `translateX(${lerp(-240, 1180, inv(t, 1600, 3200))}px) rotate(15deg)` }} />

          <div className="macro-scene" style={{ opacity: 1 - c.macroExit }}>
            <div className="macro-star" style={{ opacity: c.ignite, transform: `translate(-50%, -50%) scale(${lerp(0.72, 1, c.ignite)})` }}><Star outline /></div>
            <p className="macro-kicker" style={{ opacity: macroCopy }}>ONE STAR AT A TIME</p>
          </div>

          <div className="orbit-scene" style={{ opacity: orbitCopy }}><p>OPEN SOURCE</p><h2>Made alive<br />by <span>people.</span></h2></div>
          <div className="number-scene" style={{ opacity: numberIn * numberOut }}><p>THE MOMENT IT BECAME</p><h2>200<span>+</span></h2><em>GITHUB STARS</em></div>
          <div className="feature-scene" style={{ opacity: featureIn * featureOut }}>
            <p>NOT A VIDEO EFFECT</p><h2>Glass that<br /><span>bends light.</span></h2>
            <div className="feature-lines"><span>DISPERSION</span><i /><span>SPRING MOTION</span><i /><span>LIQUID MERGE</span></div>
          </div>
          <div className="title-scene" style={{ opacity: titleIn * titleOut, maskImage: mask, WebkitMaskImage: mask }}>
            <p>THANK YOU FOR BUILDING WITH</p><h2>Quick<span>Liquid</span></h2><em>Apple-style liquid glass for React and JavaScript.</em>
          </div>
          <i className="sweep-light" style={{ opacity: flare * 0.68, transform: `translateX(${lerp(-520, 1280, c.sweep)}px) rotate(13deg)` }} />
          <i className="impact-ring" style={{ opacity: impact * 0.76, transform: `translate(-50%, -50%) scale(${lerp(0.2, 4.6, outExpo(inv(t, 8150, 9050)))})` }} />
        </div>

        <div className="bridges" style={{ opacity: c.gather * (1 - c.bar) }} aria-hidden>
          {c.satellites.map((f, index) => {
            const dx = CX - f.x; const dy = CY - f.y; const length = Math.hypot(dx, dy);
            return <i key={index} style={{ left: px(f.x), top: px(f.y), width: px(length), transform: `rotate(${Math.atan2(dy, dx)}rad) scaleX(${c.gather})` }} />;
          })}
        </div>

        <LiquidGlass className="glass hero-glass" config={heroConfig} animateIn={false}
          style={{ left: px(c.hero.x), top: px(c.hero.y), width: px(c.hero.w), height: px(c.hero.h), borderRadius: px(c.hero.r), transform: actorTransform(c.hero) }}>
          <div className="hero-star" style={{ opacity: (1 - c.orbitIn) * (1 - c.bar) }}><Star outline /></div>
          <div className="glass-ui" style={{ opacity: featureIn * featureOut }}>
            <div className="ui-top"><i /><span>QUICKLIQUID / OPTICS</span><em>LIVE</em></div>
            <div className="ui-body"><span className="ui-orb" /><div><strong>dispersion</strong><small>IOR 1.54 · RGB SPLIT 0.58</small></div></div>
            <div className="ui-tabs"><span>clear</span><span>thin</span><span className="active">regular</span><span>thick</span></div>
          </div>
        </LiquidGlass>

        {c.satellites.map((f, index) => (
          <LiquidGlass key={index} className="glass satellite" config={{ ...satelliteConfig, borderRadius: f.r }} animateIn={false}
            style={{ left: px(f.x), top: px(f.y), width: px(f.w), height: px(f.h), transform: actorTransform(f) }}>
            <div className="sat-star" style={{ transform: `rotate(${ORBIT[index].angle * 24}deg)` }}><Star /></div>
          </LiquidGlass>
        ))}

        <section className="end-card" style={{ opacity: endIn }}>
          <div className="end-star"><Star /></div><h2>200<span>+</span></h2><p>GitHub stars</p><i /><strong>Thank you.</strong><small>github.com/amarnath3003/quickLiquid</small>
        </section>
        <i className="vignette" aria-hidden /><i className="film-grain" aria-hidden />
        <i className="flash" style={{ opacity: impact * 0.16 + pulse(t, 15_350, 15_900) * 0.1 }} aria-hidden />
      </main>

      {!clean && <div className="controls"><button onClick={clock.toggle}>{clock.playing ? 'Pause' : 'Play'}</button><button onClick={clock.restart}>Restart</button><input type="range" min={0} max={DURATION} value={Math.round(t)} onChange={(e) => clock.seek(Number(e.target.value))} /><code>{(t / 1000).toFixed(2)}s</code></div>}
    </div>
  );
}
