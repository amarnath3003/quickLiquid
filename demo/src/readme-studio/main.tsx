import { StrictMode, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import {
  LiquidGlassEngine,
  LiquidGroup,
  MATERIAL_PRESETS,
  QUALITY_PRESETS,
  Spring,
  computeBoundedJellyBox,
  computeSwitchStretch,
  type GlassQuality,
} from 'quick-liquid';
import { LiquidGlass } from 'quick-liquid/react';
import '@fontsource-variable/outfit';
import '@fontsource-variable/jetbrains-mono';
import './studio.css';

declare global {
  interface Window {
    __README_STUDIO__?: {
      seek: (progress: number) => void;
    };
  }
}

type SceneId =
  | 'intro'
  | 'optics'
  | 'materials'
  | 'droplets'
  | 'motion'
  | 'controls'
  | 'quality';

const RIBBON_COLORS = [
  '#fa799b',
  '#f5a07b',
  '#edd28f',
  '#9de2be',
  '#7ce0dd',
  '#82acff',
  '#ae94f1',
];

function AtmosphereLayer() {
  return (
    <div className="studio-atmosphere" aria-hidden="true">
      <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="studio-aura">
            <stop stopColor="#5570b5" stopOpacity="0.28" />
            <stop offset="1" stopColor="#5570b5" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse
          cx="1020"
          cy="388"
          rx="640"
          ry="150"
          fill="url(#studio-aura)"
          transform="rotate(-17 1020 388)"
        />
        {RIBBON_COLORS.map((color, i) => {
          const offset = i - 3;
          const curve = `M -230 ${740 + offset * 18} C 110 ${520 + offset * 32}, 365 ${835 + offset * 21}, 656 ${618 + offset * 14} S 1000 ${176 + offset * 23}, 1670 ${199 + offset * 30}`;
          return (
            <g key={color} fill="none" stroke={color}>
              <path d={curve} strokeWidth="14" opacity="0.03" />
              <path d={curve} strokeWidth={i % 3 === 0 ? 2 : 1.15} opacity="0.45" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function LightField({ className = '' }: { className?: string }) {
  return (
    <div className={`light-field ${className}`} aria-hidden="true">
      <div className="light-field__rays">
        <i /><i /><i /><i />
        <i /><i /><i /><i />
      </div>
    </div>
  );
}

function BrandMark() {
  return (
    <span className="site-mark" aria-hidden="true"><i /></span>
  );
}

function CardGlassLayer({ radius = 24 }: { radius?: number }) {
  return (
    <div className="card-glass" aria-hidden="true">
      <LiquidGlass
        className="card-glass__surface"
        config={{
          appearance: 'dark',
          quality: 'medium',
          borderRadius: radius,
          bezelWidth: 16,
          blur: 14,
          refractionStrength: 12,
          chromaticAberration: 0.08,
          specularStrength: 0.16,
          edgeHighlight: 0.56,
          tintOpacity: 0.16,
          elevation: 0,
          refractionMode: 'svg',
          respectPreferences: false,
        }}
      />
    </div>
  );
}

async function markReadyWhenLensesLoaded(expectedSvgCount: number) {
  await document.fonts.ready;
  const started = performance.now();
  while (performance.now() - started < 4000) {
    const images = Array.from(document.querySelectorAll('feImage'));
    const loaded = images.filter(img => {
      const href = img.getAttribute('href') || img.getAttribute('xlink:href') || '';
      return href.startsWith('blob:');
    });
    if (loaded.length >= expectedSvgCount) break;
    await new Promise(resolve => setTimeout(resolve, 40));
  }
  await new Promise<void>(resolve =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
  document.body.dataset.studioReady = '1';
}

function useStudioReady(expectedSvgCount: number) {
  useEffect(() => {
    void markReadyWhenLensesLoaded(expectedSvgCount);
  }, [expectedSvgCount]);
}

/* ─────────────────────────── SCENE 1: INTRO ─────────────────────────── */
function IntroScene() {
  const lensRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<LiquidGlassEngine | null>(null);

  useEffect(() => {
    const el = lensRef.current;
    if (!el) return;
    const engine = new LiquidGlassEngine(el, {
      quality: 'ultra',
      appearance: 'dark',
      borderRadius: 78,
      bezelWidth: 40,
      thickness: 28,
      ior: 1.54,
      refractionStrength: 44,
      chromaticAberration: 0.68,
      dispersionMode: 'exact',
      magnification: 1.18,
      blur: 1,
      saturation: 1.25,
      tintOpacity: 0.04,
      edgeHighlight: 0.96,
      specularStrength: 0.58,
      lightAngle: -35,
      refractionMode: 'svg',
      respectPreferences: false,
    });
    engineRef.current = engine;

    const applySeek = (progress: number) => {
      const theta = progress * Math.PI * 2;
      const x = Math.sin(theta) * 212;
      const y = Math.sin(theta * 2) * 28;
      el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
      engine.updateConfig({ lightAngle: -35 + Math.sin(theta) * 55 });
    };

    window.__README_STUDIO__ = { seek: applySeek };
    applySeek(0.18);
    void markReadyWhenLensesLoaded(1);

    return () => {
      delete window.__README_STUDIO__;
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  return (
    <main className="studio-canvas intro-scene">
      <div className="studio-dots" />
      <LightField className="intro-beam" />
      <div className="intro-sight" aria-hidden="true"><i /><i /></div>

      <header className="intro-topbar">
        <div className="intro-brand">
          <BrandMark />
          <span>quickLiquid</span>
        </div>
        <span className="intro-url">quickliquid.vercel.app</span>
      </header>

      <section className="intro-center">
        <div className="intro-wordmark-wrap">
          <h1 className="intro-wordmark">
            Quick<span>Liquid</span>
          </h1>
          <p className="intro-subline">
            Snell LUT &middot; Chromatic Dispersion &middot; Spring Physics
          </p>
        </div>

        <div className="intro-lens" ref={lensRef} aria-label="Refractive liquid glass lens">
          <div className="ql-content">
            <span className="intro-lens__grip" aria-hidden="true" />
          </div>
        </div>
      </section>

      <footer className="intro-footer">
        <span className="intro-pill">Precomputed 1-D Snell LUT</span>
        <span className="intro-pill">Shared Map Cache</span>
        <span className="intro-pill">Zero Dependencies</span>
      </footer>
    </main>
  );
}

/* ─────────────────────────── SCENE 2: OPTICS ─────────────────────────── */
function drawFocusChart(canvas: HTMLCanvasElement, width: number, height: number) {
  const scale = 3;
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);

  const paper = ctx.createLinearGradient(0, 0, width, height);
  paper.addColorStop(0, '#0d1524');
  paper.addColorStop(0.55, '#1d304b');
  paper.addColorStop(1, '#10182b');
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#a8c3e124';
  for (let x = 0; x < width; x += 16) ctx.fillRect(x, 0, 0.7, height);
  for (let y = 0; y < height; y += 16) ctx.fillRect(0, y, width, 0.7);

  const colors = ['#ff89a1', '#ffc494', '#f5da95', '#ace9bb', '#8de3de', '#9abdfa', '#b7a4f4'];
  colors.forEach((color, i) => {
    ctx.beginPath();
    ctx.moveTo(0, height * 0.72 + i * 3);
    ctx.bezierCurveTo(
      width * 0.25,
      height * 0.8 + i * 3,
      width * 0.68,
      height * 0.44 + i * 3,
      width,
      height * 0.26 + i * 3,
    );
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    ctx.stroke();
  });

  const left = width * 0.14;
  const baseline = height * 0.53;
  ctx.font = '600 10px monospace';
  ctx.fillStyle = '#b9cade';
  ctx.fillText('RESOLUTION CHART', left, baseline - 34);
  ctx.font = '600 32px system-ui, sans-serif';
  ctx.fillStyle = '#f4f8ff';
  ctx.fillText('Qq 01', left, baseline);
  ctx.font = '500 10px monospace';
  ctx.fillStyle = '#c4d8f4';
  ctx.fillText('2 px line pairs', left, baseline + 18);

  ctx.fillStyle = '#cbdbeb';
  for (let x = width * 0.68; x < width * 0.9; x += 4) {
    ctx.fillRect(x, height * 0.16, 2, height * 0.16);
  }
  for (let n = 0; left + n * 5 < width * 0.88; n++) {
    const x = left + n * 5;
    const y = height * 0.84;
    ctx.fillRect(x, y, 0.8, n % 5 ? 4 : 9);
  }
}

function OpticsScene() {
  const chartCanvasRef = useRef<HTMLCanvasElement>(null);
  const chartStageRef = useRef<HTMLDivElement>(null);
  useStudioReady(6);

  useEffect(() => {
    const canvas = chartCanvasRef.current;
    const stage = chartStageRef.current;
    if (!canvas || !stage) return;
    drawFocusChart(canvas, stage.clientWidth || 350, stage.clientHeight || 270);
  }, []);

  return (
    <main className="studio-canvas optics-scene">
      <div className="studio-dots" />
      <AtmosphereLayer />

      <header className="studio-header">
        <div>
          <span className="studio-kicker">Optical Pipeline</span>
          <h1 className="studio-title">Snell refraction, chromatic dispersion &amp; zoom</h1>
        </div>
        <span className="studio-code-chip">1-D LUT &rarr; SDF &rarr; feDisplacementMap</span>
      </header>

      <section className="optics-grid">
        <article className="optic-card glass-pane">
          <CardGlassLayer radius={20} />
          <div className="optic-stage">
            <LightField />
            <span className="optic-bg-label">SNELL 1.50</span>
            <LiquidGlass
              className="optic-lens"
              config={{
                appearance: 'dark',
                quality: 'ultra',
                borderRadius: 34,
                bezelWidth: 36,
                thickness: 26,
                ior: 1.5,
                refractionStrength: 40,
                chromaticAberration: 0,
                blur: 0.5,
                tintOpacity: 0.04,
                edgeHighlight: 0.92,
                specularStrength: 0.48,
                refractionMode: 'svg',
                respectPreferences: false,
              }}
            >
              <div className="optic-lens__inner">Clear bezel</div>
            </LiquidGlass>
          </div>
          <div className="optic-meta">
            <h3>Snell Bezel Refraction</h3>
            <p>Flat center clarity with curved rim bending derived from vector Snell&rsquo;s law.</p>
            <span className="studio-code-chip">ior: 1.5 · refractionStrength: 40</span>
          </div>
        </article>

        <article className="optic-card glass-pane">
          <CardGlassLayer radius={20} />
          <div className="optic-stage optic-stage--prism">
            <LightField />
            <div className="optic-bars" aria-hidden="true">
              <i /><i /><i /><i /><i />
            </div>
            <LiquidGlass
              className="optic-lens"
              config={{
                appearance: 'dark',
                quality: 'extreme',
                borderRadius: 34,
                bezelWidth: 38,
                thickness: 28,
                ior: 1.56,
                refractionStrength: 48,
                chromaticAberration: 0.88,
                dispersionMode: 'exact',
                blur: 0.5,
                tintOpacity: 0.03,
                edgeHighlight: 0.94,
                specularStrength: 0.55,
                refractionMode: 'svg',
                respectPreferences: false,
              }}
            >
              <div className="optic-lens__inner">RGB prism rim</div>
            </LiquidGlass>
          </div>
          <div className="optic-meta">
            <h3>Chromatic Dispersion</h3>
            <p>Three displacement scales on one shared map produce prismatic R/G/B fringes.</p>
            <span className="studio-code-chip">chromaticAberration: 0.88 · exact</span>
          </div>
        </article>

        <article className="optic-card glass-pane">
          <CardGlassLayer radius={20} />
          <div className="optic-stage" ref={chartStageRef}>
            <canvas ref={chartCanvasRef} className="optic-chart-canvas" aria-hidden="true" />
            <LiquidGlass
              className="optic-lens optic-lens--round"
              config={{
                appearance: 'dark',
                quality: 'extreme',
                borderRadius: 999,
                bezelWidth: 34,
                thickness: 24,
                ior: 1.5,
                magnification: 2.2,
                refractionStrength: 18,
                chromaticAberration: 0.28,
                dispersionMode: 'exact',
                blur: 0,
                tintOpacity: 0.02,
                edgeHighlight: 0.95,
                specularStrength: 0.45,
                refractionMode: 'svg',
                respectPreferences: false,
              }}
            >
              <div className="optic-lens__inner" />
            </LiquidGlass>
          </div>
          <div className="optic-meta">
            <h3>2.2&times; Optical Magnifier</h3>
            <p>Smooth center zoom tapered seamlessly into the refractive bezel shoulder.</p>
            <span className="studio-code-chip">magnification: 2.2 · quality: &apos;extreme&apos;</span>
          </div>
        </article>
      </section>
    </main>
  );
}

/* ─────────────────────────── SCENE 3: MATERIALS ─────────────────────────── */
const MATERIAL_INFO: {
  name: 'clear' | 'thin' | 'regular' | 'thick' | 'ultra' | 'adaptive';
  desc: string;
}[] = [
  { name: 'clear', desc: 'Low frost, crisp bezel lensing' },
  { name: 'thin', desc: 'Light frost for compact toolbars' },
  { name: 'regular', desc: 'Balanced refraction and depth' },
  { name: 'thick', desc: 'High separation for sheets' },
  { name: 'ultra', desc: 'Dense frost for modal overlays' },
  { name: 'adaptive', desc: 'Overlay-blended ambient tint' },
];

function MaterialsScene() {
  useStudioReady(12);

  return (
    <main className="studio-canvas materials-scene">
      <div className="studio-dots" />
      <AtmosphereLayer />

      <header className="studio-header">
        <div>
          <span className="studio-kicker">Material System</span>
          <h1 className="studio-title">Six curated presets, any override</h1>
        </div>
        <span className="studio-code-chip">MATERIAL_PRESETS</span>
      </header>

      <section className="materials-grid">
        {MATERIAL_INFO.map(({ name, desc }) => {
          const preset = MATERIAL_PRESETS[name];
          return (
            <article className="material-card glass-pane" key={name}>
              <CardGlassLayer radius={18} />
              <div className="material-card__stage">
                <LightField />
                <span className="material-card__bgtext">REFRACT</span>
                <LiquidGlass
                  className="material-card__lens"
                  config={{
                    material: name,
                    appearance: 'dark',
                    quality: 'high',
                    borderRadius: 24,
                    refractionMode: 'svg',
                    respectPreferences: false,
                  }}
                >
                  <span className="material-card__name">{name}</span>
                </LiquidGlass>
              </div>
              <div className="material-card__footer">
                <span className="material-card__desc">{desc}</span>
                <span className="studio-code-chip">
                  blur {preset.blur} · str {preset.refractionStrength}
                </span>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}

/* ─────────────────────────── SCENE 4: DROPLETS ─────────────────────────── */
const BEAM = [0.76, 0.7, 0.27, 0.3] as const;

function flowBeamY(t: number) {
  const a = 1 - t;
  return (
    a ** 3 * BEAM[0] +
    3 * a ** 2 * t * BEAM[1] +
    3 * a * t ** 2 * BEAM[2] +
    t ** 3 * BEAM[3]
  );
}

function paintDropletScene(canvas: HTMLCanvasElement, width: number, height: number) {
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const sky = ctx.createRadialGradient(
    width * 0.51,
    height * 0.45,
    0,
    width / 2,
    height / 2,
    width * 0.78,
  );
  sky.addColorStop(0, '#223352');
  sky.addColorStop(0.58, '#10192e');
  sky.addColorStop(1, '#070b16');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#9ebad346';
  for (let y = 10; y < height; y += 18) {
    for (let x = 10; x < width; x += 18) ctx.fillRect(x, y, 1, 1);
  }

  ctx.strokeStyle = '#9ab8ff26';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(24, height - 34);
  ctx.lineTo(width - 24, height - 34);
  ctx.stroke();
  for (let x = 40; x < width - 24; x += 28) {
    ctx.fillStyle = '#a9c5ff42';
    ctx.fillRect(x, height - 34, 1, x % 56 === 40 ? 7 : 4);
  }

  const colors = [
    '#ff758e',
    '#ffac88',
    '#ffe1a2',
    '#a3efbd',
    '#74e3e6',
    '#87aafa',
    '#b19afa',
    '#ec9ce4',
  ];
  colors.forEach((color, index) => {
    const offset = (index - 3.5) * 9;
    ctx.beginPath();
    ctx.moveTo(0, height * BEAM[0] + offset);
    ctx.bezierCurveTo(
      width / 3,
      height * BEAM[1] + offset,
      (width * 2) / 3,
      height * BEAM[2] + offset,
      width,
      height * BEAM[3] + offset,
    );
    ctx.strokeStyle = color;
    ctx.shadowBlur = 8;
    ctx.shadowColor = color;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = index % 3 === 0 ? 2.4 : 1.35;
    ctx.stroke();
  });
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

function DropletsScene() {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dropARef = useRef<HTMLDivElement>(null);
  const dropBRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    const dropA = dropARef.current;
    const dropB = dropBRef.current;
    if (!stage || !canvas || !dropA || !dropB) return;

    const width = stage.clientWidth || 840;
    const height = stage.clientHeight || 380;
    paintDropletScene(canvas, width, height);

    const group = new LiquidGroup(stage, {
      backdrop: canvas,
      blendRadius: 34,
      mergeDistance: 32,
      resolution: 1,
      bridgeOpacity: 0.78,
      bridgeColor: 'rgba(130, 175, 232, 0.22)',
      bridgeRimColor: 'rgba(232, 246, 255, 0.96)',
      bridgeRimWidth: 1.4,
    });

    const applySeek = (progress: number) => {
      const wave = 0.5 - 0.5 * Math.cos(progress * Math.PI * 2);
      const shaped = Math.pow(wave, 0.88);
      const halfSpan = 138 - shaped * 76; // 138px (separated) -> 62px (bridged)
      const leftX = width / 2 - halfSpan;
      const rightX = width / 2 + halfSpan;
      const leftY = flowBeamY(leftX / width) * height;
      const rightY = flowBeamY(rightX / width) * height;
      dropA.style.left = `${leftX.toFixed(2)}px`;
      dropA.style.top = `${leftY.toFixed(2)}px`;
      dropB.style.left = `${rightX.toFixed(2)}px`;
      dropB.style.top = `${rightY.toFixed(2)}px`;
      group.updatePositions();
    };

    applySeek(0.35);
    group.add(dropA);
    group.add(dropB);
    group.updatePositions();

    window.__README_STUDIO__ = { seek: applySeek };
    void markReadyWhenLensesLoaded(0);

    return () => {
      delete window.__README_STUDIO__;
      group.destroy();
    };
  }, []);

  return (
    <main className="studio-canvas droplets-scene" ref={stageRef}>
      <canvas ref={canvasRef} className="droplets-canvas" aria-hidden="true" />
      <div className="droplet-member" ref={dropARef} />
      <div className="droplet-member" ref={dropBRef} />
      <div className="droplets-badge">
        <i aria-hidden="true" />
        <span>LiquidGroup &middot; SDF Metaball Merging</span>
      </div>
      <div className="droplets-spec">blendRadius: 34 &middot; mergeDistance: 32</div>
    </main>
  );
}

/* ─────────────────────────── SCENE 5: MOTION ─────────────────────────── */
const TABS = ['Clear', 'Frosted', 'Spectral', 'Prism'] as const;

interface MotionTimelineSample {
  tabIndex: number;
  pillX: number;
  pillScaleX: number;
  pillScaleY: number;
  sw1On: boolean;
  sw1X: number;
  sw1ScaleX: number;
  sw1ScaleY: number;
  sw2On: boolean;
  sw2X: number;
  sw2ScaleX: number;
  sw2ScaleY: number;
  btnScaleX: number;
  btnScaleY: number;
  sheenX: number;
  sheenY: number;
  rippleProgress: number;
  scrollProgress: number;
}

function buildMotionTimeline(totalFrames: number, durationMs: number, segWidth: number): MotionTimelineSample[] {
  const pillSpring = new Spring(0, { stiffness: 380, damping: 24, mass: 1 });
  const sw1Spring = new Spring(1, { stiffness: 460, damping: 24, mass: 0.85 });
  const sw2Spring = new Spring(0, { stiffness: 460, damping: 24, mass: 0.85 });
  const btnSpring = new Spring(1, 'stiff');

  const samples: MotionTimelineSample[] = [];
  const subSteps = 4;
  const stepMs = durationMs / (totalFrames * subSteps);

  let prevTab = 0;
  let prevSw1: boolean = true;
  let prevSw2: boolean = false;
  let prevPressed = false;

  for (let frame = 0; frame < totalFrames; frame++) {
    let curTab = prevTab;
    let curSw1: boolean = prevSw1;
    let curSw2: boolean = prevSw2;

    for (let s = 0; s < subSteps; s++) {
      const idx = frame * subSteps + s;
      const ms = idx * stepMs;
      const t = ms / durationMs;

      curTab = t < 0.04 ? 0 : t < 0.28 ? 1 : t < 0.52 ? 2 : t < 0.76 ? 3 : 0;
      if (curTab !== prevTab) {
        pillSpring.setTarget(curTab * segWidth);
        prevTab = curTab;
      }
      pillSpring.tick(ms);

      curSw1 = t < 0.2 || t >= 0.68;
      if (curSw1 !== prevSw1) {
        sw1Spring.setTarget(curSw1 ? 1 : 0);
        prevSw1 = curSw1;
      }
      sw1Spring.tick(ms);

      curSw2 = t >= 0.1 && t < 0.58;
      if (curSw2 !== prevSw2) {
        sw2Spring.setTarget(curSw2 ? 1 : 0);
        prevSw2 = curSw2;
      }
      sw2Spring.tick(ms);

      const pressed = (t >= 0.16 && t < 0.23) || (t >= 0.64 && t < 0.71);
      if (pressed !== prevPressed) {
        btnSpring.setTarget(pressed ? 0.91 : 1);
        prevPressed = pressed;
      }
      btnSpring.tick(ms);
    }

    const t = frame / totalFrames;
    const jelly = computeBoundedJellyBox({
      rawX: pillSpring.value,
      rawY: 0,
      width: segWidth,
      height: 35,
      scaleX: 1,
      scaleY: 1,
      vx: pillSpring.velocity,
      vy: 0,
      minX: 0,
      maxX: segWidth * TABS.length,
      minY: 0,
      maxY: 35,
      stretch: 0.24,
      maxWallBulge: 1.12,
    });

    const sw1Stretch = computeSwitchStretch(sw1Spring.velocity * 38, 0.28);
    const sw2Stretch = computeSwitchStretch(sw2Spring.velocity * 38, 0.28);

    const btnPressAmt = Math.max(0, 1 - btnSpring.value);
    const btnScaleX = btnSpring.value + btnPressAmt * 0.34;
    const btnScaleY = btnSpring.value - btnPressAmt * 0.18;

    const r1 = t >= 0.16 && t < 0.42 ? (t - 0.16) / 0.26 : -1;
    const r2 = t >= 0.64 && t < 0.9 ? (t - 0.64) / 0.26 : -1;

    samples.push({
      tabIndex: curTab,
      pillX: jelly.x,
      pillScaleX: jelly.scaleX,
      pillScaleY: jelly.scaleY,
      sw1On: curSw1,
      sw1X: sw1Spring.value * 28,
      sw1ScaleX: sw1Stretch.scaleX,
      sw1ScaleY: sw1Stretch.scaleY,
      sw2On: curSw2,
      sw2X: sw2Spring.value * 28,
      sw2ScaleX: sw2Stretch.scaleX,
      sw2ScaleY: sw2Stretch.scaleY,
      btnScaleX,
      btnScaleY,
      sheenX: 50 + Math.cos(t * Math.PI * 2) * 34,
      sheenY: 50 + Math.sin(t * Math.PI * 4) * 24,
      rippleProgress: r1 >= 0 ? r1 : r2,
      scrollProgress: 0.22 + (0.5 - 0.5 * Math.cos(t * Math.PI * 2)) * 0.78,
    });
  }

  return samples;
}

function MotionScene() {
  const segWrapRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const tabItemRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const sw1TrackRef = useRef<HTMLDivElement>(null);
  const sw1ThumbRef = useRef<HTMLDivElement>(null);
  const sw2TrackRef = useRef<HTMLDivElement>(null);
  const sw2ThumbRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLDivElement>(null);
  const sheenRef = useRef<HTMLDivElement>(null);
  const rippleRef = useRef<HTMLSpanElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const segWrap = segWrapRef.current;
    const pill = pillRef.current;
    const sw1Thumb = sw1ThumbRef.current;
    const sw2Thumb = sw2ThumbRef.current;
    const btn = btnRef.current;
    if (!segWrap || !pill || !sw1Thumb || !sw2Thumb || !btn) return;

    const segWidth = Math.max(80, (segWrap.clientWidth - 8) / TABS.length);
    pill.style.width = `${segWidth}px`;

    const pillGlass = new LiquidGlassEngine(pill, {
      quality: 'medium',
      appearance: 'dark',
      borderRadius: 9,
      blur: 4,
      refractionStrength: 10,
      bezelWidth: 10,
      thickness: 12,
      tintOpacity: 0.12,
      edgeHighlight: 0.85,
      specularStrength: 0.35,
      elevation: 0,
      refractionMode: 'svg',
      respectPreferences: false,
    });

    const sw1Glass = new LiquidGlassEngine(sw1Thumb, {
      quality: 'low',
      appearance: 'dark',
      borderRadius: 999,
      blur: 1,
      refractionStrength: 10,
      bezelWidth: 9,
      thickness: 12,
      tintOpacity: 0.14,
      edgeHighlight: 0.9,
      specularStrength: 0.45,
      elevation: 0,
      refractionMode: 'svg',
      respectPreferences: false,
    });

    const sw2Glass = new LiquidGlassEngine(sw2Thumb, {
      quality: 'low',
      appearance: 'dark',
      borderRadius: 999,
      blur: 1,
      refractionStrength: 10,
      bezelWidth: 9,
      thickness: 12,
      tintOpacity: 0.14,
      edgeHighlight: 0.9,
      specularStrength: 0.45,
      elevation: 0,
      refractionMode: 'svg',
      respectPreferences: false,
    });

    const btnGlass = new LiquidGlassEngine(btn, {
      quality: 'medium',
      appearance: 'dark',
      borderRadius: 14,
      blur: 5,
      refractionStrength: 14,
      bezelWidth: 12,
      thickness: 14,
      tintOpacity: 0.14,
      edgeHighlight: 0.88,
      specularStrength: 0.4,
      elevation: 0,
      refractionMode: 'svg',
      respectPreferences: false,
    });

    const timeline = buildMotionTimeline(160, 4000, segWidth);

    const applySeek = (progress: number) => {
      const norm = ((progress % 1) + 1) % 1;
      const idx = Math.min(timeline.length - 1, Math.round(norm * (timeline.length - 1)));
      const s = timeline[idx];

      pill.style.transform = `translate3d(${s.pillX.toFixed(2)}px, 0, 0) scale(${s.pillScaleX.toFixed(3)}, ${s.pillScaleY.toFixed(3)})`;
      tabItemRefs.current.forEach((node, i) => {
        node?.classList.toggle('is-active', i === s.tabIndex);
      });

      if (sw1TrackRef.current) sw1TrackRef.current.dataset.on = String(s.sw1On);
      sw1Thumb.style.transform = `translate3d(${s.sw1X.toFixed(2)}px, 0, 0) scale(${s.sw1ScaleX.toFixed(3)}, ${s.sw1ScaleY.toFixed(3)})`;

      if (sw2TrackRef.current) sw2TrackRef.current.dataset.on = String(s.sw2On);
      sw2Thumb.style.transform = `translate3d(${s.sw2X.toFixed(2)}px, 0, 0) scale(${s.sw2ScaleX.toFixed(3)}, ${s.sw2ScaleY.toFixed(3)})`;

      btn.style.transform = `scale(${s.btnScaleX.toFixed(3)}, ${s.btnScaleY.toFixed(3)})`;
      if (sheenRef.current) {
        sheenRef.current.style.setProperty('--hx', `${s.sheenX.toFixed(1)}%`);
        sheenRef.current.style.setProperty('--hy', `${s.sheenY.toFixed(1)}%`);
      }
      if (rippleRef.current) {
        if (s.rippleProgress >= 0) {
          const ease = 1 - Math.pow(1 - s.rippleProgress, 2.2);
          rippleRef.current.style.opacity = `${(1 - s.rippleProgress) * 0.9}`;
          rippleRef.current.style.transform = `scale(${(0.8 + ease * 5.8).toFixed(2)})`;
        } else {
          rippleRef.current.style.opacity = '0';
        }
      }
      if (scrollRef.current) {
        scrollRef.current.style.transform = `scaleX(${s.scrollProgress.toFixed(3)})`;
      }
    };

    applySeek(0.18);
    window.__README_STUDIO__ = { seek: applySeek };
    void markReadyWhenLensesLoaded(4);

    return () => {
      delete window.__README_STUDIO__;
      pillGlass.destroy();
      sw1Glass.destroy();
      sw2Glass.destroy();
      btnGlass.destroy();
    };
  }, []);

  return (
    <main className="studio-canvas motion-scene">
      <div className="studio-dots" />
      <AtmosphereLayer />

      <section className="motion-console glass-pane">
        <header className="motion-head">
          <div>
            <span className="studio-kicker">Spring Physics &amp; Primitives</span>
            <h2>Analytical damped-harmonic UI motion</h2>
          </div>
          <span className="studio-code-chip">Spring &middot; JellyBox &middot; SwitchStretch</span>
        </header>

        <div className="motion-grid">
          <div className="motion-panel">
            <div className="motion-panel__label">
              <span>LiquidSegmented / LiquidTabBar</span>
              <span>stiffness 360</span>
            </div>

            <div className="motion-segmented" ref={segWrapRef}>
              <div className="motion-segmented__pill" ref={pillRef} />
              {TABS.map((tab, i) => (
                <span
                  key={tab}
                  ref={el => { tabItemRefs.current[i] = el; }}
                  className={`motion-segmented__item${i === 0 ? ' is-active' : ''}`}
                >
                  {tab}
                </span>
              ))}
            </div>

            <div className="motion-panel__label" style={{ marginTop: 4 }}>
              <span>LiquidInteractive</span>
              <span>press squish + ripple</span>
            </div>

            <div className="motion-btn-stage">
              <div className="motion-btn-wrap">
                <div className="motion-cta" ref={btnRef}>
                  <div className="motion-cta__sheen" ref={sheenRef} />
                  <span className="motion-cta__ripple" ref={rippleRef} />
                  <span>Trigger Pulse</span>
                </div>
              </div>
              <span className="studio-code-chip">60fps scheduler</span>
            </div>
          </div>

          <div className="motion-panel">
            <div className="motion-panel__label">
              <span>LiquidToggle / LiquidSwitch</span>
              <span>area-conserving stretch</span>
            </div>

            <div className="motion-switches">
              <div className="motion-switch-row">
                <span>Chromatic Prism</span>
                <div className="motion-toggle-track" ref={sw1TrackRef} data-on="true">
                  <div className="motion-toggle-thumb" ref={sw1ThumbRef} />
                </div>
              </div>
              <div className="motion-switch-row">
                <span>Dynamic Lighting</span>
                <div className="motion-toggle-track" ref={sw2TrackRef} data-on="false">
                  <div className="motion-toggle-thumb" ref={sw2ThumbRef} />
                </div>
              </div>
            </div>

            <div className="motion-panel__label">
              <span>LiquidScrollTrack</span>
              <span>spring-smoothed progress</span>
            </div>
          </div>
        </div>

        <div className="motion-scroll-track" aria-hidden="true">
          <div className="motion-scroll-fill" ref={scrollRef} />
        </div>
      </section>
    </main>
  );
}

/* ─────────────────────────── SCENE 6: CONTROLS ─────────────────────────── */
function ControlsScene() {
  useStudioReady(6);

  return (
    <main className="studio-canvas controls-scene">
      <div className="studio-dots" />
      <AtmosphereLayer />

      <header className="controls-navbar glass-pane">
        <CardGlassLayer radius={22} />
        <div className="controls-navbar__inner">
          <div className="intro-brand">
            <BrandMark />
            <span>quickLiquid</span>
          </div>
          <nav className="controls-nav-links" aria-label="Preview navigation">
            <span>Material</span>
            <span>Components</span>
            <span className="is-current">Playground</span>
            <span>Docs</span>
            <span>Install</span>
          </nav>
          <div style={{ display: 'flex', gap: 8 }}>
            <span className="glass-button" style={{ minHeight: 34, paddingInline: 10 }}>⌘K</span>
            <span className="glass-button" style={{ minHeight: 34 }}>GitHub</span>
          </div>
        </div>
        <div className="controls-navbar__progress" />
      </header>

      <section className="controls-columns">
        <article className="controls-desk glass-pane">
          <CardGlassLayer radius={22} />
          <div className="controls-desk__preview">
            <LightField />
            <LiquidGlass
              className="controls-desk__reading"
              config={{
                appearance: 'dark',
                quality: 'ultra',
                borderRadius: 34,
                blur: 6,
                bezelWidth: 24,
                refractionStrength: 30,
                tintOpacity: 0.14,
                refractionMode: 'svg',
                respectPreferences: false,
              }}
            >
              <div className="controls-desk__reading-content">
                <span>Light intensity</span>
                <strong>78<small>%</small></strong>
              </div>
            </LiquidGlass>
          </div>

          <div className="controls-desk__panel">
            <div className="controls-desk__head">
              <h3>Spectrum console</h3>
              <LiquidGlass
                className="controls-circle-btn"
                config={{
                  appearance: 'dark',
                  borderRadius: 999,
                  bezelWidth: 12,
                  blur: 2,
                  refractionStrength: 18,
                  tintOpacity: 0.14,
                  edgeHighlight: 0.86,
                  refractionMode: 'svg',
                  respectPreferences: false,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M4.2 3.2 13 8l-8.8 4.8Z" />
                </svg>
              </LiquidGlass>
            </div>

            <div className="controls-slider-box">
              <div className="controls-slider-head">
                <span>Intensity</span>
                <output>78%</output>
              </div>
              <div className="controls-slider-rail">
                <div className="controls-slider-fill" />
                <div className="controls-slider-thumb" />
              </div>
            </div>

            <div className="controls-switch-row">
              <span>High contrast</span>
              <div className="motion-toggle-track" data-on="true">
                <div className="motion-toggle-thumb" style={{ transform: 'translateX(28px)' }}>
                  <LiquidGlass
                    className="motion-toggle-glass"
                    config={{
                      appearance: 'dark',
                      quality: 'low',
                      borderRadius: 999,
                      blur: 1,
                      refractionStrength: 10,
                      bezelWidth: 9,
                      thickness: 12,
                      tintOpacity: 0.14,
                      elevation: 0,
                      refractionMode: 'svg',
                      respectPreferences: false,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </article>

        <article className="controls-palette-card glass-pane">
          <CardGlassLayer radius={22} />
          <div className="controls-palette-search">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <circle cx="7" cy="7" r="4.8" />
              <path d="m10.8 10.8 3.2 3.2" strokeLinecap="round" />
            </svg>
            <span>Find a page or demo</span>
            <span className="controls-palette-kbd">Esc</span>
          </div>

          <div className="controls-palette-list">
            <div className="controls-palette-item is-selected">
              <span>Playground &amp; Animation Studio</span>
              <span>/playground/</span>
            </div>
            <div className="controls-palette-item">
              <span>API Reference &amp; Config Explorer</span>
              <span>/docs/</span>
            </div>
            <div className="controls-palette-item">
              <span>Merging Droplets (LiquidGroup)</span>
              <span>/#flow</span>
            </div>
            <div className="controls-palette-item">
              <span>Optical Magnifier Lens</span>
              <span>/#magnify</span>
            </div>
          </div>

          <div className="controls-cta-row">
            <span className="controls-cta-row__tag">quick-liquid/react</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <span className="glass-button glass-button--bright">Open Playground</span>
              <span className="glass-button">Read the docs</span>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}

/* ─────────────────────────── SCENE 7: QUALITY ─────────────────────────── */
const QUALITY_LIST = Object.keys(QUALITY_PRESETS) as GlassQuality[];
const QUALITY_RGB_NOTE: Record<GlassQuality, string> = {
  low: '1-ch fast path',
  medium: 'Auto RGB gate',
  high: 'Auto RGB gate',
  ultra: '2× edge map',
  extreme: 'Forced RGB prism',
};

function QualityScene() {
  useStudioReady(10);

  return (
    <main className="studio-canvas quality-scene">
      <div className="studio-dots" />
      <AtmosphereLayer />

      <header className="studio-header">
        <div>
          <span className="studio-kicker">QUALITY_PRESETS</span>
          <h1 className="studio-title">Five resolution tiers from compact controls to 3&times; optics</h1>
        </div>
        <span className="studio-code-chip">0.5× &rarr; 3× map density</span>
      </header>

      <section className="quality-grid">
        {QUALITY_LIST.map(tier => {
          const info = QUALITY_PRESETS[tier];
          return (
            <article className="quality-card glass-pane" key={tier}>
              <CardGlassLayer radius={18} />
              <div className="quality-card__stage">
                <LightField />
                <span className="quality-card__bg">Aa 01</span>
                <LiquidGlass
                  className="quality-card__lens"
                  config={{
                    quality: tier,
                    appearance: 'dark',
                    borderRadius: 24,
                    bezelWidth: 26,
                    thickness: 22,
                    refractionStrength: 36,
                    chromaticAberration: 0.48,
                    blur: 1.5,
                    tintOpacity: 0.04,
                    edgeHighlight: 0.92,
                    specularStrength: 0.45,
                    refractionMode: 'svg',
                    respectPreferences: false,
                  }}
                >
                  <span className="quality-card__pill">{tier}</span>
                </LiquidGlass>
              </div>
              <div className="quality-card__meta">
                <div className="quality-card__head">
                  <strong>{tier}</strong>
                  <span>{info.density}&times; / {info.cap}px</span>
                </div>
                <small>{QUALITY_RGB_NOTE[tier]}</small>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}

function StudioApp() {
  const param = new URLSearchParams(window.location.search).get('scene') as SceneId | null;
  switch (param) {
    case 'optics':
      return <OpticsScene />;
    case 'materials':
      return <MaterialsScene />;
    case 'droplets':
      return <DropletsScene />;
    case 'motion':
      return <MotionScene />;
    case 'controls':
      return <ControlsScene />;
    case 'quality':
      return <QualityScene />;
    case 'intro':
    default:
      return <IntroScene />;
  }
}

const rootEl = document.getElementById('studio-root');
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <StudioApp />
    </StrictMode>,
  );
}
