import { useState } from 'react';
import { CodeBlock } from '../components/CodeBlock';

const MANAGERS = [
  { name: 'npm', cmd: 'npm install quick-liquid' },
  { name: 'pnpm', cmd: 'pnpm add quick-liquid' },
  { name: 'yarn', cmd: 'yarn add quick-liquid' },
  { name: 'bun', cmd: 'bun add quick-liquid' },
] as const;

const REACT_SNIPPET = `import { LiquidGlass } from 'quick-liquid/react';

function Header() {
  return (
    <LiquidGlass
      config={{
        blur: 16,
        refractionStrength: 24,
        chromaticAberration: 0.1,
        dynamicLighting: true,
      }}
      liquidPress   // scale + bounce on click
      animateIn={200} // spring in after 200ms
    >
      <nav>
        <span>Brand</span>
        <button>Dashboard</button>
      </nav>
    </LiquidGlass>
  );
}`;

const VANILLA_SNIPPET = `import { LiquidGlassEngine } from 'quick-liquid';

const el = document.querySelector('.glass-card');
const engine = new LiquidGlassEngine(el, {
  blur: 20,
  saturation: 1.5,
  refractionStrength: 30,
  dynamicLighting: true,
});

// Automatic liquid press physics
engine.enableLiquidPress({ scale: 0.92, squish: 0.03 });`;

export function Install() {
  const [mgr, setMgr] = useState(0);
  const [tab, setTab] = useState<'react' | 'vanilla'>('react');

  return (
    <section className="section" id="install">
      <div className="section-head">
        <span className="section-kicker">Get started</span>
        <h2>Install once, glass everything.</h2>
        <p>
          Zero runtime dependencies. React 18+ is an optional peer dependency — the core engine is
          plain TypeScript and works on any element.
        </p>
      </div>

      <div className="install-cols">
        <div className="install-col">
          <div className="tab-row" role="tablist" aria-label="Package manager">
            {MANAGERS.map((m, i) => (
              <button
                key={m.name}
                role="tab"
                aria-selected={mgr === i}
                className={`tab-chip${mgr === i ? ' is-active' : ''}`}
                onClick={() => setMgr(i)}
                type="button"
              >
                {m.name}
              </button>
            ))}
          </div>
          <CodeBlock code={MANAGERS[mgr].cmd} lang="bash" title="terminal" compact />

          <ol className="install-steps">
            <li>
              <b>Install</b> the package — <code>dist</code> ships ESM + CJS + types.
            </li>
            <li>
              <b>Wrap</b> any element in <code>&lt;LiquidGlass&gt;</code> (or attach{' '}
              <code>LiquidGlassEngine</code>).
            </li>
            <li>
              <b>Tune</b> the physics in the <a href="#playground">playground</a> and paste the
              config back into your app.
            </li>
          </ol>
        </div>

        <div className="install-col">
          <div className="tab-row" role="tablist" aria-label="Framework">
            <button
              role="tab"
              aria-selected={tab === 'react'}
              className={`tab-chip${tab === 'react' ? ' is-active' : ''}`}
              onClick={() => setTab('react')}
              type="button"
            >
              ⚛️ React
            </button>
            <button
              role="tab"
              aria-selected={tab === 'vanilla'}
              className={`tab-chip${tab === 'vanilla' ? ' is-active' : ''}`}
              onClick={() => setTab('vanilla')}
              type="button"
            >
              ⚡ Vanilla JS
            </button>
          </div>
          {tab === 'react' ? (
            <CodeBlock code={REACT_SNIPPET} lang="tsx" title="Header.tsx" />
          ) : (
            <CodeBlock code={VANILLA_SNIPPET} lang="ts" title="main.ts" />
          )}
        </div>
      </div>
    </section>
  );
}
