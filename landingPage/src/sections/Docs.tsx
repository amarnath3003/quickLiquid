import { useMemo, useState } from 'react';
import { MATERIAL_PRESETS } from 'quick-liquid';
import { PROPERTIES_AZ } from '../data/properties';
import { CodeBlock } from '../components/CodeBlock';

const REACT_PROPS = [
  ['config', 'Partial<LiquidGlassConfig>', 'Engine configuration — every option in the table above.'],
  ["as", 'keyof JSX.IntrinsicElements', "Host element tag. Defaults to 'div'."],
  ['active', 'boolean', 'Mount/unmount the engine while keeping the DOM. Defaults to true.'],
  ['liquidPress', 'boolean | { scale?, squish? }', 'Scale + bounce press physics on pointer down.'],
  ['animateIn', 'boolean | number', 'Spring scale-in on first mount; a number is the delay in ms.'],
  ['jiggle', 'boolean | number', 'Jiggle on mount; a number sets the intensity.'],
  ['onPerformanceUpdate', '(metrics) => void', 'Called every second with frame times, map-gen ms and quality tier.'],
] as const;

const REF_API = [
  ['engine', 'LiquidGlassEngine | null', 'Direct handle to the underlying engine instance.'],
  ['getMetrics()', 'PerformanceMetrics | null', 'Frame times, map generation cost, active quality tier.'],
  ['jiggle(intensity?)', 'void', 'Playful squash-and-stretch wobble.'],
  ['animateIn(delay?)', 'void', 'Replay the spring entrance.'],
  ['animateOut()', 'Promise<void>', 'Spring exit; resolves when done.'],
] as const;

const TOOLKIT = [
  ['Spring / SpringVector', 'Critically-tunable spring primitives with velocity carry-over.'],
  ['SPRING_PRESETS', "Curated feels: 'default', 'bouncy', 'stiff', 'gentle', …"],
  ['LiquidGesture', 'Pointer physics: drag with rubber-banding, press squish, spring release.'],
  ['LiquidButton / LiquidDrag', 'Prewired gesture bindings for buttons and free-drag elements.'],
  ['LiquidGroup', 'Metaball group — nearby glass blobs merge like water droplets.'],
  ['LiquidTabBar', 'iOS-style tab bar where the selection blob flows between tabs.'],
  ['LiquidMorph / LiquidMetaball', 'Shape morphing and blob-field rendering primitives.'],
  ['LiquidTransition / LiquidLayoutAnimation', 'Springy property and FLIP-style layout transitions.'],
] as const;

const METABALL_SNIPPET = `import { LiquidGroup, LiquidGesture } from 'quick-liquid';

const group = new LiquidGroup(container, {
  mergeDistance: 60, // px before blobs bridge
  blendRadius: 32,   // fillet size of the bridge
});

document.querySelectorAll('.blob').forEach(blob => {
  group.add(blob);
  new LiquidGesture(blob).onDrag(() => group.updatePositions());
});`;

