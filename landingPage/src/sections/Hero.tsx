import { useEffect, useRef } from 'react';
import { LiquidGlass } from 'quick-liquid/react';
import { LiquidGroup, LiquidGesture } from 'quick-liquid';
import { useCopy } from '../components/CodeBlock';
import { Droplet } from '../components/Droplet';

export function Hero() {
  const [copied, copy] = useCopy();
  const stageRef = useRef<HTMLDivElement>(null);

  /* The hero moment: three real glass droplets in a LiquidGroup.
     Drag one into another — they merge like water, then spring home. */
  useEffect(() => {
    const container = stageRef.current;
    if (!container) return;
    const blobs = container.querySelectorAll<HTMLElement>('.merge-blob');
    if (blobs.length < 2) return;

    const group = new LiquidGroup(container, {
      mergeDistance: 58,
      blendRadius: 30,
      bridgeOpacity: 0.22,
      resolution: 3,
    });
    blobs.forEach(blob => group.add(blob));

    const gestures = [...blobs].map(blob => {
      const gesture = new LiquidGesture(blob, {
        pressScale: 1.05,
        pressSquish: 0,
        wobbleOnPress: false,
        releaseSpring: 'bouncy',
      });
      gesture.onDrag(() => group.updatePositions());
      // keep the bridges tracking while the release spring settles
      gesture.onRelease(() => {
        const t0 = performance.now();
        const tick = () => {
          group.updatePositions();
          if (performance.now() - t0 < 1800) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      return gesture;
    });

    return () => {
      gestures.forEach(g => g.destroy());
      group.destroy();
    };
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
            Glass that behaves
            <br />
            <em className="ink">like water.</em>
          </h1>
          <p className="hero-sub">
            quickliquid ray-traces Apple’s liquid-glass material straight into the browser — vector
            Snell’s-law refraction, two-lobe rim light, chromatic dispersion. No shaders, no canvas,
            no WebGL. <strong>Just physics, at 60&nbsp;fps.</strong>
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
            <a className="btn btn--ghost" href="#docs">
              Skim the docs
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
            <i className="scene-bar sb1" />
            <i className="scene-bar sb2" />
            <i className="scene-bar sb3" />
            <i className="scene-dot sd1" />
            <i className="scene-dot sd2" />
            <span className="scene-word">merge</span>
          </div>

          {(['b1', 'b2', 'b3'] as const).map((k, i) => (
            <LiquidGlass
              key={k}
              className={`merge-blob mb-${k}`}
              animateIn={200 + i * 140}
              config={{
                borderRadius: 999,
                blur: 1.5,
                refractionStrength: 20,
                bezelWidth: 18,
                thickness: 16,
                chromaticAberration: 0.4,
                appearance: 'light',
                tintOpacity: 0.03,
                edgeHighlight: 0.95,
              }}
            >
              <span className="merge-blob__face" aria-hidden>
                <Droplet size={30} poke={false} />
              </span>
            </LiquidGlass>
          ))}

          <div className="hero-stage__hint">
            <code>LiquidGroup</code> — drag a droplet into another. Surface tension included.
          </div>
        </div>
      </div>
    </header>
  );
}
