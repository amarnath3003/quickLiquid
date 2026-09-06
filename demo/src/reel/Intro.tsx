/**
 * Intro.tsx — "Liquid", the opening title sequence for the QuickLiquid reel.
 *
 * Nothing here is faked. Every glass surface is a real <LiquidGlass> driven by
 * LiquidGlassEngine, and everything it bends — the colour field, the concentric
 * rings, the grid, the wordmark itself — is live page content sitting behind it
 * in the backdrop. When the lens crosses the title, those letters are being
 * displaced by an SVG map generated from the bezel geometry.
 *
 *   SHOT LIST                                        see BEATS in ./timeline
 *   0.0s  black; a point of light flares and colour floods the frame
 *   1.3s  five droplets of glass rain onto the seam, each landing with a ripple
 *   3.1s  they slide into a row of five materials, touching
 *   4.3s  THE FUSE — they collapse and one bar snaps open across the frame
*   4.9s  the bar winds back left, then crosses frame developing the wordmark
 *   7.3s  the lockup resolves — title lifts, install pill, glass dock
 *   9.4s  a light bar rakes across; all five surfaces refract it at once
 *  10.8s  the end composition breathes and holds
 *
 * ── Chromium rules this file obeys (see VISUAL_QA_HANDOFF.md §3) ────────────
 * `opacity`, `filter`, `mask`, `mix-blend-mode` and `isolation` NEVER appear on
 * a glass host or on any of its ancestors — each creates a backdrop root and
 * silently kills the refraction while leaving the blur intact, so the failure
 * looks like success. Glass is therefore animated with transform, width/height
 * and engine config only; anything that fades does so on a sibling inside
 * .stage, or on a child inside .ql-content.
 *
 * The cast is FIXED for the whole film — five actors, stable React keys, never
 * unmounted. An actor changes role (droplet, then material card, then dock
 * item) by moving and resizing, never by being replaced, because a remount
 * throws away the engine's displacement map and hitches on the exact frame the
 * shot needs to land.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { LiquidGlass } from 'quick-liquid/react';
import type { LiquidGlassConfig } from 'quick-liquid';
import {
  BEATS,
  DURATION,
  beatAt,
  clamp01,
  easeInCubic,
  easeInOutCubic,
  easeInOutSine,
  easeInQuad,
  easeOutExpo,
  formatTime,
  inv,
  lerp,
  q,
  ring,
  seg,
  smoothstep,
  spike,
  spring,
} from './timeline';
import './reel.css';

/** Composed at a fixed 1920x1080, fitted to the viewport for review. */
const FRAME_W = 1920;
const FRAME_H = 1080;
const CX = FRAME_W / 2;
const CY = FRAME_H / 2;

/** The single frame where five droplets become one bar. Everything hangs off it. */
const FUSE_AT = 4300;

/* The sweep. The lens starts off the left edge so that its leading bezel — and
   therefore the wipe edge derived from it — is still short of the first letter
   when the move begins. */
const SWEEP_START = 5350;
const SWEEP_END = 7100;
const SWEEP_FROM = 150;
const SWEEP_TO = 1580;
const SWEEP_W = 560;

/* ══════════════════════════════════════════════════════════════════════════
   THE CAST — four supporting actors plus the hero, fixed for the whole film
   ══════════════════════════════════════════════════════════════════════════ */

interface Role {
  key: string;
  /** A real preset, so the rain is showing the library's actual materials. */
  material: 'clear' | 'thin' | 'thick' | 'ultra';
  /** rain */
  dropX: number;
  dropSize: number;
  fallAt: number;
  /** fuse — where it queues up in the row of five before the collapse */
  rowX: number;
  /** settle */
  dockX: number;
}

const CAST: Role[] = [
  { key: 'clear', material: 'clear', dropX: 440, dropSize: 120, fallAt: 1480, rowX: 718, dockX: 714 },
  { key: 'thin', material: 'thin', dropX: 700, dropSize: 108, fallAt: 1660, rowX: 832, dockX: 878 },
  { key: 'thick', material: 'thick', dropX: 1220, dropSize: 108, fallAt: 1840, rowX: 1088, dockX: 1042 },
  { key: 'ultra', material: 'ultra', dropX: 1480, dropSize: 120, fallAt: 2020, rowX: 1202, dockX: 1206 },
];

