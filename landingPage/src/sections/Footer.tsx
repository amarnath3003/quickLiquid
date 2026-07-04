export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <span aria-hidden>💧</span> QuickLiquid
          <small>Ultra-optimized liquid glass for the web.</small>
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
            The physics
          </a>
          <a href="#docs">Docs</a>
          <a href="#playground">Playground</a>
        </nav>
        <p className="footer-license">MIT © {new Date().getFullYear()} — PRs welcome.</p>
      </div>
    </footer>
  );
}
