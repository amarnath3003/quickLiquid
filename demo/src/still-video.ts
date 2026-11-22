import { LiquidGlassEngine } from 'quick-liquid';

const digits = document.querySelector<HTMLElement>('.digits')!;
type Segment = { el: HTMLElement; x: number; y: number; phase: number; kind: 'h' | 'v' };
const segments: Segment[] = [];

const config = {
  material: 'clear' as const,
  appearance: 'light' as const,
  backdropLuminance: 0.92,
  blur: 0.2,
  saturation: 2,
  refractionStrength: 62,
  bezelWidth: 31,
  thickness: 30,
  ior: 1.58,
  chromaticAberration: 0.9,
  dispersionMode: 'exact' as const,
  tintOpacity: 0.015,
  edgeHighlight: 1,
  specularStrength: 0.62,
  fresnelPower: 1.7,
  elevation: 1.3,
  quality: 'high' as const,
  refractionMode: 'svg' as const,
  respectPreferences: false,
};

function add(x: number, y: number, w: number, h: number, phase: number) {
  const el = document.createElement('div');
  el.className = 'segment';
  Object.assign(el.style, {
    left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px`,
    borderRadius: `${Math.min(w, h) / 2}px`,
  });
  const core = document.createElement('div');
  core.className = 'segment-core';
  el.append(core);
  digits.append(el);
  new LiquidGlassEngine(el, { ...config, borderRadius: Math.min(w, h) / 2 });
  segments.push({ el, x, y, phase, kind: w > h ? 'h' : 'v' });
}

const T = 70, H = 178, L = 220;
function two(x: number, p: number) {
  add(x, 304, L, T, p); add(x + L - T, 339, T, H, p); add(x, 474, L, T, p);
  add(x, 509, T, H, p); add(x, 643, L, T, p);
}
function zero(x: number, p: number) {
  add(x, 304, L, T, p); add(x, 643, L, T, p);
  add(x, 339, T, 374, p); add(x + L - T, 339, T, 374, p);
}

two(105, 0); zero(388, .75); zero(671, 1.5);
add(967, 469, 185, T, 2.1); add(1025, 411, T, 185, 2.1);

const field = document.querySelector<HTMLElement>('.spectral-field')!;
const dark = document.querySelector<HTMLElement>('.dark-line')!;
const white = document.querySelector<HTMLElement>('.white-line')!;
const copy = document.querySelector<HTMLElement>('.microcopy')!;
const halo = document.querySelector<HTMLElement>('.halo')!;

function seek(ms: number) {
  const theta = (ms / 10_000) * Math.PI * 2;
  for (const segment of segments) {
    const wave = Math.sin(theta + segment.phase);
    const lift = Math.cos(theta + segment.phase * .75);
    segment.el.style.transform = `translate(${wave * 5}px, ${lift * 7}px) rotate(${wave * (segment.kind === 'h' ? .65 : -.65)}deg)`;
  }
  field.style.transform = `translateY(${Math.sin(theta) * 92}px) rotate(${-8 + Math.sin(theta) * 5}deg)`;
  dark.style.transform = `translateY(${Math.sin(theta + .8) * 105}px) rotate(${-9 + Math.cos(theta) * 4}deg)`;
  white.style.transform = `translateY(${Math.cos(theta + .2) * 125}px) rotate(${-7 + Math.sin(theta) * 4}deg)`;
  copy.style.transform = `translateX(${Math.sin(theta) * 150}px) translateY(${Math.cos(theta) * 65}px)`;
  halo.style.transform = `translateX(${Math.sin(theta + 1) * 45}px) scaleX(${1 + Math.sin(theta) * .08})`;
}

(window as unknown as { __STILL_VIDEO__: { seek: (ms: number) => void; duration: number } }).__STILL_VIDEO__ = { seek, duration: 10_000 };
document.fonts.ready.then(() => { seek(0); document.body.dataset.ready = 'true'; });
