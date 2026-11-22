import { CardGlass } from './components/CardGlass';
import { useEffect, useState } from 'react';
import { LiquidGlassButton, LiquidSegmented, LiquidSwitcher } from 'quick-liquid/react';
import { SiteShell } from './components/SiteShell';
import { Docs, type DocTopic } from './sections/Docs';
import { PROPERTIES_AZ } from './data/properties';

const TOPICS: { id: DocTopic; label: string; badge: string }[] = [
  { id: 'configuration', label: 'Configuration', badge: String(PROPERTIES_AZ.length) },
  { id: 'materials', label: 'Material presets', badge: '6' },
  { id: 'react', label: 'React & Ref API', badge: 'Live' },
  { id: 'metaballs', label: 'Droplet merging', badge: 'Live' },
  { id: 'toolkit', label: 'Animation toolkit', badge: '14' },
  { id: 'browser', label: 'Browser notes', badge: 'Check' },
];

const TOPIC_OPTIONS = TOPICS.map(item => ({
  value: item.id,
  label: (
    <>
      <span>{item.label}</span>
      <span className="docs-nav__badge">{item.badge}</span>
    </>
  ),
}));

const TOPIC_ORDER = TOPICS.map(t => t.id);

function topicFromHash(hash: string): DocTopic {
  const clean = hash.replace(/^#/, '').toLowerCase();
  if (clean === 'materials') return 'materials';
  if (clean === 'react' || clean === 'react-props' || clean === 'ref-api') return 'react';
  if (clean === 'metaballs') return 'metaballs';
  if (clean === 'toolkit' || clean === 'animation-toolkit') return 'toolkit';
  if (clean === 'browser' || clean === 'browser-notes') return 'browser';
  return 'configuration';
}

export default function DocsApp() {
  const [topic, setTopic] = useState<DocTopic>(() => topicFromHash(window.location.hash));
  const [direction, setDirection] = useState<-1 | 1>(1);

  useEffect(() => {
    const onHash = () => setTopic(topicFromHash(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  function selectTopic(next: DocTopic) {
    setDirection(TOPIC_ORDER.indexOf(next) >= TOPIC_ORDER.indexOf(topic) ? 1 : -1);
    setTopic(next);
    window.history.replaceState(null, '', `#${next}`);
  }

  return (
    <SiteShell page="docs" skipTo="#docs">
      <main className="site-width docs-page" id="docs">
        <header className="docs-header">
          <div>
            <h1>QuickLiquid API</h1>
            <p>Precomputed optics, material presets, and spring physics—explore and test every API live.</p>
          </div>
          <div className="docs-header__actions">
            <LiquidGlassButton className="glass-button glass-button--bright" href="/playground/">
              Playground
            </LiquidGlassButton>
            <LiquidGlassButton className="glass-button" href="/#install">
              Install
            </LiquidGlassButton>
          </div>
        </header>

        <div className="docs-layout">
          <nav className="docs-nav glass-pane" aria-label="API reference sections">
            <CardGlass />
            <LiquidSegmented
              options={TOPIC_OPTIONS}
              value={topic}
              onChange={selectTopic}
              orientation="vertical"
              glass
              role="tablist"
              ariaLabel="API reference sections"
              className="docs-nav__list"
            />
          </nav>

          <div
            className="docs-workspace"
            role="tabpanel"
            id={`docs-panel-${topic}`}
            aria-label={TOPICS.find(t => t.id === topic)?.label}
          >
            <LiquidSwitcher activeKey={topic} direction={direction}>
              <Docs activeTopic={topic} />
            </LiquidSwitcher>
          </div>
        </div>
      </main>
    </SiteShell>
  );
}
