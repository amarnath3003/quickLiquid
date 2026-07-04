import { useCallback, useRef } from 'react';

/**
 * The quickliquid mascot — a glossy droplet with a face.
 * Poke it and it wobbles (same squash-and-stretch curve the engine uses).
 */
export function Droplet({
  size = 64,
  className = '',
  poke = true,
}: {
  size?: number;
  className?: string;
  poke?: boolean;
}) {
  const ref = useRef<SVGSVGElement>(null);

  const jiggle = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.remove('is-jiggling');
    // restart the animation
    void el.getBoundingClientRect();
    el.classList.add('is-jiggling');
  }, []);

  return (
    <svg
      ref={ref}
      className={`droplet ${className}`}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      onPointerDown={poke ? jiggle : undefined}
      role={poke ? 'button' : 'img'}
      aria-label={poke ? 'Poke the droplet' : 'quickliquid droplet'}
      style={poke ? { cursor: 'pointer' } : undefined}
    >
      <defs>
        <linearGradient id="dropInk" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#8fe8ff" />
          <stop offset="45%" stopColor="#4c9dff" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
        <radialGradient id="dropGlow" cx="0.32" cy="0.28" r="0.6">
          <stop offset="0%" stopColor="rgba(255,255,255,0.85)" />
          <stop offset="45%" stopColor="rgba(255,255,255,0.12)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>

      {/* body */}
      <path
        d="M50 4 C50 4 16 44 16 64 a34 34 0 0 0 68 0 C84 44 50 4 50 4 Z"
        fill="url(#dropInk)"
      />
      {/* inner glow */}
      <path
        d="M50 4 C50 4 16 44 16 64 a34 34 0 0 0 68 0 C84 44 50 4 50 4 Z"
        fill="url(#dropGlow)"
      />
      {/* specular highlight */}
      <ellipse cx="35" cy="38" rx="7.5" ry="13" fill="rgba(255,255,255,0.75)" transform="rotate(-24 35 38)" />
      <circle cx="30" cy="56" r="3" fill="rgba(255,255,255,0.5)" />

      {/* face */}
      <circle cx="42" cy="66" r="3.4" fill="#0b1224" />
      <circle cx="60" cy="66" r="3.4" fill="#0b1224" />
      <circle cx="43.2" cy="64.8" r="1.1" fill="#fff" />
      <circle cx="61.2" cy="64.8" r="1.1" fill="#fff" />
      <path d="M45 75 q6 5 12 0" stroke="#0b1224" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      {/* blush */}
      <ellipse cx="34" cy="72" rx="4" ry="2.2" fill="rgba(255,120,170,0.4)" />
      <ellipse cx="68" cy="72" rx="4" ry="2.2" fill="rgba(255,120,170,0.4)" />
    </svg>
  );
}
