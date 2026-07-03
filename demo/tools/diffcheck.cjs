/**
 * Numeric displacement detector — no eyeballing.
 * For a given clip region: screenshot with all feDisplacementMap scale=0,
 * then scale=140, and compute mean |ΔRGB| per pixel inside the browser.
 * diff >> 0.5 ⇒ displacement is live in that region.
 */
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 960, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2500));

  // Freeze all animations/transitions so diffs measure ONLY the filter change
  await page.evaluate(() => {
    const st = document.createElement('style');
    st.textContent = '*{animation-play-state:paused !important; transition:none !important;}';
    document.head.appendChild(st);
  });

  const setScales = (v) => {
    [...document.querySelectorAll('svg filter feDisplacementMap')].forEach(n => n.setAttribute('scale', String(v)));
  };

  async function measure(clip, label) {
    await page.evaluate(setScales, 0);
    await new Promise(r => setTimeout(r, 350));
    const a = await page.screenshot({ clip, encoding: 'base64' });
    await page.evaluate(setScales, 140);
    await new Promise(r => setTimeout(r, 350));
    const b = await page.screenshot({ clip, encoding: 'base64' });
    const diff = await page.evaluate(async (pa, pb) => {
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
    console.log(`${label}: meanDiff=${diff.toFixed(3)} ${diff > 0.5 ? '<<< LIVE' : '(dead)'}`);
    return diff;
  }

  const idx = 2; // Frosted panel
  const panels = await page.$$('.glass-panel');
  const bb = await panels[idx].boundingBox();
  const clip = { x: Math.round(bb.x - 10), y: Math.round(bb.y - 10), width: Math.round(bb.width + 20), height: Math.round(bb.height + 20) };

  await measure(clip, '0-as-is');

  const steps = [
    ['a-remove-content', (i) => { document.querySelectorAll('.glass-panel')[i].querySelector('.ql-content')?.remove(); }],
    ['b-ovf-visible', (i) => { document.querySelectorAll('.glass-panel')[i].style.overflow = 'visible'; }],
    ['c-no-shadow', (i) => { document.querySelectorAll('.glass-panel')[i].style.boxShadow = 'none'; }],
    ['d-no-class', (i) => {
      const p = document.querySelectorAll('.glass-panel')[i];
      p.dataset.probe = '1';
      p.style.width = '620px'; p.style.height = '260px';
      p.className = '';
    }],
    ['e-no-radius', () => {
      const p = document.querySelector('[data-probe]');
      p.style.borderRadius = '0';
      p.querySelectorAll(':scope > div').forEach(d => d.style.borderRadius = '0');
    }],
    ['f-remove-other-layers', () => {
      const p = document.querySelector('[data-probe]');
      ['.ql-tint', '.ql-sheen', '.ql-rim', '.ql-noise'].forEach(s => p.querySelector(s)?.remove());
    }],
    ['g-reinsert-lens-last', () => {
      const p = document.querySelector('[data-probe]');
      const lens = p.querySelector('.ql-lens');
      p.appendChild(lens); // move to last position (same node)
    }],
    ['h-clone-lens', () => {
      const p = document.querySelector('[data-probe]');
      const lens = p.querySelector('.ql-lens');
      const clone = lens.cloneNode(false);
      lens.replaceWith(clone);
    }],
  ];

  for (const [name, fn] of steps) {
    await page.evaluate(fn, idx);
    await new Promise(r => setTimeout(r, 300));
    await measure(clip, name);
  }

  // positive control: fresh last-child probe with the panel's own filter
  await page.evaluate((i) => {
    const p = document.querySelector('[data-probe]') || document.querySelectorAll('.glass-panel')[i];
    const lens = p.querySelector('.ql-lens');
    const bdf = lens ? getComputedStyle(lens).backdropFilter : '';
    const m = bdf.match(/url\("?(#[^")]+)"?\)/);
    const d = document.createElement('div');
    Object.assign(d.style, { position: 'absolute', inset: '0' });
    d.style.backdropFilter = m ? `url(${m[1]})` : 'url(#none)';
    p.appendChild(d);
  }, idx);
  await new Promise(r => setTimeout(r, 300));
  await measure(clip, 'CONTROL-lastchild-probe');

  await browser.close();
})();
