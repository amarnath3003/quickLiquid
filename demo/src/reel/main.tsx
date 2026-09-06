import ReactDOM from 'react-dom/client';
import Intro from './Intro';

/*
 * Deliberately not wrapped in <React.StrictMode>. Strict mode double-invokes
 * mount effects in development, which would construct, destroy and reconstruct
 * every LiquidGlassEngine on the page — harmless for a UI demo, but it throws
 * away displacement maps and adds a hitch at exactly the moment the reel starts
 * playing. The reel is a recording surface, so it runs clean.
 */
ReactDOM.createRoot(document.getElementById('reel-root')!).render(<Intro />);
