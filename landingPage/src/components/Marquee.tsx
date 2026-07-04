import { LiquidGlass } from 'quick-liquid/react';

/**
 * Motion behind glass — bold type slides right-to-left underneath two real
 * glass panels (one clear, one frosted), so the lensing is visible on
 * moving content. Mirrors the demo app's motion stage.
 */
const WORDS = [
  'surface tension',
  "snell's law",
  'fresnel lobes',
  'dispersion',
  'refraction',
  'spring physics',
];

export function GlassMarquee() {
  const row = [...WORDS, ...WORDS];
  return (
    <section className="motion" aria-label="Motion behind glass">
      <div className="motion-head">
        <span className="motion-head__label">motion behind glass</span>
        <span className="motion-head__note">same scene, two materials — rendered live</span>
      </div>
      <div className="motion-stage">
        <div className="motion-bg" aria-hidden>
          <i className="motion-beam" />
          <div className="motion-track">
            {row.map((w, i) => (
              <span key={i}>
                {w}
                <i>·</i>
              </span>
            ))}
          </div>
          <i className="motion-ball mball-1" />
          <i className="motion-ball mball-2" />
          <i className="motion-ball mball-3" />
          <i className="motion-grid" />
        </div>

        <LiquidGlass
          className="motion-glass motion-glass--clear"
          config={{
            blur: 1.5,
            refractionStrength: 28,
            thickness: 28,
            bezelWidth: 34,
            tintOpacity: 0.02,
            chromaticAberration: 0.35,
            appearance: 'dark',
            borderRadius: 26,
          }}
        >
          <span className="motion-label">clear — pure lens</span>
        </LiquidGlass>

        <LiquidGlass
          className="motion-glass motion-glass--frosted"
          config={{
            blur: 16,
            tintOpacity: 0.09,
            refractionStrength: 14,
            thickness: 20,
            bezelWidth: 22,
            appearance: 'dark',
            borderRadius: 26,
          }}
        >
          <span className="motion-label">frosted — blur + tint</span>
        </LiquidGlass>
      </div>
    </section>
  );
}
