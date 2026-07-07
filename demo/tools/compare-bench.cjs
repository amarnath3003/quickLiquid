// Relative throughput probe for the compare bench: solo v7 vs solo v8,
// stress cards + backdrop motion. Numbers are only meaningful as a RATIO
// on the same machine/run (headless GPU differs from real desktops).
// Usage: node compare-bench.cjs [url] [stressCount] [seconds]
const puppeteer = require('puppeteer');

async function setRange(page, selector, value) {
  await page.evaluate((sel, val) => {
    const input = document.querySelector(sel);
    if (!input) throw new Error('no input ' + sel);
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, String(val));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, selector, value);
}

async function clickButton(page, label) {
  await page.evaluate((txt) => {
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === txt);
    if (!btn) throw new Error('no button ' + txt);
    btn.click();
  }, label);
}

async function measure(page, ms) {
  return page.evaluate((dur) => new Promise(resolve => {
    const deltas = [];
    let last = performance.now();
    const t0 = last;
    const loop = (now) => {
      deltas.push(now - last);
      last = now;
      if (now - t0 < dur) requestAnimationFrame(loop);
      else {
        deltas.sort((a, b) => a - b);
        const sum = deltas.reduce((s, d) => s + d, 0);
        resolve({
          frames: deltas.length,
          avgMs: sum / deltas.length,
          fps: 1000 / (sum / deltas.length),
          p95Ms: deltas[Math.floor(deltas.length * 0.95)],
          longFrames: deltas.filter(d => d > 25).length,
        });
      }
    };
    requestAnimationFrame(loop);
  }), ms);
}

(async () => {
  const url = process.argv[2] || 'http://localhost:5175';
  const stress = Number(process.argv[3] ?? 12);
  const seconds = Number(process.argv[4] ?? 6);
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--force-color-profile=srgb', '--window-size=1620,1000',
      // Unlock the frame rate so rAF frequency measures raw render throughput
      '--disable-gpu-vsync', '--disable-frame-rate-limit',
    ],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 960, deviceScaleFactor: 2 });
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2500));

  // Optionally re-preset Profile A (stress cards clone it): argv[5]
  const preset = process.argv[5];
  if (preset) {
    await page.evaluate((p) => {
      const sel = document.querySelectorAll('.cmp-rail select')[0];
      const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
      setter.call(sel, p);
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }, preset);
    await new Promise(r => setTimeout(r, 800));
  }

  // stress slider = the only range input in the View section
  await setRange(page, '.cmp-rail .ctl-section input[type=range]', stress);
  await new Promise(r => setTimeout(r, 2000)); // maps generate & settle

  const results = {};
  for (const [label, btn] of [['v7', 'v7 solo'], ['v8', 'v8 solo']]) {
    await clickButton(page, btn);
    await new Promise(r => setTimeout(r, 1500));
    results[label] = await measure(page, seconds * 1000);
  }
  await clickButton(page, 'Both');

  console.log(`stress=${stress}, window=${seconds}s each, dsf=1`);
  for (const [k, v] of Object.entries(results)) {
    console.log(`${k}: ${v.fps.toFixed(1)} fps | avg ${v.avgMs.toFixed(2)} ms | p95 ${v.p95Ms.toFixed(2)} ms | long ${v.longFrames}/${v.frames}`);
  }
  const ratio = results.v8.avgMs > 0 ? results.v7.avgMs / results.v8.avgMs : 0;
  console.log(`frame-time ratio v7/v8: ${ratio.toFixed(2)}×`);

  await browser.close();
})();