const HERO_FALL_AT = 1300;
const FALL_MS = 620;

const PILL_Y = 660;
const DOCK_Y = 856;
const DOCK_SIZE = 132;

/* ══════════════════════════════════════════════════════════════════════════
   THE SHOT — every value on screen at time t
   ══════════════════════════════════════════════════════════════════════════ */

interface ActorFrame {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  sx: number;
  sy: number;
}

/** Gravity fall onto the seam, then a squash that rings down on contact. */
function landing(t: number, at: number, from: number, to: number) {
  const y = lerp(from, to, easeInQuad(inv(t, at, at + FALL_MS)));
  const born = spring(inv(t, at, at + 360), 1.2, 0.6);
  const tension = ring(t, at + FALL_MS, 700);
  return { y, born, tension };
}

function shot(t: number) {
  const B = BEATS;

  /* ── ignition: a point of light, a flash, then colour floods out ─────── */
  // The point of light: swells for 300ms, then is consumed by its own flash.
  const core = smoothstep(inv(t, 60, 300));
  const coreAlpha = core * (1 - smoothstep(inv(t, 300, 620)));
  const world = {
    core,
    coreAlpha,
    // The wallpaper expands from the flash rather than cross-fading in.
    fieldScale: lerp(0.28, 1, easeOutExpo(inv(t, 300, 1250))),
    fieldAlpha: smoothstep(inv(t, 300, 950)),
    geometry: smoothstep(inv(t, 520, 1400)),
    seam: easeOutExpo(inv(t, 780, 1400)),
    // Dims once the wordmark has to carry the frame.
    seamLevel: 1 - seg(t, B.fuse.a, B.settle.a, 0, 1),
  };

  /* ── hero: droplet -> bar -> title lens -> install pill ──────────────── */

  const heroLand = landing(t, HERO_FALL_AT, -240, CY);

  // The fuse. One spring, one snap: the bar overshoots past its final width and
  // settles back, which is the whole reason it reads as liquid rather than as a
  // box being resized.
  const fuse = spring(inv(t, FUSE_AT, FUSE_AT + 620), 1.05, 0.5);
  // Wind-up: contract and slide left before the sweep. Anticipation.
  const wind = easeInOutCubic(inv(t, B.title.a, SWEEP_START));
  const sweep = easeInOutSine(inv(t, SWEEP_START, SWEEP_END));
  // Straight from the sweep into the install pill.
  const toPill = easeInOutCubic(inv(t, SWEEP_END, B.settle.a + 500));

  const heroW = q(lerp(lerp(lerp(148, 1240, fuse), SWEEP_W, wind), 620, toPill), 8);
  const heroH = q(lerp(lerp(lerp(148, 168, fuse), 300, wind), 96, toPill), 8);
  const heroR = q(lerp(lerp(lerp(74, 84, fuse), 140, wind), 48, toPill), 4);

  const heroX = lerp(lerp(lerp(CX, SWEEP_FROM, wind), SWEEP_TO, sweep), CX, toPill);
  // heroLand.y is already CY once the fall is over, so this one expression
  // carries the drop, the hold on the seam, and the move down into the lockup.
  const heroY = lerp(heroLand.y, PILL_Y, toPill);

  // Impact squash: on landing, and hard on the fuse.
  const heroTension = heroLand.tension + 1.35 * ring(t, FUSE_AT, 900, 3.2, 5);

  const breath = smoothstep(inv(t, B.settle.b, B.settle.b + 700));
  const driftX = breath * 8 * Math.sin(t / 2700);
  const driftY = breath * 5 * Math.sin(t / 2000 + 1.2);

  const hero: ActorFrame = {
    x: heroX + driftX,
    y: heroY + driftY,
    w: heroW,
    h: heroH,
    r: heroR,
    sx: lerp(0.02, 1, heroLand.born) * (1 + 0.17 * heroTension),
    sy: lerp(0.02, 1, heroLand.born) * (1 - 0.21 * heroTension),
  };

  /* ── supporting cast: droplet -> row -> absorbed -> card -> dock ──────── */

  const cast = CAST.map((role, i) => {
    const land = landing(t, role.fallAt, -240, CY);

    // Slide into the row of five, accelerating as if attracted.
    const gather = easeInCubic(inv(t, B.fuse.a + i * 40, FUSE_AT));
    // Pulled into the liquid: stretch sideways, thin out, vanish.
    const eaten = inv(t, FUSE_AT, FUSE_AT + 160);
    // Poured back out of the pill as dock items.
    const born = spring(inv(t, B.settle.a + 250 + i * 90, B.settle.a + 1150 + i * 90), 1.15, 0.52);
    const asDock = t >= B.settle.a;

    const size = role.dropSize;
    const w = q(asDock ? DOCK_SIZE : size, 8);
    const r = q(asDock ? 34 : size / 2, 4);

    const x = asDock ? lerp(CX, role.dockX, born) : lerp(role.dropX, role.rowX, gather);
    const y = asDock ? lerp(PILL_Y, DOCK_Y, born) : land.y;

    // Between the fuse and the dock the actor is inside the bar at scale 0.
    const scale = asDock ? born : lerp(0.02, 1, land.born) * (1 - eaten);
    const stretch = asDock ? 0 : eaten;
    const tension = asDock ? 0 : land.tension;

    return {
      role,
      frame: {
        x: x + driftX * (i % 2 ? -1 : 1),
        y: y + driftY * (i === 1 || i === 2 ? -1 : 1),
        w,
        h: w,
        r,
        sx: scale * (1 + 1.5 * stretch) * (1 + 0.17 * tension),
        sy: scale * (1 - 0.45 * stretch) * (1 - 0.21 * tension),
      } as ActorFrame,
    };
  });

  /* ── optics: the hero gains power for the sweep, then calms ──────────── */
  const glass = {
    refractionStrength: q(lerp(lerp(12, 30, wind), 16, toPill), 1),
    chromaticAberration: Number(lerp(lerp(0.14, 0.3, wind), 0.22, toPill).toFixed(2)),
    blur: Number(lerp(lerp(2, 2.4, wind), 11, toPill).toFixed(1)),
    tintOpacity: Number(lerp(0.03, 0.08, toPill).toFixed(3)),
    // A wide bezel spreads the bend over more pixels, so a 188px letter
    // crossing the rim kinks instead of shattering.
    bezelWidth: q(lerp(lerp(34, 44, wind), 30, toPill), 2),
    lightAngle: q(seg(t, SWEEP_START, SWEEP_END, -35, 30), 5),
    borderRadius: heroR,
  };

  /* ── the wordmark develops out from under the lens ───────────────────── */
  // The wipe edge rides the lens's LEADING BEZEL, not its centre. The middle of
  // the glass is optically clear, so a wipe there is just a visible vertical cut
  // across the type; inside the bezel that same edge is displaced and dispersed
  // by the rim, which hides it. Everything already behind the lens is fully
  // opaque, so no letter is left permanently half-faded.
  const reveal =
    t < SWEEP_START ? -400 : t <= SWEEP_END ? hero.x + hero.w / 2 + 8 : FRAME_W + 300;
  const titleY = seg(t, SWEEP_END, B.settle.a + 600, CY, 380, easeInOutCubic);

  /* ── impacts: rings in the backdrop, flashes over everything ─────────── */
  const rings = [
    { key: 'ignite', at: 300, x: CX, y: CY, to: 2900, dur: 1100, w: 3 },
    { key: 'fuse', at: FUSE_AT, x: CX, y: CY, to: 2400, dur: 950, w: 3 },
    { key: 'hero', at: HERO_FALL_AT + FALL_MS, x: CX, y: CY, to: 620, dur: 780, w: 2 },
    ...CAST.map((r) => ({
      key: r.key,
      at: r.fallAt + FALL_MS,
      x: r.dropX,
      y: CY,
      to: 520,
      dur: 720,
      w: 2,
    })),
  ]
    .map((e) => ({ ...e, u: inv(t, e.at, e.at + e.dur) }))
    .filter((e) => t >= e.at && e.u < 1);

  const flash =
    0.9 * spike(t, 300, 620, 2.6) +
    0.34 * spike(t, FUSE_AT, 420, 2.8) +
    0.14 * spike(t, HERO_FALL_AT + FALL_MS, 260) +
    CAST.reduce((sum, r) => sum + 0.11 * spike(t, r.fallAt + FALL_MS, 240), 0);

  return {
    world,
    hero,
    cast,
    glass,
    reveal,
    titleY,
    rings,
    flash: Math.min(0.85, flash),
    kicker: smoothstep(inv(t, B.title.a + 200, B.title.a + 900)),
    subline: smoothstep(inv(t, B.settle.a + 600, B.settle.a + 1400)),
    pill: smoothstep(inv(t, B.settle.a + 500, B.settle.a + 1100)),
    flare: seg(t, B.flare.a, B.flare.b, -820, FRAME_W + 820, easeInOutSine),
    flareOn: t >= B.flare.a && t <= B.flare.b,
    vignette: lerp(0.4, 1, world.fieldAlpha),
  };
}

