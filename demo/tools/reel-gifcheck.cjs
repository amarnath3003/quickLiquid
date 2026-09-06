/**
 * reel-gifcheck.cjs — decodes frames back OUT of an encoded GIF so the delta
 * encoding can be inspected rather than trusted.
 *
 *   node tools/reel-gifcheck.cjs <in.gif> <outDir> [frameIndex,frameIndex,...]
 *
 * The exporter leaves up to `tolerance` of per-channel error on any pixel it
 * carries over, and marks ~87% of them. That is a real quality trade, and the
 * only honest way to judge it is to look at what a decoder actually produces
 * after all those transparent frames have composited on top of each other —
 * late frames are where ghosting would show up if the scheme were wrong.
 *
 * Uses Chrome's ImageDecoder (WebCodecs), which composites GIF disposal methods
 * the same way a browser showing the README will.
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

(async () => {
  const input = path.resolve(process.argv[2]);
  const outDir = path.resolve(process.argv[3] || '../.reel/gifcheck');
  const wanted = (process.argv[4] || '0,60,100,140').split(',').map(Number);

  fs.mkdirSync(outDir, { recursive: true });
  const b64 = fs.readFileSync(input).toString('base64');

  const browser = await puppeteer.launch({ headless: 'new', args: ['--hide-scrollbars'] });
  const page = await browser.newPage();
  // ImageDecoder is a secure-context API, so this needs a real origin rather
  // than about:blank. localhost counts as secure; the dev server will do.
  await page.goto('http://127.0.0.1:5188/reel.html?clean=1&paused=1', { waitUntil: 'domcontentloaded' });

  const results = await page.evaluate(
    async (data, indices) => {
      const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
      const decoder = new ImageDecoder({ data: bytes, type: 'image/gif' });
      // tracks.ready must settle before selectedTrack exists; completed waits
      // for the whole animation to be parsed so frameCount is final.
      await decoder.tracks.ready;
      await decoder.completed;

      const total = decoder.tracks.selectedTrack.frameCount;
      const out = [];
      for (const i of indices) {
        if (i >= total) continue;
        const { image } = await decoder.decode({ frameIndex: i });
        const c = document.createElement('canvas');
        c.width = image.displayWidth;
        c.height = image.displayHeight;
        c.getContext('2d').drawImage(image, 0, 0);
        out.push({ i, url: c.toDataURL('image/png') });
      }
      return { total, out };
    },
    b64,
    wanted,
  );

  for (const { i, url } of results.out) {
    const file = path.join(outDir, `frame-${String(i).padStart(3, '0')}.png`);
    fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
    console.log('wrote', file);
  }
  console.log(`(${results.total} frames in ${path.basename(input)})`);

  await browser.close();
})();
