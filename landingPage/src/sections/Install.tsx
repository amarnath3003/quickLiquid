import { CardGlass } from '../components/CardGlass';
import { useState } from 'react';
import { LiquidGlassButton, LiquidSegmented, LiquidSwitcher } from 'quick-liquid/react';
import { CodeBlock, CopyButton } from '../components/CodeBlock';

const COMMANDS = {
  npm: 'npm install quick-liquid',
  pnpm: 'pnpm add quick-liquid',
  yarn: 'yarn add quick-liquid',
  bun: 'bun add quick-liquid',
} as const;

type Manager = keyof typeof COMMANDS;
const MANAGER_KEYS = Object.keys(COMMANDS) as Manager[];
const MANAGER_OPTIONS = MANAGER_KEYS.map(value => ({ value, label: value }));

const EXAMPLES = {
  React: {
    file: 'GlassCard.tsx',
    lang: 'tsx',
    code: `import { LiquidGlass } from 'quick-liquid/react';

export function GlassCard() {
  return (
    <LiquidGlass
      config={{
        material: 'clear',
        refractionStrength: 32,
        chromaticAberration: 0.24,
      }}
      liquidPress
    >
      <div className="card">Hello, glass.</div>
    </LiquidGlass>
  );
}`,
  },
  'Vanilla JS': {
    file: 'main.js',
    lang: 'ts',
    code: `import { LiquidGlassEngine } from 'quick-liquid';

const card = document.querySelector('.card');

if (card) {
  const glass = new LiquidGlassEngine(card, {
    material: 'clear',
    refractionStrength: 32,
    chromaticAberration: 0.24,
  });

  glass.enableLiquidPress();
}`,
  },
} as const;

type ExampleKey = keyof typeof EXAMPLES;
const EXAMPLE_KEYS = Object.keys(EXAMPLES) as ExampleKey[];
const EXAMPLE_OPTIONS = EXAMPLE_KEYS.map(value => ({ value, label: value }));

export function Install() {
  const [example, setExample] = useState<ExampleKey>('React');
  const [exampleDir, setExampleDir] = useState<-1 | 1>(1);
  const [manager, setManager] = useState<Manager>('npm');
  const [managerDir, setManagerDir] = useState<-1 | 1>(1);
  const { file, lang, code } = EXAMPLES[example];

  function selectManager(next: Manager) {
    setManagerDir(MANAGER_KEYS.indexOf(next) >= MANAGER_KEYS.indexOf(manager) ? 1 : -1);
    setManager(next);
  }

  function selectExample(next: ExampleKey) {
    setExampleDir(EXAMPLE_KEYS.indexOf(next) >= EXAMPLE_KEYS.indexOf(example) ? 1 : -1);
    setExample(next);
  }

  return (
    <section id="install" className="site-width home-section home-install" aria-labelledby="install-title">
      <div className="home-install__intro">
        <h2 id="install-title">Install QuickLiquid</h2>
        <p>
          Precomputed optical maps and spring physics for React or vanilla JavaScript—install once and wrap any surface.
        </p>
        <LiquidSegmented
          options={MANAGER_OPTIONS}
          value={manager}
          onChange={selectManager}
          glass
          ariaLabel="Package manager"
          className="home-install__managers"
        />
        <div className="home-command glass-pane">
          <CardGlass />
          <span aria-hidden>$</span>
          <LiquidSwitcher activeKey={manager} direction={managerDir} className="home-command__code">
            <code>{COMMANDS[manager]}</code>
          </LiquidSwitcher>
          <CopyButton key={manager} text={COMMANDS[manager]} className="glass-button" label="Copy install command" />
        </div>
        <LiquidGlassButton className="glass-button home-install__docs" href="/docs/">
          Explore the API
        </LiquidGlassButton>
      </div>
      <div className="home-example glass-pane">
        <CardGlass />
        <LiquidSegmented
          options={EXAMPLE_OPTIONS}
          value={example}
          onChange={selectExample}
          glass
          ariaLabel="Code example language"
          className="home-example__tabs"
        />
        <LiquidSwitcher activeKey={example} direction={exampleDir}>
          <CodeBlock key={example} code={code} title={file} lang={lang} />
        </LiquidSwitcher>
      </div>
    </section>
  );
}
