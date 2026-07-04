import { useEffect, useRef } from 'react';
import { LiquidGlass } from 'quick-liquid/react';
import { LiquidGesture } from 'quick-liquid';
import { useCopy } from '../components/CodeBlock';
import { Droplet } from '../components/Droplet';

export function Hero() {
  const [copied, copy] = useCopy();
  const stageRef = useRef<HTMLDivElement>(null);

  /* The main card is a physical object: drag it, it springs home. */
  useEffect(() => {
    const host = stageRef.current?.querySelector<HTMLElement>('.hero-card');
    if (!host) return;
    const gesture = new LiquidGesture(host, {
      pressScale: 1.02,
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
            <span className="hero-badge__pulse" aria-hidden /> v0.1.0 · MIT · React 18+ &amp; vanilla JS
          </span>
          <h1 className="display">
            Liquid glass, <em className="ink">properly</em>
            <br />
            ray-traced for the web.
          </h1>
          <p className="hero-sub">
            quickliquid renders Apple’s liquid-glass material with vector Snell’s-law refraction,
            two-lobe rim light and chromatic dispersion. No shaders, no canvas, no WebGL.{' '}
            <strong>Just physics, at 60&nbsp;fps.</strong>
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
              Open the playground
            </a>
            <a className="btn btn--ghost" href="/docs/">
              Read the docs
            </a>
          </div>

          <ul className="hero-stats">
            <li>
              <b>0.3–5 ms</b>
              <span>to ray-trace a map for a new geometry</span>
            </li>
            <li>
              <b>1 map</b>
              <span>shared by every same-size element</span>
            </li>
            <li>
              <b>≈ 0.1 px</b>
              <span>quantization error — the 8-bit floor</span>
            </li>
          </ul>
        </div>

        <div className="hero-stage" ref={stageRef}>
          <div className="hero-scene" aria-hidden>
            <i className="hs-beam" />
            <i className="hs-grid" />
            <i className="hs-ball hb1" />
            <i className="hs-ball hb2" />
            <i className="hs-ball hb3" />
            <span className="hs-word">refraction</span>
          </div>

          <LiquidGlass
            className="hero-card"
            animateIn={200}
            config={{
              blur: 2,
              refractionStrength: 28,
              bezelWidth: 36,
              thickness: 26,
              chromaticAberration: 0.4,
              tintOpacity: 0.03,
              appearance: 'dark',
              edgeHighlight: 0.95,
              borderRadius: 28,
            }}
          >
            <div className="hero-card__body">
              <div className="hero-card__row">
                <span className="hero-card__icon" aria-hidden>
                  <Droplet size={34} poke={false} />
                </span>
                <div>
                  <b>Liquid Glass</b>
                  <small>drag me — the scene bends beneath</small>
                </div>
              </div>
              <div className="hero-card__meter" aria-hidden>
                <i style={{ width: '72%' }} />
              </div>
              <div className="hero-card__chips" aria-hidden>
                <span>snell</span>
                <span>fresnel</span>
                <span>60 fps</span>
              </div>
            </div>
          </LiquidGlass>

          <LiquidGlass
            className="hero-pill"
            animateIn={420}
            config={{
              material: 'regular',
              appearance: 'dark',
              borderRadius: 999,
            }}
          >
            <span className="hero-pill__label">
              material=<em>'regular'</em> — frosted
            </span>
          </LiquidGlass>

          <LiquidGlass
            className="hero-lens"
            animateIn={560}
            config={{
              material: 'clear',
              appearance: 'dark',
              borderRadius: 999,
              chromaticAberration: 0.5,
            }}
          >
            <span className="hero-lens__label">clear</span>
          </LiquidGlass>
        </div>
      </div>
    </header>
  );
}
