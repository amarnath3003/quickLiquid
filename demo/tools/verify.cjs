/**
 * Full numeric verification:
 *  1. Per-element refraction liveness at DEFAULT scales (scale=0 vs default).
 *  2. Engine metrics: map generation time, pixels computed, map sharing.
 */
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 960, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2500));

  await page.evaluate(() => {
    const st = document.createElement('style');
    st.textContent = '*{animation-play-state:paused !important; transition:none !important;}';
    document.head.appendChild(st);
  });

  // Save default scales, then measure diff of scale=0 vs default per element
  const targets = ['.glass-nav', '.playground-lens', '.material-card', '.glass-hero-pill', '.glass-panel', '.live-preview-box'];

  const saved = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('svg filter feDisplacementMap')];
    return nodes.map(n => n.getAttribute('scale'));
  });

  async function shotRegion(clip) {
    return page.screenshot({ clip, encoding: 'base64' });
  }
  async function diffB64(a, b) {
    return page.evaluate(async (pa, pb) => {
      const load = (s) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = 'data:image/png;base64,' + s; });
      const [ia, ib] = await Promise.all([load(pa), load(pb)]);
      const c = document.createElement('canvas');
      c.width = ia.width; c.height = ia.height;
      const x = c.getContext('2d', { willReadFrequently: true });
      x.drawImage(ia, 0, 0);
      const da = x.getImageData(0, 0, c.width, c.height).data;
      x.clearRect(0, 0, c.width, c.height);
      x.drawImage(ib, 0, 0);
      const db = x.getImageData(0, 0, c.width, c.height).data;
      let sum = 0;
      for (let i = 0; i < da.length; i += 4) {
        sum += Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]);
      }
      return sum / (da.length / 4) / 3;
    }, a, b);
  }

  for (const sel of targets) {
    const el = await page.$(sel);
    if (!el) { console.log(sel, ': not found'); continue; }
    const bb = await el.boundingBox();
    if (!bb || bb.width < 4) { console.log(sel, ': zero box'); continue; }
    const clip = { x: Math.max(0, Math.round(bb.x - 6)), y: Math.max(0, Math.round(bb.y - 6)), width: Math.round(bb.width + 12), height: Math.round(bb.height + 12) };

    await page.evaluate(() => {
      [...document.querySelectorAll('svg filter feDisplacementMap')].forEach(n => n.setAttribute('scale', '0'));
    });
    await new Promise(r => setTimeout(r, 250));
    const a = await shotRegion(clip);
    await page.evaluate((sc) => {
      [...document.querySelectorAll('svg filter feDisplacementMap')].forEach((n, i) => n.setAttribute('scale', sc[i] || '0'));
    }, saved);
    await new Promise(r => setTimeout(r, 250));
    const b = await shotRegion(clip);
    const d = await diffB64(a, b);
    console.log(`${sel}: refractionDiff=${d.toFixed(3)} ${d > 0.15 ? 'LIVE' : 'DEAD'}`);
  }

  const metrics = await page.evaluate(() => (globalThis).__QUICK_LIQUID__?.metrics());
  console.log('METRICS', JSON.stringify(metrics, null, 1));
  await browser.close();
})();
