import { useRef, useState } from 'react';
import { LiquidGlass } from 'quick-liquid/react';
import type { LiquidGlassRef } from 'quick-liquid/react';
import type { LiquidGlassConfig } from 'quick-liquid';
import { useLiquidTabBar } from '../components/useLiquidTabBar';
import { Droplet } from '../components/Droplet';

const TAB_LABELS = ['home', 'search', 'library'];

const GLASS: Partial<LiquidGlassConfig> = {
  appearance: 'dark',
  blur: 4,
  refractionStrength: 18,
  bezelWidth: 22,
  thickness: 18,
  tintOpacity: 0.06,
};

export function Liquid() {
  const [tab, setTab] = useState(0);
  const { containerRef, select } = useLiquidTabBar(0);
  const jiggleRef = useRef<LiquidGlassRef>(null);

  const pick = (i: number) => {
    setTab(i);
    select(i);
  };

  return (
    <section className="section" id="liquid">
      <div className="section-head">
        <span className="section-kicker">the liquid part</span>
        <h2 className="display">
          It <em className="ink">moves</em> like water, too.
        </h2>
        <p>
          The same package ships the motion toolkit — springs, gestures and morphing selection —
          so the glass doesn’t just look right, it responds right.
        </p>
      </div>

      <div className="liquid-grid">
        <div className="liquid-cell">
          <div className="liquid-cell__stage lc-a" aria-label="LiquidTabBar demo">
            <i className="lc-orb" aria-hidden />
            <i className="lc-bar" aria-hidden />
            <LiquidGlass className="lt-bar" config={{ ...GLASS, borderRadius: 999 }}>
              <div className="lt-bar__inner" ref={containerRef}>
                {TAB_LABELS.map((label, i) => (
                  <button
                    key={label}
                    type="button"
                    className={`lt-item${tab === i ? ' is-active' : ''}`}
                    onClick={() => pick(i)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </LiquidGlass>
          </div>
          <div className="liquid-cell__info">
            <code>LiquidTabBar</code>
            <p>The selection stretches across the gap, then snaps to the new tab — a spring on
            position, a spring on width.</p>
          </div>
        </div>

        <div className="liquid-cell">
          <div className="liquid-cell__stage lc-b" aria-label="liquidPress demo">
            <i className="lc-orb" aria-hidden />
            <i className="lc-bar" aria-hidden />
            <div className="lt-buttons">
              <LiquidGlass
                className="lt-btn"
                config={{ ...GLASS, borderRadius: 999 }}
                liquidPress
                animateIn={0}
              >
                bouncy
              </LiquidGlass>
              <LiquidGlass
                className="lt-btn"
                config={{ ...GLASS, borderRadius: 14 }}
                liquidPress={{ scale: 0.86, squish: 0.05 }}
                animateIn={110}
              >
                squishy
              </LiquidGlass>
            </div>
          </div>
          <div className="liquid-cell__info">
            <code>liquidPress</code>
            <p>Hold one down — squash, stretch and a spring release. No keyframes written.</p>
          </div>
        </div>

        <div className="liquid-cell">
          <div className="liquid-cell__stage lc-c" aria-label="jiggle demo">
            <i className="lc-orb" aria-hidden />
            <i className="lc-bar" aria-hidden />
            <LiquidGlass ref={jiggleRef} className="lt-mascot" config={{ ...GLASS, borderRadius: 24 }}>
              <button
                type="button"
                className="lt-mascot__hit"
                onClick={() => jiggleRef.current?.jiggle(1.5)}
                aria-label="Jiggle the panel"
              >
                <Droplet size={64} poke={false} />
                <span>poke it</span>
              </button>
            </LiquidGlass>
          </div>
          <div className="liquid-cell__info">
            <code>jiggle()</code>
            <p>The whole panel wobbles with the engine’s squash-and-stretch curve. One call.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
