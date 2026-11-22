import { CardGlass } from '../components/CardGlass';
import { CopyButton } from '../components/CodeBlock';
import { LiquidGlassButton, useLiquidInteractive } from 'quick-liquid/react';
import { SpectrumLab } from './SpectrumLab';

const INSTALL_COMMAND = 'npm install quick-liquid';

export function Hero() {
  const commandRef = useLiquidInteractive<HTMLDivElement>({
    hoverLift: 1.5,
    hoverScale: 1.008,
    pressScale: 0.99,
    pressSquish: 0.01,
    ripple: false,
  });

  return (
    <section className="site-width home-opening" aria-labelledby="hero-title">
      <div className="home-pitch">
        <h1 id="hero-title">Ultra-fast<br />liquid glass</h1>
        <p className="home-pitch__description">
          Real refraction, chromatic rims, and spring motion—precomputed once and cached across surfaces for extreme performance.
        </p>
        <div className="home-pitch__actions">
          <LiquidGlassButton className="glass-button glass-button--bright" href="/playground/">
            Open Playground
          </LiquidGlassButton>
          <LiquidGlassButton className="glass-button" href="/docs/">
            Read the docs
          </LiquidGlassButton>
        </div>
        <div ref={commandRef} className="home-command home-pitch__command glass-pane">
          <CardGlass />
          <span aria-hidden>$</span>
          <code>{INSTALL_COMMAND}</code>
          <CopyButton text={INSTALL_COMMAND} className="glass-button" label="Copy npm install command" />
        </div>
        <p className="home-pitch__compatibility">React <span aria-hidden>·</span> Vanilla JS <span aria-hidden>·</span> MIT</p>
      </div>
      <SpectrumLab />
    </section>
  );
}
