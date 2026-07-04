/**
 * Ambient gooey blobs drifting behind the whole page.
 * Classic metaball trick: blur the blobs hard, then slam the alpha
 * channel's contrast so overlapping silhouettes fuse like mercury.
 */
export function Goo() {
  return (
    <div className="goo-field" aria-hidden>
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <filter id="page-goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="22" result="b" />
            <feColorMatrix
              in="b"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 26 -12"
            />
          </filter>
        </defs>
      </svg>
      <div className="goo-layer">
        <i className="goo-blob gb1" />
        <i className="goo-blob gb2" />
        <i className="goo-blob gb3" />
        <i className="goo-blob gb4" />
        <i className="goo-blob gb5" />
      </div>
    </div>
  );
}
