import { useEffect, useRef, useState } from 'react';
import { LiquidGlass } from 'quick-liquid/react';
import type { LiquidGlassRef } from 'quick-liquid/react';
import { LiquidTabBar } from 'quick-liquid';
import type { LiquidGlassConfig } from 'quick-liquid';
import { Droplet } from '../components/Droplet';

const TAB_LABELS = ['pour', 'stir', 'shake', 'sip'];

const GLASS: Partial<LiquidGlassConfig> = {
  appearance: 'dark',
  blur: 4,
  refractionStrength: 20,
  bezelWidth: 24,
  thickness: 20,
  tintOpacity: 0.06,
};

export function Liquid() {
  const [tab, setTab] = useState(0);
  const tabBarRef = useRef<HTMLDivElement>(null);
  const tabCtrl = useRef<LiquidTabBar | null>(null);
  const jiggleRef = useRef<LiquidGlassRef>(null);

  useEffect(() => {
    if (!tabBarRef.current) return;
    const items = tabBarRef.current.querySelectorAll<HTMLElement>('.lt-item');
    if (items.length === 0) return;
    const bar = new LiquidTabBar(tabBarRef.current, [...items], { spring: 'default' });
    tabCtrl.current = bar;
    return () => {
      bar.destroy();
      tabCtrl.current = null;
    };
  }, []);

  const pick = (i: number) => {
    setTab(i);
    tabCtrl.current?.select(i);
  };

  return (
    <section className="section section--liquid" id="liquid">
      <div className="section-head">
        <span className="section-kicker">the liquid part</span>
        <h2 className="display">
          It <em className="ink">moves</em> like water, too.
        </h2>
        <p>
          The glass is half the story. The same package ships the motion toolkit — springs,
          gestures, metaball groups — so your UI doesn’t just look wet, it behaves wet.
        </p>
      </div>

      <div className="liquid-stage">
        <div className="liquid-scenery" aria-hidden>
          <i className="pg-orb o1" />
          <i className="pg-orb o2" />
          <i className="pg-bar b1" />
          <i className="pg-bar b2" />
          <span className="pg-word">splash</span>
        </div>

        <div className="liquid-demos">
          <div className="liquid-demo">
            <LiquidGlass className="lt-bar" config={{ ...GLASS, borderRadius: 999 }}>
              <div className="lt-bar__inner" ref={tabBarRef}>
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
              <code>LiquidTabBar</code> — the selection stretches across the gap, then snaps to the
              new tab. Like a droplet letting go.
            </p>
          </div>

          <div className="liquid-demo">
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
                config={{ ...GLASS, borderRadius: 999, chromaticAberration: 0.9, refractionStrength: 30 }}
                liquidPress={{ scale: 0.95, squish: 0.015 }}
                animateIn={220}
              >
                prismatic
              </LiquidGlass>
            </div>
            <p className="liquid-demo__caption">
              <code>liquidPress</code> — hold one down. Squash, stretch and a spring release, no
              keyframes written.
            </p>
          </div>

          <div className="liquid-demo liquid-demo--mascot">
            <LiquidGlass
              ref={jiggleRef}
              className="lt-mascot"
              config={{ ...GLASS, borderRadius: 36 }}
            >
              <button
                type="button"
                className="lt-mascot__hit"
                onClick={() => jiggleRef.current?.jiggle(1.5)}
                aria-label="Jiggle the droplet"
              >
                <Droplet size={104} poke={false} />
                <span>poke it.</span>
              </button>
            </LiquidGlass>
            <p className="liquid-demo__caption">
              <code>jiggle()</code> — the whole panel wobbles with the engine’s own
              squash-and-stretch curve. One call.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
