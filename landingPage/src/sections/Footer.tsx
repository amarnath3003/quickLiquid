import { Droplet } from '../components/Droplet';

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-signoff">
          <Droplet size={72} className="footer-drop" />
          <p className="display footer-motto">
            stay <em className="ink">liquid.</em>
          </p>
        </div>

        <div className="footer-row">
          <div className="footer-brand">
            <span className="wordmark">
              quick<em>liquid</em>
            </span>
            <small>ultra-optimized liquid glass for the web.</small>
          </div>
          <nav className="footer-links" aria-label="Footer">
            <a href="https://www.npmjs.com/package/quick-liquid" target="_blank" rel="noreferrer">
              npm
            </a>
            <a href="https://github.com/amarnath3003/quickLiquid" target="_blank" rel="noreferrer">
              GitHub
            </a>
            <a
              href="https://github.com/amarnath3003/quickLiquid/blob/main/packages/quick-liquid/PHYSICS.md"
              target="_blank"
              rel="noreferrer"
            >
              the physics
            </a>
            <a href="/docs/">docs</a>
            <a href="/#playground">playground</a>
          </nav>
        </div>
        <p className="footer-license">
          MIT © {new Date().getFullYear()} — PRs welcome. Bring a towel.
        </p>
      </div>
    </footer>
  );
}
