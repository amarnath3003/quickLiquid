/**
 * Drippy section divider — a thin wet band with teardrops hanging off it.
 * Each drop is the mascot's teardrop silhouette, scaled and offset.
 */
const DROP_PATH =
  'M0 -26 C0 -26 -10 -12.5 -10 -6.5 a10 10 0 0 0 20 0 C10 -12.5 0 -26 0 -26 Z';

const DRIPS: { x: number; hang: number; s: number }[] = [
  { x: 110, hang: 14, s: 0.7 },
  { x: 300, hang: 4, s: 0.45 },
  { x: 470, hang: 26, s: 0.95 },
  { x: 640, hang: 8, s: 0.55 },
  { x: 800, hang: 34, s: 1.1 },
  { x: 985, hang: 3, s: 0.4 },
  { x: 1150, hang: 18, s: 0.8 },
  { x: 1340, hang: 9, s: 0.6 },
];

export function Drip({ className = '' }: { className?: string }) {
  return (
    <div className={`drip ${className}`} aria-hidden>
      <svg viewBox="0 0 1440 100" preserveAspectRatio="none" width="100%" height="100%">
        <g fill="currentColor">
          <rect x="0" y="0" width="1440" height="7" rx="3.5" />
          {DRIPS.map((d, i) => (
            <g key={i} className="drip-drop" style={{ animationDelay: `${i * 0.9}s` }}>
              {/* short goo neck connecting band to drop */}
              <rect
                x={d.x - 5 * d.s}
                y="2"
                width={10 * d.s}
                height={d.hang + 8}
                rx={5 * d.s}
              />
              <path
                d={DROP_PATH}
                transform={`translate(${d.x}, ${d.hang + 30 * d.s + 6}) scale(${d.s})`}
              />
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
