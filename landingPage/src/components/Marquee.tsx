import { LiquidGlass } from 'quick-liquid/react';

/**
 * Motion behind glass — three rows of display type scroll in alternating
 * directions and speeds while a single liquid-glass loupe glides across them.
 * The engine's lens is a live backdrop-filter (no snapshot), so the glass
 * keeps refracting whatever moving type it happens to be over as it sweeps.
 */
const ROWS = [
  { words: ['refraction', "snell's law", 'fresnel', 'dispersion', 'caustics'], dir: 'left', dur: 30 },
  { words: ['surface tension', 'chromatic', 'lensing', 'index of refraction'], dir: 'right', dur: 38 },
  { words: ['spring physics', 'squash & stretch', 'inertia', 'morph', 'jiggle'], dir: 'left', dur: 24 },
];

export function GlassMarquee() {
  return (
    <section className="motion" aria-label="Motion behind glass">
      <div className="motion-head">
        <span className="motion-head__label">motion behind glass</span>
        <span className="motion-head__note">a live lens sweeping over moving type</span>
      </div>
      <div className="motion-stage">
        <div className="motion-bg" aria-hidden>
          <i className="motion-beam" />
          <div className="motion-rows">
            {ROWS.map((row, r) => {
              // tripled so a −33.33% shift is exactly one set → seamless loop
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
                      <i>·</i>
                    </span>
                  ))}
                </div>
              );
            })}
          </div>
          <i className="motion-grid" />
        </div>

        <div className="motion-loupe" aria-hidden>
          <LiquidGlass
            className="motion-lens"
            animateIn={false}
            config={{
              blur: 0.5,
              refractionStrength: 34,
              thickness: 32,
              bezelWidth: 12,
              tintOpacity: 0.02,
              chromaticAberration: 0.55,
              appearance: 'dark',
              borderRadius: 30,
              elevation: 1.15,
            }}
          />
        </div>
      </div>
    </section>
  );
}