type Shot = ReturnType<typeof shot>;

/* ══════════════════════════════════════════════════════════════════════════
   CLOCK
   ══════════════════════════════════════════════════════════════════════════ */

interface Clock {
  t: number;
  playing: boolean;
  rate: number;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (ms: number) => void;
  restart: () => void;
  setRate: (r: number) => void;
}

function useFilmClock(duration: number, autoplay: boolean): Clock {
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(autoplay);
  const [rate, setRate] = useState(1);
  const tRef = useRef(0);
  const rateRef = useRef(1);

  tRef.current = t;
  rateRef.current = rate;

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();

    const step = (now: number) => {
      const next = tRef.current + (now - last) * rateRef.current;
      last = now;
      if (next >= duration) {
        setT(duration);
        setPlaying(false);
        return;
      }
      setT(next);
      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, duration]);

  return {
    t,
    playing,
    rate,
    play: () => setPlaying(true),
    pause: () => setPlaying(false),
    toggle: () => setPlaying((p) => !p),
    seek: (ms: number) => setT(clamp01(ms / duration) * duration),
    restart: () => {
      setT(0);
      setPlaying(true);
    },
    setRate,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   SCENE
   ══════════════════════════════════════════════════════════════════════════ */

const px = (v: number) => `${v}px`;

const transform = (f: ActorFrame) =>
  `translate(-50%, -50%) scale(${Math.max(0.001, f.sx).toFixed(4)}, ${Math.max(0.001, f.sy).toFixed(4)})`;

/**
 * Everything the glass is going to bend. The colour gives the chromatic split
 * something to act on, the rings give curves, the grid gives straight lines
 * that must kink at the bezel, and the wordmark is the payload.
 */
function Backdrop({ s }: { s: Shot }) {
  const revealPct = (s.reveal / FRAME_W) * 100;
  // ~46px of ramp, close to the 44px bezel it is meant to hide inside.
  const mask = `linear-gradient(90deg, #000 ${revealPct - 2.4}%, rgba(0,0,0,0) ${revealPct}%)`;

  return (
    <div className="stage" aria-hidden>
      <i className="stage-base" />

      <div
        className="field"
        style={{ opacity: s.world.fieldAlpha, transform: `scale(${s.world.fieldScale.toFixed(3)})` }}
      >
        <i className="mass m-cyan" />
        <i className="mass m-indigo" />
        <i className="mass m-magenta" />
        <i className="mass m-mint" />
        <i className="mass m-amber" />
      </div>

      <i className="center-shade" style={{ opacity: s.world.fieldAlpha }} />
      <i className="rings" style={{ opacity: s.world.geometry * 0.95 }} />
      <i className="grid" style={{ opacity: s.world.geometry }} />

      {/* The seam the droplets land on. */}
      <i
        className="seam-glow"
        style={{ transform: `scaleX(${s.world.seam})`, opacity: s.world.seam * s.world.seamLevel }}
      />
      <i
        className="seam"
        style={{
          transform: `scaleX(${s.world.seam})`,
          opacity: s.world.seam * s.world.seamLevel,
        }}
      />

      {/* The ignition core. */}
      <i
        className="ring"
        style={{
          left: px(CX),
          top: px(CY),
          width: px(lerp(0, 220, s.world.core)),
          height: px(lerp(0, 220, s.world.core)),
          border: 'none',
          background: 'radial-gradient(circle, #ffffff, rgba(150,225,255,0.5) 38%, transparent 70%)',
          opacity: s.world.coreAlpha,
        }}
      />

      {/* Impact rings — backdrop content, so glass over them bends them too. */}
      {s.rings.map((e) => (
        <i
          key={e.key}
          className="ring"
          style={{
            left: px(e.x),
            top: px(e.y),
            width: px(lerp(120, e.to, easeOutExpo(e.u))),
            height: px(lerp(120, e.to, easeOutExpo(e.u))),
            borderWidth: px(e.w),
            opacity: Math.pow(1 - e.u, 2.4) * 0.85,
          }}
        />
      ))}

      <p
        className="kicker"
        style={{
          top: px(s.titleY - 168),
          opacity: s.kicker,
          transform: `translate(-50%, ${lerp(14, 0, s.kicker)}px)`,
        }}
      >
        Introducing
      </p>

      {/*
        The title lives in the BACKDROP, not on top of the glass. That is the
        whole trick of the sweep: the lens genuinely refracts these letters, and
        the mask edge trails the lens so they develop out from underneath it.
      */}
      <h1
        className="wordmark"
        style={{ top: px(s.titleY), maskImage: mask, WebkitMaskImage: mask }}
      >
        QuickLiquid
      </h1>

      <p
        className="subline"
        style={{
          top: px(530),
          opacity: s.subline,
          transform: `translate(-50%, ${lerp(16, 0, s.subline)}px)`,
        }}
      >
        Apple-style liquid glass for React and vanilla JavaScript.
      </p>

      {/* One light bar, five surfaces bending it at the same time. */}
      {s.flareOn && (
        <i className="flare" style={{ transform: `translateX(${s.flare}px) rotate(14deg)` }} />
      )}
    </div>
  );
}

/* Fixed engine config per supporting actor — the real material presets, so the
   materials shot is showing the library's actual range and not a mock-up. */
function castConfig(role: Role, radius: number): Partial<LiquidGlassConfig> {
  return {
    material: role.material,
    borderRadius: radius,
    appearance: 'dark',
    edgeHighlight: 1,
    specularStrength: 0.18,
    fresnelPower: 2,
    chromaticAberration: 0.28,
    elevation: 1.15,
    quality: 'high',
    refractionMode: 'svg',
  };
}

export default function Intro() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const clean = params.get('clean') === '1';

  const clock = useFilmClock(DURATION, params.get('paused') !== '1');
  const [chromeHidden, setChromeHidden] = useState(clean);
  const [fit, setFit] = useState(1);

  const s = shot(clock.t);

  /* Fit the 1920x1080 composition to whatever screen is reviewing it.
     `zoom`, not `transform: scale`, on purpose — zoom changes real layout size,
     so each glass host rebuilds its displacement map at the size it is actually
     painted at instead of resampling a map built for another size. Verified
     live at 1.0 / 0.75 / 0.67 by tools/reel-fitcheck.cjs. */
  useLayoutEffect(() => {
    const resize = () => {
      const pad = chromeHidden ? 0 : 92;
      setFit(
        Math.min(1, Math.min(window.innerWidth / FRAME_W, (window.innerHeight - pad) / FRAME_H)),
      );
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [chromeHidden]);

  /* The handle a capture script drives: seek to an exact millisecond, screenshot,
     repeat. A deterministic shot() makes the sequence frame-perfect. */
  const seekRef = useRef(clock.seek);
  seekRef.current = clock.seek;

  useEffect(() => {
    (window as unknown as Record<string, unknown>).__REEL__ = {
      duration: DURATION,
      frame: `${FRAME_W}x${FRAME_H}`,
      seek: (ms: number) => seekRef.current(ms),
    };
    document.body.dataset.reelReady = '1';
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (e.key === ' ') {
        e.preventDefault();
        clock.toggle();
      } else if (key === 'r') {
        clock.restart();
      } else if (key === 'h') {
        setChromeHidden((v) => !v);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        clock.pause();
        clock.seek(clock.t + dir * (e.shiftKey ? 1000 : 1000 / 60));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [clock]);

  const heroConfig: Partial<LiquidGlassConfig> = {
    blur: s.glass.blur,
    saturation: 1.3,
    refractionStrength: s.glass.refractionStrength,
    bezelWidth: s.glass.bezelWidth,
    thickness: 26,
    ior: 1.5,
    chromaticAberration: s.glass.chromaticAberration,
    lightAngle: s.glass.lightAngle,
    edgeHighlight: 1,
    specularStrength: 0.18,
    fresnelPower: 2,
    tintOpacity: s.glass.tintOpacity,
    borderRadius: s.glass.borderRadius,
    elevation: 1.3,
    appearance: 'dark',
    quality: 'high',
    refractionMode: 'svg',
  };

  const frameStyle = {
    '--reel-t': clock.t.toFixed(0),
    width: px(FRAME_W),
    height: px(FRAME_H),
    zoom: fit,
  } as CSSProperties;

  return (
    <div className="reel-page" data-chrome={chromeHidden ? 'hidden' : 'shown'}>
      <div className="reel-frame" style={frameStyle}>
        <Backdrop s={s} />

        {/*
          The glass. No wrapper carries a transform, opacity or filter — each
          host is positioned and animated directly, and DOM order alone puts
          them above the backdrop.
        */}
        <LiquidGlass
          className="actor"
          config={heroConfig}
          animateIn={false}
          style={{
            left: px(s.hero.x),
            top: px(s.hero.y),
            width: px(s.hero.w),
            height: px(s.hero.h),
            transform: transform(s.hero),
          }}
        >
          <div className="pill-body" style={{ opacity: s.pill }}>
            <span className="pill-prompt">$</span>
            <span className="pill-command">npm install quick-liquid</span>
          </div>
        </LiquidGlass>

        {s.cast.map(({ role, frame }) => (
          <LiquidGlass
            key={role.key}
            className="actor"
            config={castConfig(role, frame.r)}
            animateIn={false}
            style={{
              left: px(frame.x),
              top: px(frame.y),
              width: px(frame.w),
              height: px(frame.h),
              transform: transform(frame),
            }}
          >
          </LiquidGlass>
        ))}

        {/* Grade, painted above everything. Never an ancestor of glass. */}
        <i className="vignette" style={{ opacity: s.vignette }} aria-hidden />
        <i className="flash" style={{ opacity: s.flash }} aria-hidden />
      </div>

      {!chromeHidden && <Transport clock={clock} />}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   TRANSPORT — review only, hidden with H or ?clean=1, never recorded
   ══════════════════════════════════════════════════════════════════════════ */

function Transport({ clock }: { clock: Clock }) {
  const beat = beatAt(clock.t);

  return (
    <div className="transport">
      <button className="tr-btn" onClick={clock.toggle} title="Space">
        {clock.playing ? '❚❚' : '▶'}
      </button>
      <button className="tr-btn" onClick={clock.restart} title="R">
        ↺
      </button>

      <div className="tr-scrub">
        <input
          type="range"
          min={0}
          max={DURATION}
          step={1}
          value={Math.round(clock.t)}
          onChange={(e) => {
            clock.pause();
            clock.seek(Number(e.target.value));
          }}
        />
        <div className="tr-marks">
          {(Object.keys(BEATS) as (keyof typeof BEATS)[]).map((name) => (
            <i
              key={name}
              className="tr-mark"
              data-active={name === beat}
              style={{ left: `${(BEATS[name].a / DURATION) * 100}%` }}
              title={name}
            />
          ))}
        </div>
      </div>

      <span className="tr-time">
        {formatTime(clock.t)} <em>/ {formatTime(DURATION)}</em>
      </span>
      <span className="tr-beat">{beat}</span>

      <div className="tr-rates">
        {[0.25, 0.5, 1].map((r) => (
          <button
            key={r}
            className="tr-btn tr-btn--rate"
            data-on={clock.rate === r}
            onClick={() => clock.setRate(r)}
          >
            {r}&times;
          </button>
        ))}
      </div>

      <span className="tr-hint">space &middot; R replay &middot; arrows step &middot; H hide</span>
    </div>
  );
}
