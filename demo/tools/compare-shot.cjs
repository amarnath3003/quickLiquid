// Screenshot harness for the compare bench (compare/ app).
// Usage: node compare-shot.cjs <outPrefix> [url]
// Captures: full side-by-side, per-pane card close-ups, and a wipe-mode shot.
const puppeteer = require('puppeteer');

(async () => {
  const prefix = process.argv[2] || 'cmp';
  const url = process.argv[3] || 'http://localhost:5175';
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--force-color-profile=srgb', '--window-size=1620,1000'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 960, deviceScaleFactor: 2 });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  page.on('console', m => {
    const t = m.text();
    if (m.type() === 'error') console.log('[console.error]', t);
  });
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
  await new Promise(r => setTimeout(r, 3000));

  await page.screenshot({ path: `${prefix}-side.png` });

  // Close-up of profile A card in each pane (first card per scene)
  const cards = await page.$$('.cmp-card');
  for (let i = 0; i < Math.min(2, cards.length); i++) {
    // cards are [A, B, ...stress] per scene; scene 0 = base, scene 1 = opt
  }
  const scenes = await page.$$('.cmp-scene');
  for (let s = 0; s < scenes.length; s++) {
    const card = await scenes[s].$('.cmp-card');
    if (!card) continue;
    const box = await card.boundingBox();
    if (!box) continue;
    await page.screenshot({
      path: `${prefix}-card-${s === 0 ? 'v7' : 'v8'}.png`,
      clip: {
        x: Math.max(0, box.x - 50), y: Math.max(0, box.y - 50),
        width: Math.min(1600 - box.x + 50, box.width + 100), height: box.height + 100,
      },
    });
  }

  // Engine metrics from both registries
  const metrics = await page.evaluate(() => ({
    v7: globalThis.__QUICK_LIQUID__ ? globalThis.__QUICK_LIQUID__.metrics() : null,
    v8: globalThis.__QUICK_LIQUID_OPT__ ? globalThis.__QUICK_LIQUID_OPT__.metrics() : null,
  }));
  console.log(JSON.stringify(metrics, null, 2));

  // Wipe mode shot
  const buttons = await page.$$('.btn-group button');
  for (const b of buttons) {
    const label = await b.evaluate(el => el.textContent);
    if (label === 'Wipe') { await b.click(); break; }
  }
  await new Promise(r => setTimeout(r, 2500));
  await page.screenshot({ path: `${prefix}-wipe.png` });

  await browser.close();
  console.log('done');
})();
