import { Nav } from './sections/Nav';
import { Docs } from './sections/Docs';
import { Footer } from './sections/Footer';
import { Goo } from './components/Goo';

export default function DocsApp() {
  return (
    <>
      <Goo />
      <div className="grain" aria-hidden />
      <Nav base="/" />
      <main className="docs-page">
        <Docs />
      </main>
      <Footer />
    </>
  );
}
