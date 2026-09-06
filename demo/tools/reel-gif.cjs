/**
 * reel-gif.cjs — renders the intro reel to an animated GIF for the README.
 *
 *   node tools/reel-gif.cjs [out.gif] [width] [fps] [colors] [tolerance]
 *   node tools/reel-gif.cjs ../assets/quick-liquid-reel.gif 720 14 128 10
 *
 * ── Why the capture is exact ───────────────────────────────────────────────
 * Every visual in the reel is a pure function of the film clock, so this does
 * not "record" in real time. It seeks to an exact millisecond, waits for paint,
 * and grabs the frame: no dropped frames, no duplicated frames, same bytes out
 * on every run.
 *
 * The browser viewport is set to the OUTPUT size rather than to 1920x1080, so
 * the reel's own `zoom` fit does the scaling. That matters — `zoom` changes real
 * layout size, so each glass host regenerates its displacement map at the size
 * it is actually painted at. Downscaling 1920px frames afterwards would instead
 * resample a map built for another geometry and soften every rim in the film.
 * tools/reel-fitcheck.cjs verifies refraction is still live at these zooms.
 *
 * ── Why the file is not enormous ───────────────────────────────────────────
 * A naive encode of this film is ~10MB, which has no business in a README. GIF
 * compresses runs of identical palette indices, and a screen full of drifting
 * gradients has almost none. Two things fix that:
 *
 *   1. Per-frame palettes. One global palette cannot span a film that opens on
 *      near-black and peaks on saturated cyan, indigo and magenta.
 *
 *   2. Inter-frame delta encoding. Each frame keeps a running copy of what the
 *      GIF is actually displaying and marks every pixel still within `tolerance`
 *      of it as transparent, with dispose:1 so the previous pixel shows through.
 *      Long runs of transparency are exactly what LZW is good at. Comparing
 *      against the displayed canvas rather than the previous source frame is
 *      what keeps the error bounded — a pixel stays stale only while it is
 *      genuinely within tolerance of the truth, so drift cannot accumulate.
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { PNG } = require('pngjs');
const { GIFEncoder, quantize, applyPalette } = require('gifenc');

const FRAME_W = 1920;
const FRAME_H = 1080;

(async () => {
  const out = path.resolve(process.argv[2] || '../assets/quick-liquid-reel.gif');
  const width = Number(process.argv[3] || 720);
  const fps = Number(process.argv[4] || 14);
  const colors = Number(process.argv[5] || 128);
  /** Per-channel 0..255 difference below which a pixel is left as-is. */
  const tolerance = Number(process.argv[6] || 10);
  const height = Math.round((width * FRAME_H) / FRAME_W);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--force-color-profile=srgb',
      '--hide-scrollbars',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));

  await page.goto('http://127.0.0.1:5188/reel.html?clean=1&paused=1', {
    waitUntil: 'networkidle0',
    timeout: 60000,
  });
  await page.waitForFunction('!!window.__REEL__ && document.body.dataset.reelReady === "1"');
  // Let every engine build its first displacement map before grabbing anything.
  await new Promise((r) => setTimeout(r, 1200));

  const duration = await page.evaluate(() => window.__REEL__.duration);
  const delay = Math.round(1000 / fps);
  const count = Math.floor(duration / delay) + 1;

  console.log(
    `rendering ${count} frames  ${width}x${height} @ ${fps}fps  ${colors} colours  ` +
      `tol ${tolerance}  (${(duration / 1000).toFixed(1)}s)`,
  );

  const gif = GIFEncoder();
  /** What the GIF currently shows, in quantized RGB. */
  const canvas = new Uint8Array(width * height * 3);
  let held = 0;

  for (let i = 0; i < count; i++) {
    await page.evaluate((t) => window.__REEL__.seek(t), i * delay);
    // Two rAFs: one for React to commit, one for the compositor to paint it.
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    );

    const png = PNG.sync.read(await page.screenshot({ type: 'png' }));
    const rgba = new Uint8ClampedArray(png.data.buffer, png.data.byteOffset, png.data.length);
    const n = png.width * png.height;

    if (i === 0) {
      const palette = quantize(rgba, colors, { format: 'rgb565' });
      const index = applyPalette(rgba, palette, 'rgb565');
      for (let p = 0; p < n; p++) {
        const c = palette[index[p]];
        canvas[p * 3] = c[0];
        canvas[p * 3 + 1] = c[1];
        canvas[p * 3 + 2] = c[2];
      }
      gif.writeFrame(index, png.width, png.height, { palette, delay, dispose: 1 });
    } else {
      /* Index 0 is reserved for transparency. Quantize to one colour fewer and
         shift every index up by one, so applyPalette can never itself emit 0 —
         otherwise dark pixels would map onto the transparent slot and show
         stale content instead of themselves. */
      const base = quantize(rgba, colors - 1, { format: 'rgb565' });
      const index = applyPalette(rgba, base, 'rgb565');
      const palette = [[0, 0, 0], ...base];

      for (let p = 0; p < n; p++) {
        const c = base[index[p]];
        const o = p * 3;
        if (
          Math.abs(c[0] - canvas[o]) <= tolerance &&
          Math.abs(c[1] - canvas[o + 1]) <= tolerance &&
          Math.abs(c[2] - canvas[o + 2]) <= tolerance
        ) {
          index[p] = 0; // unchanged — let the previous frame show through
          held++;
        } else {
          index[p] = index[p] + 1;
          canvas[o] = c[0];
          canvas[o + 1] = c[1];
          canvas[o + 2] = c[2];
        }
      }

      gif.writeFrame(index, png.width, png.height, {
        palette,
        delay,
        transparent: true,
        transparentIndex: 0,
        dispose: 1,
      });
    }

    if ((i + 1) % 25 === 0 || i === count - 1) process.stdout.write(`  ${i + 1}/${count}\r`);
  }

  gif.finish();
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.from(gif.bytes()));
  await browser.close();

  const bytes = fs.statSync(out).size;
  const mb = bytes / 1024 / 1024;
  const skipped = ((held / (width * height * (count - 1))) * 100).toFixed(1);
  console.log(
    `\nwrote ${out}\n` +
      `  ${count} frames, ${width}x${height}, ${fps}fps, ${colors} colours\n` +
      `  ${skipped}% of pixels carried over untouched\n` +
      `  ${mb >= 1 ? mb.toFixed(2) + ' MB' : (bytes / 1024).toFixed(0) + ' KB'}`,
  );
})();
