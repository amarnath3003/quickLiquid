const puppeteer = require('puppeteer');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const assetsDir = path.join(root, 'assets');
const framesRoot = path.join(root, 'tmp', 'readme-frames');
const PORT = 4192;
const BASE_URL = `http://127.0.0.1:${PORT}/readme-studio.html`;

const STATIC_SCENES = [
  { scene: 'optics', width: 1200, height: 520, out: 'showcase-optics.png' },
  { scene: 'materials', width: 1200, height: 540, out: 'showcase-materials.png' },
  { scene: 'controls', width: 1200, height: 560, out: 'showcase-controls.png' },
  { scene: 'quality', width: 1200, height: 420, out: 'showcase-quality.png' },
];

const ANIMATED_SCENES = [
  {
    scene: 'intro',
    width: 880,
    height: 458,
    fps: 18,
    totalFrames: 72,
    previewFrame: 14,
    out: 'quick-liquid-intro.gif',
  },
  {
    scene: 'droplets',
    width: 840,
    height: 380,
    fps: 20,
    totalFrames: 72,
    previewFrame: 34,
    out: 'showcase-droplets.gif',
  },
  {
    scene: 'motion',
    width: 880,
    height: 430,
    fps: 20,
    totalFrames: 80,
    previewFrame: 23,
    out: 'showcase-motion.gif',
  },
];

function startVite() {
  const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
  const vite = spawn(
    process.execPath,
    [viteBin, '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'],
    {
      cwd: path.join(root, 'demo'),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    },
  );

  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Vite server timed out')), 30_000);
    vite.stdout.on('data', (chunk) => {
      const clean = chunk.toString().replace(/\x1b\[[0-9;]*m/g, '');
      if (clean.includes('Local:')) {
        clearTimeout(timer);
        resolve();
      }
    });
    vite.stderr.on('data', (chunk) => process.stderr.write(chunk));
    vite.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    vite.on('exit', (code) => {
      if (code !== null && code !== 0) {
        clearTimeout(timer);
        reject(new Error(`Vite exited early with code ${code}`));
      }
    });
  });

  return { vite, ready };
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stderr = '';
    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    proc.on('error', reject);
    proc.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg failed (${code}): ${stderr.slice(-800)}`));
    });
  });
}

async function openScene(browser, scene, width, height, deviceScaleFactor) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor });
  await page.goto(`${BASE_URL}?scene=${encodeURIComponent(scene)}`, {
    waitUntil: 'networkidle0',
  });
  await page.waitForFunction(() => document.body.dataset.studioReady === '1', {
    timeout: 15_000,
  });
  await new Promise((r) => setTimeout(r, 300));
  return page;
}

async function captureStatic(browser) {
  for (const spec of STATIC_SCENES) {
    const page = await openScene(browser, spec.scene, spec.width, spec.height, 2);
    const outPath = path.join(assetsDir, spec.out);
    await page.screenshot({ path: outPath, type: 'png', captureBeyondViewport: false });
    await page.close();
    const size = fs.statSync(outPath).size;
    console.log(`[static] ${path.relative(root, outPath)} (${size} bytes)`);
  }
}

async function captureAnimated(browser) {
  for (const spec of ANIMATED_SCENES) {
    const dir = path.join(framesRoot, spec.scene);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });

    const page = await openScene(browser, spec.scene, spec.width, spec.height, 1);

    for (let i = 0; i < spec.totalFrames; i++) {
      await page.evaluate((progress) => {
        window.__README_STUDIO__?.seek(progress);
      }, i / spec.totalFrames);
      await page.evaluate(
        () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
      );
      const framePath = path.join(dir, `frame-${String(i).padStart(4, '0')}.png`);
      await page.screenshot({ path: framePath, type: 'png', captureBeyondViewport: false });

      if (i === 0) {
        fs.copyFileSync(framePath, path.join(framesRoot, `${spec.scene}-frame0.png`));
      }
      if (i === spec.previewFrame) {
        fs.copyFileSync(framePath, path.join(framesRoot, `${spec.scene}-preview.png`));
      }
    }

    await page.close();

    const palettePath = path.join(dir, 'palette.png');
    const outPath = path.join(assetsDir, spec.out);
    const inputPattern = path.join(dir, 'frame-%04d.png');

    await runFfmpeg([
      '-y',
      '-framerate',
      String(spec.fps),
      '-i',
      inputPattern,
      '-vf',
      'palettegen=max_colors=256:stats_mode=diff',
      palettePath,
    ]);

    await runFfmpeg([
      '-y',
      '-framerate',
      String(spec.fps),
      '-i',
      inputPattern,
      '-i',
      palettePath,
      '-lavfi',
      'paletteuse=dither=bayer:bayer_scale=3',
      '-loop',
      '0',
      outPath,
    ]);

    const size = fs.statSync(outPath).size;
    console.log(`[gif]    ${path.relative(root, outPath)} (${size} bytes)`);
  }
}

async function main() {
  fs.mkdirSync(assetsDir, { recursive: true });
  fs.mkdirSync(framesRoot, { recursive: true });

  const { vite, ready } = startVite();
  let browser;
  try {
    await ready;
    browser = await puppeteer.launch({
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: true,
      args: ['--disable-gpu-vsync', '--hide-scrollbars'],
    });
    await captureStatic(browser);
    await captureAnimated(browser);
  } finally {
    if (browser) await browser.close();
    vite.kill();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
