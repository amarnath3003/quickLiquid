/**
 * reel-fitcheck.cjs — proves the review-time `zoom` fit does not kill refraction.
 *
 * The reel scales a fixed 1920x1080 composition down to whatever window is
 * reviewing it. `zoom` is used rather than `transform: scale` because zoom
 * changes real layout size, so each glass host rebuilds its displacement map at
 * the size it is actually painted at. This script checks that claim the way
 * VISUAL_QA_HANDOFF.md §3.4 says to check it: toggle every feDisplacementMap
 * scale between 0 and its real value at a fitted viewport and measure the mean
 * pixel difference. Anything above ~0.5 in the lens region means displacement
 * is genuinely live at that zoom.
 */
const puppeteer = require('puppeteer');

const URL = 'http://127.0.0.1:5188/reel.html?clean=1&paused=1';

async function meanDiff(page, box) {
  const shots = [];
  for (const off of [false, true]) {
    await page.evaluate((disable) => {
      document.querySelectorAll('feDisplacementMap').forEach((n) => {
        if (disable) {
          n.dataset.keep = n.getAttribute('scale');
          n.setAttribute('scale', '0');
        } else if (n.dataset.keep !== undefined) {
          n.setAttribute('scale', n.dataset.keep);
        }
      });
    }, off);
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    );
    shots.push(await page.screenshot({ clip: box })); // PNG buffer
  }
  // Compare raw PNG bytes via a canvas decode inside the page for accuracy.
  return page.evaluate(
    async ([a, b]) => {
      const load = (bytes) =>
        new Promise((res) => {
          const img = new Image();
          img.onload = () => res(img);
          img.src = 'data:image/png;base64,' + bytes;
        });
      const [ia, ib] = await Promise.all([load(a), load(b)]);
      const c = document.createElement('canvas');
      c.width = ia.width;
      c.height = ia.height;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(ia, 0, 0);
      const da = ctx.getImageData(0, 0, c.width, c.height).data;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(ib, 0, 0);
      const db = ctx.getImageData(0, 0, c.width, c.height).data;
      let sum = 0;
      for (let i = 0; i < da.length; i += 4) {
        sum += Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]);
      }
      return sum / (da.length / 4) / 3;
    },
    [shots[0].toString('base64'), shots[1].toString('base64')],
  );
}

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--force-color-profile=srgb', '--hide-scrollbars'],
  });

  // t = 6400: the hero lens is mid-sweep, sitting over the wordmark — the
  // region with the most backdrop contrast in the whole film. 720px is the
  // width the README GIF is rendered at, so it has to pass too.
  for (const [w, h] of [
    [1920, 1080],
    [1280, 720],
    [960, 540],
    [720, 405],
  ]) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });
    await page.waitForFunction('document.body.dataset.reelReady === "1"');
    await new Promise((r) => setTimeout(r, 1000));
    await page.evaluate(() => window.__REEL__.seek(6400));
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    );

    const box = await page.evaluate(() => {
      const el = document.querySelector('.actor');
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
    });

    const zoom = await page.evaluate(
      () => getComputedStyle(document.querySelector('.reel-frame')).zoom,
    );
    const diff = await meanDiff(page, box);
    console.log(
      `${String(w).padStart(4)}x${h}  zoom=${Number(zoom).toFixed(3)}  lens=${box.width}x${box.height}  ` +
        `mean|dRGB| displacement off vs on = ${diff.toFixed(2)}  ${diff > 0.5 ? 'LIVE' : 'DEAD'}`,
    );
    await page.close();
  }

  await browser.close();
})();
