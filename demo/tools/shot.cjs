// Screenshot harness: full page + close-up of a glass panel rim.
// Usage: node shot.js <outPrefix> [url]
const puppeteer = require('puppeteer');

(async () => {
  const prefix = process.argv[2] || 'shot';
  const url = process.argv[3] || 'http://localhost:5173';
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--force-color-profile=srgb', '--window-size=1500,1000'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 960, deviceScaleFactor: 2 });
  page.on('console', m => console.log('[page]', m.text()));
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2500));

  await page.screenshot({ path: `${prefix}-full.png` });

  // Close-up: first glass panel in the demo grid
  const panel = await page.$('.glass-panel');
  if (panel) {
    const box = await panel.boundingBox();
    if (box) {
      await page.screenshot({
        path: `${prefix}-closeup.png`,
        clip: {
          x: Math.max(0, box.x - 40),
          y: Math.max(0, box.y - 40),
          width: Math.min(1440, box.width + 80),
          height: box.height + 80,
        },
      });
    }
  }
  // Nav pill closeup (small element = rim dominates)
  const nav = await page.$('.glass-nav');
  if (nav) {
    const box = await nav.boundingBox();
    if (box) {
      await page.screenshot({
        path: `${prefix}-nav.png`,
        clip: {
          x: Math.max(0, box.x - 60), y: Math.max(0, box.y - 60),
          width: Math.min(1440, box.width + 120), height: box.height + 120,
        },
      });
    }
  }
  await browser.close();
  console.log('done');
})();
