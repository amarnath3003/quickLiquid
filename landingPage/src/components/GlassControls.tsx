import { useId, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent } from 'react';
import { LiquidGlass } from 'quick-liquid/react';

const ICONS = {
  power: 'M12 3v8m-5.8-6a8 8 0 1 0 11.6 0',
  play: 'M8 5v14l11-7L8 5Z',
  pause: 'M9 5v14m6-14v14',
  search: 'M20 20l-4.3-4.3m1.8-4.2a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z',
} as const;

export function ControlIcon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

const THUMB_GLASS = {
  appearance: 'dark', borderRadius: 16, blur: 0, bezelWidth: 9, refractionStrength: 8,
  tintOpacity: 0.05, saturation: 1.15, edgeHighlight: 0.83, specularStrength: 0.24, elevation: 0,
} as const;

const RANGE_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']);

export function GlassRange({
  label, value, min = 0, max, step = 1, valueText, onChange,
}: {
  label: string; value: number; min?: number; max: number; step?: number; valueText: string;
  onChange: (value: number) => void;
}) {
  const [engaged, setEngaged] = useState(false);
  const pointer = useRef<number | null>(null);
  const rail = useRef<HTMLDivElement>(null);
  const id = useId();
  const ratio = max > min ? Math.max(0, Math.min(1, (value - min) / (max - min))) : 0;

  function updateFromPointer(event: PointerEvent<HTMLInputElement>) {
    const track = rail.current?.getBoundingClientRect();
    if (!track?.width) return;
    const fraction = Math.max(0, Math.min(1, (event.clientX - track.left) / track.width));
    const next = min + Math.round((max - min) * fraction / step) * step;
    const snapped = Math.max(min, Math.min(max, Number(next.toFixed(10))));
    if (snapped !== value) onChange(snapped);
  }

  function releasePointer(event: PointerEvent<HTMLInputElement>) {
    if (pointer.current !== event.pointerId) return;
    pointer.current = null;
    setEngaged(false);
  }

  return (
    <div className="glass-range">
      <label className="glass-range__label" htmlFor={id}>{label}<output aria-hidden="true">{valueText}</output></label>
      <div className="glass-range__control" data-engaged={engaged} style={{ '--range-position': `${ratio * 100}%` } as CSSProperties}>
        <div className="glass-range__rail" ref={rail} aria-hidden>
          <span className="glass-range__fill" />
          <div className="glass-range__thumb">
            <LiquidGlass className="glass-range__surface" config={THUMB_GLASS} />
            <span className="glass-range__cap" />
          </div>
        </div>
        <input
          id={id} type="range" value={value} min={min} max={max} step={step} aria-valuetext={valueText}
          onPointerDown={event => {
            if (event.button !== 0 || !event.isPrimary || pointer.current !== null) return;
            event.preventDefault();
            event.currentTarget.focus({ preventScroll: true });
            event.currentTarget.setPointerCapture(event.pointerId);
            pointer.current = event.pointerId;
            setEngaged(true);
            updateFromPointer(event);
          }}
          onPointerMove={event => {
            if (pointer.current === event.pointerId) updateFromPointer(event);
          }}
          onPointerUp={releasePointer} onPointerCancel={releasePointer} onLostPointerCapture={releasePointer}
          onBlur={() => setEngaged(false)}
          onKeyUp={event => { if (RANGE_KEYS.has(event.key)) setEngaged(false); }}
          onKeyDown={event => {
            if (RANGE_KEYS.has(event.key)) setEngaged(true);
          }}
          onChange={event => onChange(event.target.valueAsNumber)}
        />
      </div>
    </div>
  );
}
