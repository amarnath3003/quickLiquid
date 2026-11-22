import { LiquidGlass } from 'quick-liquid/react';
import { LightField } from './SiteShell';

/**
 * Motion behind glass: three rows of display type scroll in alternating
 * directions and speeds while a single liquid-glass loupe glides across them.
 * The engine's lens is a live backdrop-filter (no snapshot), so the glass
 * keeps refracting whatever moving type it happens to be over as it sweeps.
 */
const ROWS = [
  { words: ['refraction', "snell's law", 'precomputed lut', 'cached maps', 'fresnel'], dir: 'left', dur: 34 },
  { words: ['surface tension', 'zero overhead', 'lensing', 'chromatic'], dir: 'right', dur: 42 },
  { words: ['spring physics', '60fps optics', 'inertia', 'morph', 'jiggle'], dir: 'left', dur: 28 },
] as const;

const LOUPE_CONFIG = {
  quality: 'ultra',
  blur: 0,
  refractionStrength: 24,
  thickness: 26,
  bezelWidth: 36,
  ior: 1.5,
  magnification: 1.08,
  tint: '122, 166, 214',
  tintOpacity: 0.055,
  saturation: 1.18,
  chromaticAberration: 0.14,
  appearance: 'dark',
  lightAngle: -32,
  edgeHighlight: 0.94,
  specularStrength: 0.34,
  fresnelPower: 2.8,
  cursorTracking: true,
  borderRadius: 96,
  elevation: 0.9,
} as const;

export function GlassMarquee() {
  return (
    <section id="motion" className="site-width motion-stage" aria-label="Live refraction sample">
      <div className="motion-bg" aria-hidden="true">
        <LightField className="motion-rays" />
        <div className="motion-rows">
          {ROWS.map((row, r) => {
            // Tripled so a -33.33% shift is exactly one set for a seamless loop.
            const line = [...row.words, ...row.words, ...row.words];
            return (
              <div
                key={r}
                className={`motion-row motion-row--${row.dir}`}
                style={{ animationDuration: `${row.dur}s` }}
              >
                {line.map((w, i) => (
                  <span key={i}>
                    {w}
                    <i>/</i>
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div className="motion-loupe" aria-hidden="true">
        <LiquidGlass className="motion-lens" animateIn={false} config={LOUPE_CONFIG} />
      </div>
    </section>
  );
}
