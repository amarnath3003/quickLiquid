const WORDS = [
  'refraction',
  'dispersion',
  'surface tension',
  "snell's law",
  'fresnel lobes',
  'metaballs',
  'spring physics',
  '60 fps',
  'zero shaders',
];

export function Marquee() {
  const track = WORDS.map((w, i) => (
    <span key={i}>
      <em>{w}</em>
      <i aria-hidden>◦</i>
    </span>
  ));
  return (
    <div className="marquee" aria-hidden>
      <div className="marquee__track">
        {track}
        {track.map((el, i) => (
          <span key={`b${i}`}>{el.props.children}</span>
        ))}
      </div>
    </div>
  );
}
