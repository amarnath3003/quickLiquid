const FEATURES = [
  {
    icon: '🔬',
    title: 'Exact refraction, not art sliders',
    body: 'The displacement field is ray-traced through a convex bezel with vector Snell’s law. Thickness, bezel width and IOR are physical knobs — the “clear center, bent rim” look falls out of the math.',
  },
  {
    icon: '🌈',
    title: 'Chromatic aberration for free',
    body: 'Dispersion is a linear per-channel scale on one shared map: three feDisplacementMap scale attributes, zero extra map generation. Turn the prism up without paying for it.',
  },
  {
    icon: '✨',
    title: 'Apple-signature lighting',
    body: 'A two-lobe conic rim — bright at the light angle and its mirror — plus a soft bezel sheen. Not a generic glassmorphism fog.',
  },
  {
    icon: '⚡',
    title: 'Heavily optimized maps',
    body: '1-D LUT reduction (no per-pixel trig), bezel-band-only iteration, 4-fold symmetry and a refcounted cache: 0.3–5 ms per unique geometry, and same-size elements share one map.',
  },
  {
    icon: '💧',
    title: 'Water-droplet merging',
    body: 'Metaball groups let adjacent glass blobs blend and morph on the fly, with spring-physics gestures, tab bars and layout transitions in the same toolkit.',
  },
  {
    icon: '⚛️',
    title: 'React-first, vanilla-friendly',
    body: 'A <LiquidGlass> component with mount springs, jiggles and press physics — or attach LiquidGlassEngine to any element in plain JavaScript.',
  },
];

export function Features() {
  return (
    <section className="section" id="features">
      <div className="section-head">
        <span className="section-kicker">Why QuickLiquid</span>
        <h2>Real optics. Minimal compute.</h2>
        <p>
          Every layer of the stack — lens, tint, sheen, rim — is derived from a physical model of a
          glass slab, then aggressively optimized for the browser.
        </p>
      </div>
      <div className="features-grid">
        {FEATURES.map(f => (
          <article className="feature-card" key={f.title}>
            <span className="feature-card__icon" aria-hidden>
              {f.icon}
            </span>
            <h3>{f.title}</h3>
            <p>{f.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
