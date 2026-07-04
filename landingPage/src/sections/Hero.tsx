import { useEffect, useRef } from 'react';
import { LiquidGlass } from 'quick-liquid/react';
import { LiquidGesture } from 'quick-liquid';
import { useCopy } from '../components/CodeBlock';

export function Hero() {
  const [copied, copy] = useCopy();
  const lensRef = useRef<HTMLDivElement>(null);

  // Make the hero card a physical object: drag it, it springs home.
  useEffect(() => {
    const host = lensRef.current?.querySelector<HTMLElement>('.hero-card');
    if (!host) return;
    const gesture = new LiquidGesture(host, {
      pressScale: 1.03,
      pressSquish: 0,
      wobbleOnPress: false,
      releaseSpring: 'bouncy',
    });
    return () => gesture.destroy();
  }, []);

  return (
    <header className="hero" id="top">
      <div className="hero-aurora" aria-hidden>
        <i className="aurora-blob a1" />
        <i className="aurora-blob a2" />
        <i className="aurora-blob a3" />
      </div>
      <div className="hero-grid" aria-hidden />

      <div className="hero-inner">
        <div className="hero-copy">
          <span className="hero-badge">
            <span className="hero-badge__pulse" aria-hidden /> v0.1.0 · MIT · React 18+ &amp; Vanilla JS
          </span>
          <h1>
            Liquid glass for the web.
            <br />
            <span className="grad-text">Physics included.</span>
          </h1>
          <p className="hero-sub">
            QuickLiquid replicates Apple’s liquid-glass material with <strong>vector Snell’s-law
            refraction</strong>, two-lobe rim lighting and chromatic dispersion — ray-traced into a
            displacement map in under 5&nbsp;ms and rendered at 60+&nbsp;FPS.
          </p>

          <div className="hero-actions">
            <button className="install-pill" onClick={() => copy('npm install quick-liquid')} type="button">
              <span className="install-pill__prompt" aria-hidden>
                $
              </span>
              npm install quick-liquid
              <span className="install-pill__copy">{copied ? '✓' : '⧉'}</span>
            </button>
            <a className="btn btn--primary" href="#playground">
              Try the playground
            </a>
            <a className="btn btn--ghost" href="#docs">
              Read the docs
            </a>
          </div>

          <ul className="hero-stats">
            <li>
              <b>0.3–5 ms</b>
              <span>map generation per unique geometry</span>
            </li>
            <li>
              <b>1 map</b>
              <span>shared by every same-size element</span>
            </li>
            <li>
              <b>≈ 0.1 px</b>
              <span>quantization error — the 8-bit minimum</span>
            </li>
          </ul>
        </div>

        <div className="hero-stage" ref={lensRef}>
          <div className="hero-scene" aria-hidden>
            <i className="scene-bar sb1" />
            <i className="scene-bar sb2" />
            <i className="scene-bar sb3" />
            <i className="scene-bar sb4" />
            <i className="scene-dot sd1" />
            <i className="scene-dot sd2" />
            <span className="scene-word">refraction</span>
          </div>

          <LiquidGlass
            className="hero-card"
            animateIn={250}
            config={{
              blur: 2,
              saturation: 1.55,
              refractionStrength: 30,
              bezelWidth: 38,
              thickness: 26,
              chromaticAberration: 0.45,
              borderRadius: 30,
              appearance: 'dark',
              edgeHighlight: 0.95,
            }}
          >
            <div className="hero-card__body">
              <div className="hero-card__row">
                <span className="hero-card__icon" aria-hidden>
                  💧
                </span>
                <div>
                  <b>Liquid Glass</b>
                  <small>drag me — real refraction underneath</small>
                </div>
              </div>
              <div className="hero-card__meter" aria-hidden>
                <i style={{ width: '78%' }} />
              </div>
              <div className="hero-card__chips" aria-hidden>
                <span>Snell</span>
                <span>Fresnel</span>
                <span>60 FPS</span>
              </div>
            </div>
          </LiquidGlass>
        </div>
      </div>

      <p className="hero-note">
        Full refraction renders in Chromium (<code>backdrop-filter: url()</code>); Safari &amp; Firefox
        gracefully fall back to frost + lighting.
      </p>
    </header>
  );
}
