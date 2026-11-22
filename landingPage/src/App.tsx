import { SiteShell } from './components/SiteShell';
import { Hero } from './sections/Hero';
// import { GlassMarquee } from './components/Marquee';
import { Features } from './sections/Features';
import { Install } from './sections/Install';

export default function App() {
  return (
    <SiteShell page="home" skipTo="#top">
      <main id="top" className="glass-home">
        <Hero />
        {/* <GlassMarquee /> */}
        <Features />
        <Install />
      </main>
    </SiteShell>
  );
}