export function Docs() {
  const [filter, setFilter] = useState('');
  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return PROPERTIES_AZ;
    return PROPERTIES_AZ.filter(
      p =>
        (p.key as string).toLowerCase().includes(q) ||
        p.label.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q),
    );
  }, [filter]);

  const materials = Object.entries(MATERIAL_PRESETS);

  return (
    <section className="section" id="docs">
      <div className="section-head">
        <span className="section-kicker">documentation</span>
        <h2 className="display">
          The whole reference, <em className="ink">one long pour.</em>
        </h2>
        <p>
          Everything ships typed. <code>LiquidGlassConfig</code> below is the single object you pass
          to the React component or the vanilla engine.
        </p>
      </div>

      <div className="docs-block">
        <div className="docs-block__head">
          <h3>Configuration API — A to Z</h3>
          <input
            className="docs-filter"
            type="search"
            placeholder={`Filter ${PROPERTIES_AZ.length} options…`}
            value={filter}
            onChange={e => setFilter(e.target.value)}
            aria-label="Filter configuration options"
          />
        </div>
        <div className="table-scroll">
          <table className="docs-table">
            <thead>
              <tr>
                <th>Option</th>
                <th>Type</th>
                <th>Default</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(p => (
                <tr key={p.key as string}>
                  <td>
                    <code>{p.key as string}</code>
                  </td>
                  <td>
                    <code className="t-type">{p.type}</code>
                  </td>
                  <td>
                    <code className="t-default">{p.defaultValue}</code>
                  </td>
                  <td>{p.description}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="t-empty">
                    No option matches “{filter}”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="docs-note">
          Legacy v6 keys (<code>distortionStrength</code>, <code>edgeDistortion</code>,{' '}
          <code>caEdgeOnly</code>, <code>edgeBlurModifier</code>, …) are still accepted and mapped or
          safely ignored, so v6 configs keep working.
        </p>
      </div>

      <div className="docs-cols">
        <div className="docs-block">
          <h3>Material presets</h3>
          <p className="docs-lead">
            One word instead of five numbers — explicit keys still win over the preset.
          </p>
          <div className="table-scroll">
            <table className="docs-table docs-table--tight">
              <thead>
                <tr>
                  <th>material</th>
                  <th>blur</th>
                  <th>refraction</th>
                  <th>tint α</th>
                  <th>bezel</th>
                  <th>depth</th>
                </tr>
              </thead>
              <tbody>
                {materials.map(([name, p]) => (
                  <tr key={name}>
                    <td>
                      <code>'{name}'</code>
                    </td>
                    <td>{p.blur}px</td>
                    <td>{p.refractionStrength}px</td>
                    <td>{p.tintOpacity}</td>
                    <td>{p.bezelWidth}px</td>
                    <td>{p.thickness}px</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="docs-block">
          <h3>&lt;LiquidGlass&gt; props</h3>
          <p className="docs-lead">
            The React wrapper adds lifecycle animation on top of the engine.
          </p>
          <div className="table-scroll">
            <table className="docs-table docs-table--tight">
              <thead>
                <tr>
                  <th>Prop</th>
                  <th>Type</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {REACT_PROPS.map(([name, type, desc]) => (
                  <tr key={name}>
                    <td>
                      <code>{name}</code>
                    </td>
                    <td>
                      <code className="t-type">{type}</code>
                    </td>
                    <td>{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="docs-cols">
        <div className="docs-block">
          <h3>Imperative ref API</h3>
          <p className="docs-lead">
            <code>useRef&lt;LiquidGlassRef&gt;</code> gives you the animation triggers directly.
          </p>
          <div className="table-scroll">
            <table className="docs-table docs-table--tight">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Type</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {REF_API.map(([name, type, desc]) => (
                  <tr key={name}>
                    <td>
                      <code>{name}</code>
                    </td>
                    <td>
                      <code className="t-type">{type}</code>
                    </td>
                    <td>{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="docs-block">
          <h3>Water-droplet merging</h3>
          <p className="docs-lead">
            The animation toolkit is exported alongside the engine — metaballs in ten lines.
          </p>
          <CodeBlock code={METABALL_SNIPPET} lang="ts" title="metaballs.ts" />
        </div>
      </div>

      <div className="docs-block">
        <h3>Animation toolkit exports</h3>
        <div className="toolkit-grid">
          {TOOLKIT.map(([name, desc]) => (
            <div className="toolkit-item" key={name}>
              <code>{name}</code>
              <span>{desc}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="docs-block docs-callout">
        <h3>Field notes — read before shipping</h3>
        <ul>
          <li>
            The refraction path (<code>backdrop-filter: url()</code>) renders in <b>Chromium</b>.
            Safari and Firefox gracefully fall back to frost + lighting (set{' '}
            <code>refractionMode: 'css'</code> to force the fallback everywhere).
          </li>
          <li>
            Never put <code>isolation</code>, <code>filter</code>, <code>opacity</code> or{' '}
            <code>mask</code> on the glass host element — each one silently disables the backdrop
            refraction in Chromium.
          </li>
          <li>
            Never give the internal lens layer an explicit <code>z-index</code>; the engine manages
            its own stacking context.
          </li>
        </ul>
      </div>
    </section>
  );
}
