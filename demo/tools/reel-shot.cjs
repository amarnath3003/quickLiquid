/**
 * reel-shot.cjs — deterministic frame grabber for the intro reel.
 *
 * The reel exposes window.__REEL__.seek(ms) and every visual is a pure function
 * of that millisecond, so this script does not "record" anything in real time:
 * it seeks, waits for paint, and grabs a pixel-exact frame. Same input, same
 * output, every run.
 *
 *   node tools/reel-shot.cjs <outDir> [ms,ms,ms | all] [url]
 *
 *   node tools/reel-shot.cjs ../.reel/checks 0,1200,2400,3600,5200,6400,7800,9600,12000
 *   node tools/reel-shot.cjs ../.reel/frames all      # 60fps sequence
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const FPS = 60;

(async () => {
  const outDir = path.resolve(process.argv[2] || '../.reel/checks');
  const spec = process.argv[3] || '0,1500,2900,3900,5200,6400,7600,9000,10800,12500';
  const url = process.argv[4] || 'http://127.0.0.1:5188/reel.html?clean=1&paused=1';

  fs.mkdirSync(outDir, { recursive: true });

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--force-color-profile=srgb',
      '--hide-scrollbars',
      '--window-size=1940,1120',
      // Keep rAF and compositing running while headless so paints actually land.
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  page.on('console', (m) => m.type() === 'error' && console.log('[console]', m.text()));

  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForFunction('!!window.__REEL__ && document.body.dataset.reelReady === "1"');

  // Let every engine build its first displacement map before grabbing anything.
  await new Promise((r) => setTimeout(r, 1200));

  const duration = await page.evaluate(() => window.__REEL__.duration);
  const times =
    spec === 'all'
      ? Array.from({ length: Math.round((duration / 1000) * FPS) + 1 }, (_, i) =>
          Math.round((i * 1000) / FPS),
        )
      : spec.split(',').map(Number);

  const pad = String(times.length).length + 1;
  let i = 0;

  for (const ms of times) {
    await page.evaluate((t) => window.__REEL__.seek(t), ms);
    // Two rAFs: one for React to commit, one for the compositor to paint it.
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    );
    const name =
      spec === 'all'
        ? `f${String(i).padStart(pad, '0')}.png`
        : `t${String(ms).padStart(5, '0')}.png`;
    await page.screenshot({ path: path.join(outDir, name) });
    i++;
    if (spec === 'all' && i % 60 === 0) console.log(`  ${i}/${times.length} frames`);
  }

  const metrics = await page.evaluate(() => window.__QUICK_LIQUID__?.metrics?.() ?? null);
  await browser.close();

  console.log(`wrote ${times.length} frame(s) to ${outDir}`);
  if (metrics) console.log('engine metrics:', JSON.stringify(metrics, null, 2).slice(0, 1400));
})();
