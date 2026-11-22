import type { CSSProperties } from 'react';

const COLORS = ['#fa799b', '#f5a07b', '#edd28f', '#9de2be', '#7ce0dd', '#82acff', '#ae94f1'];

/** A single optical field shared by all routes, including the install section. */
export function Atmosphere() {
  return (
    <div className="site-atmosphere" aria-hidden="true">
      <svg className="atmosphere-ribbons" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="ribbon-aura">
            <stop stopColor="#5570b5" stopOpacity=".26" />
            <stop offset="1" stopColor="#5570b5" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g className="atmosphere-drift">
          <ellipse cx="1020" cy="388" rx="640" ry="145" fill="url(#ribbon-aura)" transform="rotate(-17 1020 388)" />
          {COLORS.map((color, i) => {
            const offset = i - 3;
            const curve = `M -230 ${740 + offset * 18} C 110 ${520 + offset * 32}, 365 ${835 + offset * 21}, 656 ${618 + offset * 14} S 1000 ${176 + offset * 23}, 1670 ${199 + offset * 30}`;
            return (
              <g key={color} fill="none" stroke={color} style={{ '--phase': `${-i * 2.7}s` } as CSSProperties}>
                <path d={curve} strokeWidth="13" opacity=".023" />
                <path d={curve} strokeWidth={i % 3 === 0 ? 1.8 : 1} opacity=".36" />
                <path className="atmosphere-glint" d={curve} pathLength="1000" strokeWidth="2.5" strokeLinecap="round" />
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
