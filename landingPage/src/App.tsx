import { Nav } from './sections/Nav';
import { Hero } from './sections/Hero';
import { Features } from './sections/Features';
import { Install } from './sections/Install';
import { Playground } from './sections/Playground';
import { Docs } from './sections/Docs';
import { Footer } from './sections/Footer';

export default function App() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Features />
        <Install />
        <Playground />
        <Docs />
      </main>
      <Footer />
    </>
  );
}
