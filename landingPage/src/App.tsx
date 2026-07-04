import { Nav } from './sections/Nav';
import { Hero } from './sections/Hero';
import { Features } from './sections/Features';
import { Liquid } from './sections/Liquid';
import { Install } from './sections/Install';
import { Playground } from './sections/Playground';
import { Footer } from './sections/Footer';
import { Goo } from './components/Goo';
import { GlassMarquee } from './components/Marquee';

export default function App() {
  return (
    <>
      <Goo />
      <div className="grain" aria-hidden />
      <Nav />
      <main>
        <Hero />
        <GlassMarquee />
        <Features />
        <Liquid />
        <Install />
        <Playground />
      </main>
      <Footer />
    </>
  );
}
