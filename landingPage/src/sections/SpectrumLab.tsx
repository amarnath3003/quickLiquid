import { CardGlass } from '../components/CardGlass';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { LiquidGesture, LiquidGlassEngine } from 'quick-liquid';
import { LiquidGlassButton, LiquidSegmented } from 'quick-liquid/react';
import { GlassRange } from '../components/GlassControls';
import { LightField } from '../components/SiteShell';

const PRESETS = {
  Clear: { refractionStrength: 28, chromaticAberration: 12, blur: 0 },
  Frosted: { refractionStrength: 20, chromaticAberration: 8, blur: 18 },
  Spectral: { refractionStrength: 42, chromaticAberration: 54, blur: 1 },
};

type Preset = keyof typeof PRESETS;
type Optics = (typeof PRESETS)[Preset];

const PRESET_OPTIONS: { value: Preset; label: Preset }[] = [
  { value: 'Clear', label: 'Clear' },
  { value: 'Frosted', label: 'Frosted' },
  { value: 'Spectral', label: 'Spectral' },
];

const SLIDERS = [
  { key: 'refractionStrength', label: 'Refraction', max: 75, unit: ' px' },
  { key: 'chromaticAberration', label: 'Dispersion', max: 100, unit: '%' },
  { key: 'blur', label: 'Blur', max: 30, unit: ' px' },
] as const;

const DIRECTIONS = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

const DEFAULT_PRESET = 'Spectral';
const LENS_CONFIG = {
  quality: 'ultra',
  appearance: 'dark',
  borderRadius: 88,
  bezelWidth: 38,
  thickness: 26,
  tintOpacity: 0.035,
  saturation: 1.08,
  edgeHighlight: 0.9,
  specularStrength: 0.57,
  cursorTracking: true,
} as const;

export function SpectrumLab() {
  const [preset, setPreset] = useState<Preset | null>(DEFAULT_PRESET);
  const [optics, setOptics] = useState<Optics>(PRESETS[DEFAULT_PRESET]);
  const stage = useRef<HTMLDivElement>(null);
  const lens = useRef<HTMLDivElement>(null);
  const engine = useRef<LiquidGlassEngine | null>(null);
  const gesture = useRef<LiquidGesture | null>(null);
  const position = useRef({ x: 0, y: 0 });
  const config = useMemo(() => ({
    ...LENS_CONFIG,
    ...optics,
    chromaticAberration: optics.chromaticAberration / 100,
  }), [optics]);

  useEffect(() => {
    const element = lens.current;
    const scene = stage.current;
    if (!element || !scene) return;

    const glass = new LiquidGlassEngine(element, LENS_CONFIG);
    engine.current = glass;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const drag = new LiquidGesture(element, {
      pressScale: 0.96,
      pressSquish: 0.025,
      wobbleOnPress: false,
      scaleOnPress: !reducedMotion.matches,
      maxDragDistance: 106,
      rubberBandFactor: 0.1,
      flickMultiplier: 0.35,
    });
    drag.onRelease(() => {
      if (reducedMotion.matches) drag.getTransition().set({ x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1 });
    });
    gesture.current = drag;

    const observer = new ResizeObserver(() => {
      position.current = { x: 0, y: 0 };
      element.style.translate = '';
    });
    observer.observe(scene);
    return () => {
      observer.disconnect();
      drag.destroy();
      glass.destroy();
      gesture.current = null;
      engine.current = null;
    };
  }, []);

  useEffect(() => engine.current?.setConfig(config), [config]);

  function choosePreset(value: Preset) {
    setPreset(value);
    setOptics(PRESETS[value]);
  }

  function moveLens(event: KeyboardEvent<HTMLDivElement>) {
    if (!Object.prototype.hasOwnProperty.call(DIRECTIONS, event.key) || !stage.current || !lens.current) return;
    event.preventDefault();
    const [dx, dy] = DIRECTIONS[event.key as keyof typeof DIRECTIONS];
    const maxX = Math.max(0, (stage.current.clientWidth - lens.current.offsetWidth) / 2 - 12);
    const maxY = Math.max(0, (stage.current.clientHeight - lens.current.offsetHeight) / 2 - 12);
    const x = Math.max(-maxX, Math.min(maxX, position.current.x + 18 * dx));
    const y = Math.max(-maxY, Math.min(maxY, position.current.y + 18 * dy));
    position.current = { x, y };
    lens.current.style.translate = `${x}px ${y}px`;
  }

  function reset() {
    choosePreset(DEFAULT_PRESET);
    position.current = { x: 0, y: 0 };
    if (lens.current) lens.current.style.translate = '';
    gesture.current?.getTransition().set({ x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1 });
  }

  return (
    <section id="liquid" className="lens-console glass-pane" aria-label="Live glass lens">
      <CardGlass />
      <div className="material-stage" ref={stage}>
        <LightField className="material-beam" />
        <div className="material-sight" aria-hidden><i /><i /></div>
        <div className="material-lens" ref={lens} tabIndex={0}
          role="group" aria-label="Liquid glass lens" onKeyDown={moveLens}>
          <div className="ql-content"><span className="material-lens__grip" aria-hidden /></div>
        </div>
      </div>

      <div className="material-controls">
        <div className="material-controls__head">
          <LiquidSegmented
            options={PRESET_OPTIONS}
            value={preset ?? 'Spectral'}
            onChange={choosePreset}
            glass
            ariaLabel="Material preset"
            className={`material-presets${preset === null ? ' material-presets--custom' : ''}`}
          />
          <LiquidGlassButton className="material-reset glass-button" onClick={reset}>
            Reset
          </LiquidGlassButton>
        </div>
        <div className="material-sliders">
          {SLIDERS.map(({ key, label, max, unit }) => (
            <GlassRange key={key} label={label} value={optics[key]} max={max} valueText={`${optics[key]}${unit}`}
              onChange={value => {
                setPreset(null);
                setOptics(current => ({ ...current, [key]: value }));
              }} />
          ))}
        </div>
      </div>
    </section>
  );
}
