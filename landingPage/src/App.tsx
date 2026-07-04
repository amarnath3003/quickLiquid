import { Nav } from './sections/Nav';
import { Hero } from './sections/Hero';
import { Features } from './sections/Features';
import { Liquid } from './sections/Liquid';
import { Install } from './sections/Install';
import { Playground } from './sections/Playground';
import { Docs } from './sections/Docs';
import { Footer } from './sections/Footer';
import { Goo } from './components/Goo';
import { Marquee } from './components/Marquee';
import { Drip } from './components/Drip';

export default function App() {
  return (
    <>
      <Goo />
      <div className="grain" aria-hidden />
      <Nav />
      <main>
        <Hero />
        <Marquee />
        <Features />
        <Liquid />
        <Drip className="drip--install" />
        <Install />
        <Playground />
        <Drip className="drip--docs" />
        <Docs />
      </main>
      <Footer />
    </>
  );
}
