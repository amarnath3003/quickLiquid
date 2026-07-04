import { LiquidGlass } from 'quick-liquid/react';

const FEATURES = [
  {
    tag: '01 · snell',
    title: 'Exact refraction, not art sliders',
    body: 'The displacement field is ray-traced through a convex bezel with vector Snell’s law. Thickness, bezel width and IOR are physical knobs — the “clear center, bent rim” look falls out of the math.',
  },
  {
    tag: '02 · dispersion',
    title: 'Chromatic aberration for free',
    body: 'Dispersion is a linear per-channel scale on one shared map: three feDisplacementMap scales, zero extra generation. Turn the prism up without paying for it.',
  },
  {
    tag: '03 · fresnel',
    title: 'Apple-signature lighting',
    body: 'A two-lobe conic rim — bright at the light angle and its mirror — plus a soft bezel sheen. Not a generic glassmorphism fog.',
  },
  {
    tag: '04 · lut',
    title: 'Heavily optimized maps',
    body: '1-D LUT reduction, bezel-band-only iteration, 4-fold symmetry, refcounted cache: 0.3–5 ms per unique geometry, and same-size elements share one map.',
  },
  {
    tag: '05 · metaballs',
    title: 'Droplets that merge',
    body: 'Metaball groups let adjacent glass blobs bridge and morph like water finding itself — you dragged some together in the hero just now.',
  },
  {
    tag: '06 · react + js',
    title: 'React-first, vanilla-friendly',
    body: 'A <LiquidGlass> component with mount springs, jiggles and press physics — or attach LiquidGlassEngine to any element in plain JavaScript.',
  },
];

export function Features() {
  return (
    <section className="section" id="features">
      <div className="section-head">
        <span className="section-kicker">why quickliquid</span>
        <h2 className="display">
          Real optics. <em className="ink">Minimal</em> compute.
        </h2>
        <p>
          Every layer — lens, tint, sheen, rim — is derived from a physical model of a glass slab,
          then aggressively optimized for the browser. These cards? Also glass.
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
              className="feature-card"
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
