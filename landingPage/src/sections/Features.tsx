import { LiquidGlass } from 'quick-liquid/react';

const FEATURES = [
  {
    tag: 'Optics',
    title: 'Refraction from real geometry',
    body: 'The displacement field is traced through a convex bezel with vector Snell law. Thickness, bezel width and IOR stay physical.',
  },
  {
    tag: 'Color',
    title: 'Prism edges without extra maps',
    body: 'Dispersion is a linear per-channel scale on one shared map: three feDisplacementMap scales, zero extra generation. Turn the prism up without paying for it.',
  },
  {
    tag: 'Light',
    title: 'Rim light that reads as glass',
    body: 'A two-lobe conic rim plus a soft bezel sheen gives the material an edge instead of a generic blur fog.',
  },
  {
    tag: 'Cache',
    title: 'Optimized where it matters',
    body: 'LUT reduction, bezel-band iteration, symmetry and refcounted maps keep repeated glass elements cheap.',
  },
  {
    tag: 'Motion',
    title: 'Droplets that can merge',
    body: 'Metaball groups let nearby glass blobs bridge and morph, so the interface can behave like a material.',
  },
  {
    tag: 'API',
    title: 'React-first, vanilla-friendly',
    body: 'Use the React component for product UI, or attach LiquidGlassEngine to any element in plain JavaScript.',
  },
];

export function Features() {
  return (
    <section className="section" id="features">
      <div className="section-head">
        <span className="section-kicker">why quickliquid</span>
        <h2 className="display">
          Built like a material, not a backdrop blur.
        </h2>
        <p>
          The lens, tint, sheen and rim come from one physical model, then get trimmed for the browser.
        </p>
      </div>

      <div className="features-wrap">
        <div className="features-glow" aria-hidden>
          <i className="fg1" />
          <i className="fg2" />
          <i className="fg3" />
        </div>
        <div className="features-grid">
          {FEATURES.map((f, i) => (
            <LiquidGlass
              key={f.tag}
              className={`feature-card feature-card--${i}`}
              animateIn={i * 80}
              config={{
                material: 'thin',
                appearance: 'dark',
                borderRadius: 24,
                tintOpacity: 0.09,
                specularStrength: 0.2,
                edgeHighlight: 0.55,
              }}
            >
              <article className="feature-card__body">
                <span className="feature-card__visual" aria-hidden>
                  <i />
                  <i />
                  <i />
                </span>
                <span className="feature-card__tag">{f.tag}</span>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </article>
            </LiquidGlass>
          ))}
        </div>
      </div>
    </section>
  );
}
