const test = require('node:test');
const assert = require('node:assert/strict');
const { build } = require('esbuild');
const path = require('node:path');

async function moduleAt(file) {
  const result = await build({ entryPoints: [path.join(__dirname, '../src/core', file)], bundle: true, platform: 'node', format: 'esm', write: false });
  return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
}
const optics = moduleAt('optics.ts'), config = moduleAt('config.ts');

test('Snell profile is bounded, vanishes at both boundaries, and is neutral at IOR 1', async () => {
  const { refractionProfile } = await optics;
  for (const [t, b, ior] of [[24, 34, 1.5], [1, 80, 1.2], [80, 2, 2.5]]) {
    const lut = refractionProfile(t, b, ior);
    assert.equal(lut[0], 0); assert.equal(lut.at(-1), 0);
    assert.ok(lut.every(x => Number.isFinite(x) && x >= 0 && x <= 1));
    assert.ok(Math.max(...lut) > .999);
  }
  assert.ok(refractionProfile(24, 34, 1).every(x => x === 0));
});

test('profile scaling invariance and bounded profile memoization', async () => {
  const { refractionProfile } = await optics;
  assert.equal(refractionProfile(12, 24, 1.5), refractionProfile(24, 48, 1.5));
  const first = refractionProfile(1, 1, 1.5);
  for (let i = 2; i < 40; i++) refractionProfile(i, 1, 1.5);
  assert.notEqual(refractionProfile(1, 1, 1.5), first);
});

test('raster has exact axis symmetry, neutral guard band, clear center and opaque alpha', async () => {
  const { rasterizeLens } = await optics;
  for (const [w, h, mw, mh, radius] of [[240, 160, 240, 160, 32], [241, 161, 121, 81, 28.5], [121, 121, 121, 121, 60.5], [400, 52, 200, 26, 26]]) {
    const r = rasterizeLens({ width: w, height: h, mapWidth: mw, mapHeight: mh, radius, bezel: 20, thickness: 24, ior: 1.5, padding: 16 });
    const pixel = (x, y, c) => r.data[(y * r.width + x) * 4 + c];
    for (let y = 0; y < r.height; y++) for (let x = 0; x < r.width; x++) {
      assert.equal(pixel(x, y, 3), 255);
      assert.equal(pixel(x, y, 0) + pixel(r.width - 1 - x, y, 0), 256);
      assert.equal(pixel(x, y, 1) + pixel(x, r.height - 1 - y, 1), 256);
      if (x < r.padX || x >= r.width - r.padX || y < r.padY || y >= r.height - r.padY) {
        assert.equal(pixel(x, y, 0), 128); assert.equal(pixel(x, y, 1), 128);
      }
    }
    assert.equal(pixel(Math.floor(r.width / 2), Math.floor(r.height / 2), 0), 128);
    assert.equal(pixel(Math.floor(r.width / 2), Math.floor(r.height / 2), 1), 128);
    assert.ok(r.pixelsComputed > 0 && r.pixelsComputed < mw * mh / 4);
  }
});

test('SVG recentering has zero neutral and symmetric full-range displacement', () => {
  const decode = byte => (byte / 255 * (255 / 254) - 1 / 254 - .5);
  assert.ok(Math.abs(decode(128)) < 1e-14);
  assert.ok(Math.abs(decode(1) + .5) < 1e-14);
  assert.ok(Math.abs(decode(255) - .5) < 1e-14);
});

test('frost gate retains exact RGB on request and on clear material', async () => {
  const { usesDispersion } = await optics;
  assert.equal(usesDispersion(26, .3, 2, 'high'), true);
  assert.equal(usesDispersion(16, .18, 14, 'high'), false);
  assert.equal(usesDispersion(16, .18, 14, 'high', 'exact'), true);
  assert.equal(usesDispersion(26, .3, 2, 'low', 'exact'), false);
});

test('explicit overrides and material selection remain distinct; invalid numbers are bounded', async () => {
  const { resolveGlassConfig, MATERIAL_PRESETS, DEFAULT_CONFIG } = await config;
  assert.equal(resolveGlassConfig({ material: 'regular' }).blur, MATERIAL_PRESETS.regular.blur);
  assert.equal(resolveGlassConfig({ material: 'regular', blur: 2 }).blur, 2);
  assert.equal(resolveGlassConfig({ material: 'regular', blur: undefined }).blur, MATERIAL_PRESETS.regular.blur);
  assert.equal(resolveGlassConfig({}).blur, DEFAULT_CONFIG.blur);
  const c = resolveGlassConfig({ blur: NaN, ior: 0, thickness: -8, borderRadius: Infinity });
  assert.equal(c.blur, DEFAULT_CONFIG.blur); assert.equal(c.ior, 1);
  assert.equal(c.thickness, .1); assert.equal(c.borderRadius, DEFAULT_CONFIG.borderRadius);
  assert.equal(resolveGlassConfig({ dynamicLighting: true, cursorTracking: false }).cursorTracking, false);
});
