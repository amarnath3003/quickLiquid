import { Atmosphere } from './Atmosphere';
import { CardGlass } from './CardGlass';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { LiquidScrollTrack, LiquidTabBar } from 'quick-liquid';
import { LiquidGlass, LiquidGlassButton } from 'quick-liquid/react';
import { CommandMenu } from './CommandMenu';
import './glass-controls.css';

const GITHUB = 'https://github.com/amarnath3003/quickLiquid';
const HEADER_GLASS = {
  appearance: 'dark',
  borderRadius: 24,
  blur: 14,
  refractionStrength: 13,
  chromaticAberration: 0.07,
  bezelWidth: 16,
  specularStrength: 0.16,
  edgeHighlight: 0.55,
  tintOpacity: 0.19,
} as const;

type Page = 'home' | 'docs' | 'playground';

export function LightField({ className = '' }: { className?: string }) {
  return (
    <div className={`light-field ${className}`} aria-hidden="true">
      <div className="light-field__rays">
        <i /><i /><i /><i />
        <i /><i /><i /><i />
      </div>
    </div>
  );
}

export function Brand() {
  return (
    <a className="site-brand" href="/" aria-label="QuickLiquid home">
      <span className="site-mark" aria-hidden><i /></span>
      <span>quickLiquid</span>
    </a>
  );
}

function GitHubLink() {
  return (
    <LiquidGlassButton
      className="glass-button site-github"
      href={GITHUB}
      aria-label="QuickLiquid on GitHub"
    >
      <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true">
        <path d="M12 .8a11.2 11.2 0 0 0-3.54 21.83c.56.1.77-.24.77-.54v-2.1c-3.12.68-3.78-1.32-3.78-1.32-.51-1.3-1.25-1.64-1.25-1.64-1.02-.7.08-.68.08-.68 1.12.08 1.71 1.15 1.71 1.15.99 1.71 2.61 1.22 3.24.93.1-.72.39-1.15.71-1.5-2.49-.28-5.1-1.24-5.1-5.54 0-1.22.43-2.22 1.15-3-.12-.29-.5-1.43.1-2.98 0 0 .94-.3 3.08 1.15a10.7 10.7 0 0 1 5.6 0c2.14-1.45 3.08-1.15 3.08-1.15.6 1.55.22 2.69.1 2.98.72.78 1.15 1.78 1.15 3 0 4.31-2.62 5.25-5.12 5.53.4.35.76 1.03.76 2.08v3.09c0 .3.2.64.77.53A11.2 11.2 0 0 0 12 .8Z" />
      </svg>
      <span>GitHub</span>
    </LiquidGlassButton>
  );
}

function initialNavIndex(page: Page): number {
  if (page === 'playground') return 2;
  if (page === 'docs') return 3;
  if (typeof window !== 'undefined') {
    if (window.location.hash === '#components') return 1;
    if (window.location.hash === '#install') return 4;
  }
  return 0;
}

export function SiteShell({ page, skipTo, children }: { page: Page; skipTo: string; children: ReactNode }) {
  const navRef = useRef<HTMLElement>(null);
  const barRef = useRef<LiquidTabBar | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [navIndex, setNavIndex] = useState(() => initialNavIndex(page));

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const items = Array.from(nav.querySelectorAll<HTMLElement>('a'));
    if (!items.length) return;

    const bar = new LiquidTabBar(nav, items, {
      glass: true,
      hoverFollower: false,
    });
    bar.selectImmediate(initialNavIndex(page));
    barRef.current = bar;

    let alive = true;
    document.fonts?.ready.then(() => {
      if (alive) bar.selectImmediate(initialNavIndex(page));
    }).catch(() => {});

    return () => {
      alive = false;
      bar.destroy();
      barRef.current = null;
    };
  }, [page]);

  useEffect(() => {
    barRef.current?.select(navIndex);
  }, [navIndex]);

  useEffect(() => {
    if (!progressRef.current) return;
    const tracker = new LiquidScrollTrack(window, progressRef.current, { orientation: 'horizontal' });
    return () => tracker.destroy();
  }, []);

  return (
    <div className={`site-frame site-frame--${page}`}>
      <Atmosphere />
      <a className="site-skip" href={skipTo}>Skip to content</a>

      <header className="site-header">
        <LiquidGlass className="site-width site-header__glass" config={HEADER_GLASS}>
          <div className="site-header__inner">
            <Brand />
            <nav className="site-nav" ref={navRef} aria-label="Main navigation">
              <a
                href={page === 'home' ? '#liquid' : '/#liquid'}
                aria-current={page === 'home' && navIndex === 0 ? 'location' : undefined}
                onClick={() => { if (page === 'home') setNavIndex(0); }}
              >
                Material
              </a>
              <a
                href={page === 'home' ? '#components' : '/#components'}
                aria-current={page === 'home' && navIndex === 1 ? 'location' : undefined}
                onClick={() => { if (page === 'home') setNavIndex(1); }}
              >
                Components
              </a>
              <a href="/playground/" aria-current={page === 'playground' ? 'page' : undefined}>
                Playground
              </a>
              <a href="/docs/" aria-current={page === 'docs' ? 'page' : undefined}>
                Docs
              </a>
              <a
                href={page === 'home' ? '#install' : '/#install'}
                aria-current={page === 'home' && navIndex === 4 ? 'location' : undefined}
                onClick={() => { if (page === 'home') setNavIndex(4); }}
              >
                Install
              </a>
            </nav>
            <div className="site-header__actions">
              <CommandMenu />
              <GitHubLink />
            </div>
          </div>
          <div ref={progressRef} className="site-header__progress" aria-hidden="true" />
        </LiquidGlass>
      </header>

      {children}

      <footer className="site-width site-footer glass-pane">
        <CardGlass />
        <div>
          <Brand />
          <p>Ultra-optimized liquid glass for the web.</p>
        </div>
        <nav aria-label="Footer navigation">
          <a href="/playground/">Playground</a>
          <a href="/docs/">Docs</a>
          <a href="https://www.npmjs.com/package/quick-liquid">npm</a>
          <a href={GITHUB}>GitHub</a>
        </nav>
        <span className="site-footer__license">MIT License</span>
      </footer>
    </div>
  );
}
