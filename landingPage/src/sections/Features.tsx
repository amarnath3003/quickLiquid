import { CardGlass } from '../components/CardGlass';
import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { LiquidGlass, LiquidToggle, useLiquidInteractive } from 'quick-liquid/react';
import { ControlIcon, GlassRange } from '../components/GlassControls';
import { LightField } from '../components/SiteShell';
import { FlowExperiment, ZoomExperiment } from './OpticExperiments';
import './component-gallery.css';

const CONTROL = {
  appearance: 'dark', borderRadius: 999, bezelWidth: 12, blur: 2, refractionStrength: 18,
  tintOpacity: 0.14, edgeHighlight: 0.86,
} as const;

function OpticsDesk() {
  const [playing, setPlaying] = useState(false);
  const [contrast, setContrast] = useState(false);
  const [intensity, setIntensity] = useState(78);
  const [reducedMotion, setReducedMotion] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const playInteractiveRef = useLiquidInteractive<HTMLButtonElement>({
    pressScale: 0.92,
    pressSquish: 0.04,
    hoverLift: 2,
    hoverScale: 1.05,
    ripple: true,
  });

  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    function change(event: MediaQueryListEvent) {
      setReducedMotion(event.matches);
      if (event.matches) setPlaying(false);
    }
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);

  return (
    <section className="optics-desk glass-pane" id="controls" aria-labelledby="optics-desk-title">
      <CardGlass />
      <div className="desk-preview" data-playing={playing} data-contrast={contrast}
        style={{ '--desk-intensity': intensity / 100 } as CSSProperties}>
        <LightField className="desk-preview__beam" />
        <LiquidGlass className="desk-reading" config={{
          appearance: 'dark', borderRadius: 36, blur: 6, bezelWidth: 24, refractionStrength: 29, tintOpacity: 0.15,
        }}>
          <div className="desk-reading__content">
            <span>Light intensity</span>
            <strong>{intensity}<small>%</small></strong>
          </div>
        </LiquidGlass>
      </div>

      <div className="desk-controls">
        <div className="desk-controls__head">
          <h3 id="optics-desk-title">Spectrum console</h3>
          <div className="desk-transport" role="group" aria-label="Spectrum playback">
            <LiquidGlass className="desk-icon" config={CONTROL}>
              <button
                ref={playInteractiveRef}
                type="button"
                aria-label={playing ? 'Pause light motion' : 'Play light motion'}
                aria-pressed={playing}
                disabled={reducedMotion}
                onClick={() => setPlaying(previous => !previous)}
              >
                <ControlIcon name={playing ? 'pause' : 'play'} />
              </button>
            </LiquidGlass>
          </div>
        </div>

        <GlassRange label="Intensity" value={intensity} max={100} valueText={`${intensity}%`} onChange={setIntensity} />

        <div className="desk-controls__row">
          <span>High contrast</span>
          <LiquidToggle
            checked={contrast}
            onChange={setContrast}
            label="High contrast"
          />
        </div>
      </div>
    </section>
  );
}

export function Features() {
  return (
    <section className="site-width home-section component-gallery" id="components" aria-labelledby="features-title">
      <div className="home-section__head">
        <h2 id="features-title">Try the components</h2>
      </div>
      <OpticsDesk />
      <div className="component-gallery__experiments">
        <FlowExperiment />
        <ZoomExperiment />
      </div>
    </section>
  );
}
