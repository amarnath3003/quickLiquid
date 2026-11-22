import { CardGlass } from '../components/CardGlass';
import {
  StrictMode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { createRoot } from 'react-dom/client';
import {
  DEFAULT_CONFIG,
  LiquidPopover,
  MATERIAL_PRESETS,
  QUALITY_PRESETS,
  type GlassQuality,
  type LiquidGlassConfig,
} from 'quick-liquid';
import {
  LiquidGlass,
  LiquidGlassButton,
  LiquidSegmented,
  LiquidSwitcher,
  LiquidToggle,
  useLiquidInteractive,
} from 'quick-liquid/react';
import { CodeBlock } from '../components/CodeBlock';
import { GlassRange } from '../components/GlassControls';
import { LightField, SiteShell } from '../components/SiteShell';
import { AnimationStudio } from './AnimationStudio';
import '@fontsource-variable/outfit';
import '@fontsource-variable/jetbrains-mono';
import '../site-shell.css';
import './material-lab.css';

const SCENES = [
  { id: 'spectrum', label: 'Spectrum' },
  { id: 'video', label: 'Video' },
  { id: 'photo', label: 'Photo' },
  { id: 'type', label: 'Type' },
  { id: 'lines', label: 'Fine lines' },
  { id: 'contrast', label: 'Contrast' },
] as const;

type Scene = (typeof SCENES)[number]['id'];
const SCENE_OPTIONS = SCENES.map(item => ({ value: item.id, label: item.label }));

const QUALITY_TIERS = Object.keys(QUALITY_PRESETS) as GlassQuality[];
const formatQualityTier = (tier: GlassQuality) => tier[0].toUpperCase() + tier.slice(1);

function QualitySelect({ value, onChange }: { value: GlassQuality; onChange: (next: GlassQuality) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const popoverRef = useRef<LiquidPopover | null>(null);
  const closingRef = useRef(false);
  const focusOnOpenRef = useRef(false);
  const triggerInteractiveRef = useLiquidInteractive<HTMLButtonElement>({
    pressScale: 0.96,
    pressSquish: 0.03,
    hoverLift: 1.5,
    hoverScale: 1.015,
    ripple: true,
  });

  useEffect(() => {
    popoverRef.current = new LiquidPopover({ origin: 'top right' });
    return () => {
      popoverRef.current?.destroy();
      popoverRef.current = null;
    };
  }, []);

  const closeMenu = useCallback((restoreFocus = false) => {
    if (!open || closingRef.current) return;
    const el = menuRef.current;
    if (!el || !popoverRef.current) {
      setOpen(false);
      if (restoreFocus) triggerInteractiveRef.current?.focus();
      return;
    }
    closingRef.current = true;
    void popoverRef.current.close(el).then(() => {
      closingRef.current = false;
      setOpen(false);
      if (restoreFocus) triggerInteractiveRef.current?.focus();
    });
  }, [open, triggerInteractiveRef]);

  useEffect(() => {
    if (!open || !menuRef.current) return;
    popoverRef.current?.open(menuRef.current);

    if (focusOnOpenRef.current) {
      focusOnOpenRef.current = false;
      const selectedBtn = menuRef.current.querySelector<HTMLButtonElement>('[aria-selected="true"]')
        ?? menuRef.current.querySelector<HTMLButtonElement>('[role="option"]');
      selectedBtn?.focus();
    }

    function onPointerDown(event: PointerEvent) {
      if (root.current && !root.current.contains(event.target as Node)) closeMenu();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeMenu(true);
    }
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, closeMenu]);

  function select(tier: GlassQuality) {
    onChange(tier);
    closeMenu(true);
  }

  function onTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        focusOnOpenRef.current = true;
        closingRef.current = false;
        setOpen(true);
      } else {
        const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []);
        const idx = QUALITY_TIERS.indexOf(value);
        const nextIdx = event.key === 'ArrowDown'
          ? Math.min(items.length - 1, idx + 1)
          : Math.max(0, idx - 1);
        items[nextIdx]?.focus();
      }
    }
  }

  function onMenuKeyDown(event: ReactKeyboardEvent<HTMLUListElement>) {
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]'));
    if (!items.length) return;
    const currentIdx = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      items[(currentIdx + 1) % items.length]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      items[(currentIdx - 1 + items.length) % items.length]?.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      items[0]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      items[items.length - 1]?.focus();
    } else if (event.key === 'Tab') {
      closeMenu();
    }
  }

  const preset = QUALITY_PRESETS[value];

  return (
    <div className="lab-select" ref={root} data-open={open}>
      <button
        ref={triggerInteractiveRef}
        id="glass-quality"
        type="button"
        className="glass-button lab-select__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby="glass-quality-label glass-quality"
        onClick={() => {
          if (open) closeMenu();
          else {
            closingRef.current = false;
            setOpen(true);
          }
        }}
        onKeyDown={onTriggerKeyDown}
      >
        <span>{formatQualityTier(value)}</span>
        <span className="lab-select__spec">{preset.density}×</span>
        <svg className="lab-select__chevron" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4.2 6.2 8 10l3.8-3.8" />
        </svg>
      </button>
      {open && (
        <ul
          ref={menuRef}
          className="lab-select__menu glass-pane"
          role="listbox"
          aria-labelledby="glass-quality-label"
          onKeyDown={onMenuKeyDown}
        >
          {QUALITY_TIERS.map(tier => {
            const info = QUALITY_PRESETS[tier];
            return (
              <li key={tier} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={tier === value}
                  className="lab-select__option"
                  onClick={() => select(tier)}
                >
                  <span className="lab-select__option-head">
                    <strong>{formatQualityTier(tier)}</strong>
                    <span>{info.density}×</span>
                  </span>
                  <small>{info.description}</small>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const SHAPES = ['card', 'pill', 'circle'] as const;
const SHAPE_OPTIONS = SHAPES.map(value => ({ value, label: value }));

const MATERIALS = ['clear', 'thin', 'regular', 'thick'] as const;
const MATERIAL_OPTIONS = MATERIALS.map(value => ({ value, label: value }));

const THEME_OPTIONS = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
] as const;

const SWATCHES = [
  { material: 'clear', description: 'Strong edge refraction with a clear view through the center.' },
  { material: 'regular', description: 'Softens the scene behind controls and readable content.' },
  { material: 'thick', description: 'Blurs more of the background for greater separation.' },
] as const;

const SLIDERS = [
  ['blur', 'Frost', 0, 30, 0.5, ' px'],
  ['refractionStrength', 'Refraction', 0, 50, 1, ' px'],
  ['chromaticAberration', 'Dispersion', 0, 1, 0.01, ''],
  ['bezelWidth', 'Bezel', 8, 60, 1, ' px'],
  ['magnification', 'Magnification', 1, 3, 0.1, '×'],
  ['lightAngle', 'Light direction', -180, 180, 1, '°'],
  ['specularStrength', 'Surface reflection', 0, 1, 0.01, ''],
] as const;

const DIRECTIONS: Record<string, [number, number]> = {
  ArrowLeft: [-16, 0], ArrowRight: [16, 0], ArrowUp: [0, -16], ArrowDown: [0, 16],
};

type Shape = (typeof SHAPES)[number];
type Material = (typeof MATERIALS)[number];

function Lab() {
  const [dark, setDark] = useState(true);
  const [scene, setScene] = useState<Scene>('spectrum');
  const [shape, setShape] = useState<Shape>('card');
  const [material, setMaterial] = useState<Material>('clear');
  const [overrides, setOverrides] = useState<Partial<LiquidGlassConfig>>({});
  const [quality, setQuality] = useState<GlassQuality>(DEFAULT_CONFIG.quality);
  const [motion, setMotion] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const mirror = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const offset = useRef({ x: 0, y: 0 });
  const pointer = useRef<{ id: number; x: number; y: number; ox: number; oy: number } | null>(null);
  const lensRadius = shape === 'card' ? 48 : 999;
  const declaration = useMemo(() => ({
    quality,
    ...(material === 'clear' ? { blur: 0.5, magnification: 1.2, saturation: 1.13 } : {}),
    specularStrength: 0.7,
    ...overrides,
    material,
    borderRadius: lensRadius,
    appearance: dark ? 'dark' as const : 'light' as const,
  }), [quality, material, lensRadius, dark, overrides]);
  const config = { ...DEFAULT_CONFIG, ...MATERIAL_PRESETS[material], ...declaration };

  const move = useCallback((x: number, y: number) => {
    if (!host.current || !stage.current) return;
    const maxX = Math.max(0, (stage.current.clientWidth - host.current.offsetWidth) / 2 - 10);
    const maxY = Math.max(0, (stage.current.clientHeight - host.current.offsetHeight) / 2 - 10);
    offset.current = {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
    const style = host.current.style;
    style.setProperty('--scene-width', stage.current.clientWidth + 'px');
    style.setProperty('--scene-height', stage.current.clientHeight + 'px');
    style.setProperty('--scene-x', -offset.current.x + 'px');
    style.setProperty('--scene-y', -offset.current.y + 'px');
    host.current.style.translate = `${offset.current.x}px ${offset.current.y}px`;
  }, []);

  useEffect(() => {
    const element = host.current;
    const viewport = stage.current;
    if (!element || !viewport) return;
    const observer = new ResizeObserver(() => move(offset.current.x, offset.current.y));
    observer.observe(viewport);
    observer.observe(element);
    return () => observer.disconnect();
  }, [move]);

  useEffect(() => {
    const media = video.current;
    if (!media || scene !== 'video' || !motion) return;

    let active = true;
    void media.play().catch(() => {
      if (active) setMotion(false);
    });
    return () => {
      active = false;
      media.pause();
    };
  }, [scene, motion]);

  useEffect(() => {
    const media = video.current;
    const canvas = mirror.current;
    if (!media || !canvas || scene !== 'video') return;
    const ctx = canvas.getContext('2d');
    let frame = 0;
    const paint = () => {
      if (!ctx || !media.videoWidth || media.readyState < 2 || (media.paused && !media.played.length)) return;
      if (canvas.width !== media.videoWidth || canvas.height !== media.videoHeight) {
        canvas.width = media.videoWidth;
        canvas.height = media.videoHeight;
      }
      ctx.drawImage(media, 0, 0);
    };
    const tick = () => { paint(); if (!media.paused) frame = requestAnimationFrame(tick); };
    const start = () => { cancelAnimationFrame(frame); tick(); };
    start();
    media.addEventListener('loadeddata', paint);
    media.addEventListener('seeked', paint);
    media.addEventListener('playing', start);
    return () => {
      cancelAnimationFrame(frame);
      media.removeEventListener('loadeddata', paint);
      media.removeEventListener('seeked', paint);
      media.removeEventListener('playing', start);
    };
  }, [scene]);

  function renderScene(inside: boolean) {
    return (
      <div className="lab-scenery" aria-hidden="true">
        {scene === 'spectrum' && <LightField className="lab-spectrum" />}
        {scene === 'video' && (inside ? <canvas ref={mirror} className="lab-media lab-video-copy" /> : <video ref={video} className="lab-media" src="/stock-pool.mp4" poster="/stock-pool-poster.jpg" muted loop playsInline preload="auto" />)}
        {scene === 'photo' && <img className="lab-media" src="/playground-coast.webp" alt="" />}
        {scene === 'lines' && <div className="lab-lines"><span>1 px</span><span>8 px</span><span>48 px</span></div>}
        {scene === 'contrast' && <div className="lab-contrast"><span>Aa</span><span>Aa</span><i /></div>}
        {scene === 'type' && (
          <div className="lab-type">
            <b>Refraction<br />stays readable</b>
            <small>ABCDEFG 0123456789</small>
          </div>
        )}
      </div>
    );
  }

  function selectMaterial(next: Material) {
    setMaterial(next);
    setOverrides({});
  }

  function reset() {
    selectMaterial('clear');
    setQuality(DEFAULT_CONFIG.quality);
    setShape('card');
    setDark(true);
    move(0, 0);
  }

  function renderSlider([key, label, min, max, step, unit]: (typeof SLIDERS)[number]) {
    const value = config[key] ?? 1;
    return (
      <GlassRange key={key} label={label} min={min} max={max} step={step} value={value}
        valueText={`${value.toFixed(step === 0.01 ? 2 : step < 1 ? 1 : 0)}${unit}`}
        onChange={next => setOverrides(previous => ({ ...previous, [key]: next }))} />
    );
  }

  const snippet = `<LiquidGlass config={{
${Object.entries(declaration).map(([key, value]) => `  ${key}: ${JSON.stringify(value)},\n`).join('')}}}>
  {/* Your content */}
</LiquidGlass>`;

  const exactDispersion = quality === 'extreme' || (quality !== 'low' && overrides.dispersionMode === 'exact');

  return (
    <SiteShell page="playground" skipTo="#workbench">
      <main className="site-width lab-page" id="workbench">
        <header className="lab-intro">
          <h1>Glass playground</h1>
        </header>

        <div className="lab-workbench glass-pane">
          <section className="lab-preview" aria-label="Material preview">
            <div className="lab-toolbar">
              <LiquidSegmented
                options={SCENE_OPTIONS}
                value={scene}
                onChange={next => {
                  setScene(next);
                  setMotion(false);
                }}
                glass
                ariaLabel="Backdrop"
                className="lab-scenes"
              />
              <div className="lab-toolbar__actions">
                <LiquidGlassButton
                  className="glass-button"
                  aria-pressed={motion}
                  onClick={() => setMotion(current => !current)}
                >
                  {motion ? 'Pause' : scene === 'video' ? 'Play video' : 'Move scene'}
                </LiquidGlassButton>
              </div>
            </div>

            <div className={`lab-stage lab-stage--${scene}${motion ? ' is-moving' : ''}`} data-theme={dark ? 'dark' : 'light'} ref={stage}>
              {renderScene(false)}

              <div className={`lab-lens lab-lens--${shape}`} ref={host} tabIndex={0} role="group"
                aria-label="Glass lens"
                onPointerDown={event => {
                  if (event.button !== 0 || pointer.current) return;
                  pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY, ox: offset.current.x, oy: offset.current.y };
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={event => {
                  const drag = pointer.current;
                  if (drag?.id === event.pointerId) move(drag.ox + event.clientX - drag.x, drag.oy + event.clientY - drag.y);
                }}
                onLostPointerCapture={event => {
                  if (pointer.current?.id === event.pointerId) pointer.current = null;
                }}
                onKeyDown={event => {
                  if (!Object.prototype.hasOwnProperty.call(DIRECTIONS, event.key)) return;
                  const delta = DIRECTIONS[event.key];
                  event.preventDefault();
                  move(offset.current.x + delta[0], offset.current.y + delta[1]);
                }}>
                <LiquidGlass className="lab-lens__glass" config={declaration}
                  opticalSource={<div className="lab-source-frame">{renderScene(true)}</div>} />
              </div>
            </div>

            {scene === 'video' && (
              <p className="lab-video-credit">
                <a href="https://www.pexels.com/video/sunlight-over-building-and-swimming-pool-in-city-11157345/" target="_blank" rel="noreferrer">Video by Atif Dar</a>
              </p>
            )}

            <div className="lab-export glass-pane">
              <CardGlass />
              <LiquidSwitcher activeKey={material} direction={0}>
                <CodeBlock key={snippet} code={snippet} lang="tsx" title="React configuration" />
              </LiquidSwitcher>
            </div>
          </section>

          <aside className="lab-controls glass-pane" aria-label="Material controls">
            <CardGlass />
            <div className="lab-control-title">
              <h2>Lens settings</h2>
              <LiquidGlassButton className="glass-button" onClick={reset}>Reset</LiquidGlassButton>
            </div>

            <div className="lab-control-row lab-control-row--materials">
              <span>Material</span>
              <LiquidSegmented
                options={MATERIAL_OPTIONS}
                value={material}
                onChange={selectMaterial}
                glass
                ariaLabel="Material"
                className="lab-materials"
              />
            </div>

            <div className="lab-control-row lab-control-row--quality">
              <span id="glass-quality-label">Render quality</span>
              <QualitySelect value={quality} onChange={setQuality} />
            </div>
            <div className="lab-sliders">{SLIDERS.slice(0, 3).map(renderSlider)}</div>

            <details className="lab-advanced">
              <summary>Advanced settings</summary>
              <div className="lab-control-row">
                <span>Appearance</span>
                <LiquidSegmented
                  options={THEME_OPTIONS}
                  value={dark ? 'dark' : 'light'}
                  onChange={next => setDark(next === 'dark')}
                  glass
                  ariaLabel="Lens appearance"
                />
              </div>
              <div className="lab-control-row">
                <span>Shape</span>
                <LiquidSegmented
                  options={SHAPE_OPTIONS}
                  value={shape}
                  onChange={value => { setShape(value); move(0, 0); }}
                  glass
                  ariaLabel="Lens shape"
                  className="lab-shapes"
                />
              </div>
              <div className="lab-sliders lab-sliders--advanced">{SLIDERS.slice(3).map(renderSlider)}</div>
              <div className="lab-control-row lab-control-row--toggle">
                <span>Always use exact dispersion</span>
                <LiquidToggle
                  checked={exactDispersion}
                  disabled={quality === 'low' || quality === 'extreme'}
                  label="Always use exact dispersion"
                  onChange={checked => {
                    setOverrides(previous => ({ ...previous, dispersionMode: checked ? 'exact' : 'auto' }));
                  }}
                />
              </div>
              <p className="lab-note">Automatic mode skips color splitting when the frost is heavy.</p>
            </details>
          </aside>
        </div>

        <AnimationStudio />

        <section className="lab-family" aria-labelledby="family-title">
          <div className="lab-family__head">
            <h2 id="family-title">Compare materials</h2>
            <LiquidGlassButton className="glass-button" href="/docs/#materials">
              Preset reference
            </LiquidGlassButton>
          </div>
          <div className="lab-material-strip glass-pane">
            <CardGlass />
            {SWATCHES.map(({ material: value, description }) => (
              <article className="lab-swatch glass-pane" key={value}>
                <CardGlass />
                <div className="lab-swatch__scene">
                  <LightField className="lab-swatch__beam" />
                  <LiquidGlass className="lab-swatch__lens" config={{ material: value, appearance: 'dark', borderRadius: 28 }}>
                    <h3>{value}</h3>
                  </LiquidGlass>
                </div>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </SiteShell>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><Lab /></StrictMode>);
