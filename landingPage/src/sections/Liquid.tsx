import { useRef, useState } from 'react';
import { LiquidGlass } from 'quick-liquid/react';
import type { LiquidGlassRef } from 'quick-liquid/react';
import type { LiquidGlassConfig } from 'quick-liquid';
import { useLiquidTabBar } from '../components/useLiquidTabBar';
import { Droplet } from '../components/Droplet';

const TAB_LABELS = ['home', 'search', 'library', 'profile'];

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
    <section className="section section--wide" id="liquid">
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

      <div className="liquid-stage">
        <div className="liquid-scenery" aria-hidden>
          <i className="ls-orb o1" />
          <i className="ls-orb o2" />
          <i className="ls-bar b1" />
        </div>

        <div className="liquid-demos">
          <div className="liquid-demo">
            <span className="liquid-demo__tag">LiquidTabBar</span>
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
            <p className="liquid-demo__caption">
              The selection stretches across the gap, then snaps to the new tab — a spring on
              position, a spring on width.
            </p>
          </div>

          <div className="liquid-demo">
            <span className="liquid-demo__tag">liquidPress</span>
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
                config={{ ...GLASS, borderRadius: 16 }}
                liquidPress={{ scale: 0.86, squish: 0.05 }}
                animateIn={110}
              >
                squishy
              </LiquidGlass>
              <LiquidGlass
                className="lt-btn"
                config={{ ...GLASS, borderRadius: 999, chromaticAberration: 0.9, refractionStrength: 28 }}
                liquidPress={{ scale: 0.95, squish: 0.015 }}
                animateIn={220}
              >
                prismatic
              </LiquidGlass>
            </div>
            <p className="liquid-demo__caption">
              Hold one down — squash, stretch and a spring release. No keyframes written.
            </p>
          </div>

          <div className="liquid-demo">
            <span className="liquid-demo__tag">jiggle()</span>
            <LiquidGlass ref={jiggleRef} className="lt-mascot" config={{ ...GLASS, borderRadius: 28 }}>
              <button
                type="button"
                className="lt-mascot__hit"
                onClick={() => jiggleRef.current?.jiggle(1.5)}
                aria-label="Jiggle the panel"
              >
                <Droplet size={88} poke={false} />
                <span>poke it</span>
              </button>
            </LiquidGlass>
            <p className="liquid-demo__caption">
              The whole panel wobbles with the engine’s squash-and-stretch curve. One call.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
