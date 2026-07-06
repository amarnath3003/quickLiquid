import { LiquidGlass } from 'quick-liquid/react';
import { Droplet } from '../components/Droplet';

export function Nav({ base = '' }: { base?: string }) {
  const links = [
    { href: `${base}#features`, label: 'Optics' },
    { href: `${base}#liquid`, label: 'Motion' },
    { href: `${base}#install`, label: 'Install' },
    { href: `${base}#playground`, label: 'Playground' },
    { href: '/docs/', label: 'Docs' },
  ];

  return (
    <div className="nav-shell">
      <LiquidGlass
        className="nav-glass"
        config={{
          material: 'thin',
          appearance: 'dark',
          borderRadius: 999,
          blur: 10,
          tintOpacity: 0.08,
          refractionStrength: 14,
          bezelWidth: 20,
          elevation: 0.6,
          specularStrength: 0.16,
          edgeHighlight: 0.5,
          fresnelPower: 3.2,
        }}
      >
        <nav className="nav-inner" aria-label="Main">
          <a className="nav-brand" href={base || '#top'}>
            <Droplet size={26} poke={false} className="nav-brand__drop" />
            <span className="wordmark">
              quick<em>liquid</em>
            </span>
          </a>
          <div className="nav-links">
            {links.map(l => (
              <a key={l.label} href={l.href}>
                {l.label}
              </a>
            ))}
          </div>
          <div className="nav-cta">
            <a
              className="nav-gh"
              href="https://github.com/amarnath3003/quickLiquid"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
          </div>
        </nav>
      </LiquidGlass>
    </div>
  );
}
