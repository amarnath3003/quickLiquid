const test = require('node:test');
const assert = require('node:assert/strict');
const { build } = require('esbuild');
const path = require('node:path');

async function moduleAt(relPath) {
  const result = await build({
    entryPoints: [path.join(__dirname, '../src', relPath)],
    bundle: true,
    platform: 'node',
    format: 'esm',
    write: false,
  });
  return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
}

const interactiveMod = moduleAt('animations/interactive.ts');
const springMod = moduleAt('animations/spring.ts');

test('computeFlowRect computes center-aligned deltas and bounded scales', async () => {
  const { computeFlowRect } = await interactiveMod;
  const from = { left: 100, top: 20, width: 40, height: 40 };
  const to = { left: 200, top: 100, width: 400, height: 200 };
  const flow = computeFlowRect(from, to);

  // from center = (120, 40), to center = (400, 200) -> dx = -280, dy = -160
  assert.equal(flow.dx, -280);
  assert.equal(flow.dy, -160);
  assert.ok(Math.abs(flow.scaleX - 0.1) < 1e-9);
  assert.ok(Math.abs(flow.scaleY - 0.2) < 1e-9);

  // Clamps tiny triggers safely to >= 0.08
  const clamped = computeFlowRect(
    { left: 0, top: 0, width: 0, height: 0 },
    { left: 0, top: 0, width: 500, height: 500 },
  );
  assert.equal(clamped.scaleX, 0.08);
  assert.equal(clamped.scaleY, 0.08);
});

test('computeSwitchStretch returns identity at zero velocity and bounded area-conserving stretch', async () => {
  const { computeSwitchStretch } = await interactiveMod;

  const rest = computeSwitchStretch(0);
  assert.equal(rest.scaleX, 1);
  assert.equal(rest.scaleY, 1);

  const moving = computeSwitchStretch(250, 0.24);
  assert.ok(moving.scaleX > 1 && moving.scaleX <= 1.24);
  assert.ok(moving.scaleY < 1 && moving.scaleY > 0.85);
  assert.ok(Math.abs(moving.scaleX * moving.scaleY * moving.scaleY - 1) < 1e-9);

  const saturated = computeSwitchStretch(-5000, 0.22);
  assert.equal(saturated.scaleX, 1.22);
  assert.ok(Math.abs(saturated.scaleY - 1 / Math.sqrt(1.22)) < 1e-9);
});

test('computeBoundedJellyBox keeps pill inside container walls and squishes elastically on impact', async () => {
  const { computeBoundedJellyBox } = await interactiveMod;

  // Right-wall overshoot pins right edge to maxX, compresses scaleX < 1, and bulges scaleY > 1
  const hitRight = computeBoundedJellyBox({
    rawX: 204,
    rawY: 3,
    width: 80,
    height: 30,
    scaleX: 1,
    scaleY: 1,
    vx: 420,
    minX: 3,
    maxX: 270,
    minY: 1,
    maxY: 35,
  });
  assert.equal(hitRight.hitWallX, 1);
  assert.ok(Math.abs(hitRight.visualRight - 270) < 1e-9);
  assert.ok(hitRight.visualLeft >= 3);
  assert.ok(hitRight.scaleX < 1);
  assert.ok(hitRight.scaleY > 1);

  // Left-wall overshoot pins left edge to minX, compresses scaleX < 1, and bulges scaleY > 1
  const hitLeft = computeBoundedJellyBox({
    rawX: -18,
    rawY: 3,
    width: 80,
    height: 30,
    scaleX: 1,
    scaleY: 1,
    vx: -500,
    minX: 3,
    maxX: 270,
    minY: 1,
    maxY: 35,
  });
  assert.equal(hitLeft.hitWallX, -1);
  assert.ok(Math.abs(hitLeft.visualLeft - 3) < 1e-9);
  assert.ok(hitLeft.scaleX < 1);
  assert.ok(hitLeft.scaleY > 1);

  // Top and bottom wall overshoots pin vertically, compress scaleY < 1, and bulge scaleX > 1
  const hitBottom = computeBoundedJellyBox({
    rawX: 10,
    rawY: 196,
    width: 140,
    height: 36,
    scaleX: 1,
    scaleY: 1,
    vy: 380,
    minX: 1,
    maxX: 200,
    minY: 4,
    maxY: 220,
  });
  assert.equal(hitBottom.hitWallY, 1);
  assert.ok(Math.abs(hitBottom.visualBottom - 220) < 1e-9);
  assert.ok(hitBottom.scaleY < 1);
  assert.ok(hitBottom.scaleX > 1);

  // High mid-box velocity stretches along travel while respecting walls
  const midTravel = computeBoundedJellyBox({
    rawX: 90,
    rawY: 3,
    width: 80,
    height: 30,
    scaleX: 1,
    scaleY: 1,
    vx: 600,
    minX: 3,
    maxX: 270,
    minY: 1,
    maxY: 35,
  });
  assert.equal(midTravel.hitWallX, 0);
  assert.ok(midTravel.scaleX > 1);
  assert.ok(midTravel.visualLeft >= 3 && midTravel.visualRight <= 270);
  assert.ok(midTravel.visualTop >= 1 && midTravel.visualBottom <= 35);
});

test('Spring converges to target across every SPRING_PRESETS preset and fast interaction spring', async () => {
  const { Spring, SPRING_PRESETS } = await springMod;
  for (const name of Object.keys(SPRING_PRESETS)) {
    const s = new Spring(0, name);
    s.setTarget(100);
    let now = 0;
    let steps = 0;
    let active = true;
    while (active && steps < 600) {
      active = s.tick(now);
      now += 1000 / 60;
      steps++;
    }
    assert.equal(active, false, `Spring preset '${name}' should settle within 600 frames`);
    assert.ok(Math.abs(s.value - 100) < 0.05, `Spring preset '${name}' settled at ${s.value}`);
  }

  // Verify fast tab / modal spring settles cleanly in under 20 frames (~330ms)
  const fastTab = new Spring(0, { stiffness: 860, damping: 34, mass: 0.68, restDisplacementThreshold: 0.5, restThreshold: 12 });
  fastTab.setTarget(200);
  let t = 0;
  let frames = 0;
  while (fastTab.tick(t) && frames < 60) {
    t += 1000 / 60;
    frames++;
  }
  assert.ok(frames <= 20, `Fast tab spring took ${frames} frames`);
  assert.equal(fastTab.value, 200);
});

test('computeLiquidDropTransform computes initial drop, mid-flight ripple, and exact rest identity', async () => {
  const { computeLiquidDropTransform } = await interactiveMod;

  // Initial state at progress = 0, velocity = 0
  const init = computeLiquidDropTransform(0, 0);
  assert.equal(init.y, -12);
  assert.equal(init.scaleX, 0.975);
  assert.equal(init.scaleY, 0.91);

  // Mid-drop with downward velocity induces bounded lateral surface-tension ripple and area-conserving vertical squish
  const mid = computeLiquidDropTransform(0.5, 22);
  const baseMidX = 0.975 + (1 - 0.975) * 0.5;
  const baseMidY = 0.91 + (1 - 0.91) * 0.5;
  assert.ok(mid.scaleX > 1, `Expected scaleX > 1 during downward drop, got ${mid.scaleX}`);
  assert.ok(mid.scaleX > baseMidX);
  assert.ok(mid.scaleY < baseMidY, `Expected scaleY < baseMidY under lateral stretch, got ${mid.scaleY}`);

  // Exact rest identity at progress = 1, velocity = 0
  const rest = computeLiquidDropTransform(1, 0);
  assert.equal(rest.y, 0);
  assert.equal(rest.scaleX, 1);
  assert.equal(rest.scaleY, 1);
});

test('LiquidMorphModal default drop open and close springs meet instant speed and bounce envelopes', async () => {
  const { Spring } = await springMod;

  // Open spring: reaches >= 0.85 within <= 4 frames (~66.7ms), subtle bounce in (1.02, 1.15), settles in <= 16 frames
  const dropOpen = new Spring(0, {
    stiffness: 1100,
    damping: 32,
    mass: 0.55,
    restDisplacementThreshold: 0.003,
    restThreshold: 0.04,
  });
  dropOpen.setTarget(1);
  dropOpen.tick(0); // Initialize t0 = 0 (frame 0)
  let t = 1000 / 60;
  let openFrames = 0;
  let maxVal = 0;
  let valFrame4 = 0;
  while (dropOpen.tick(t) && openFrames < 60) {
    openFrames++;
    if (dropOpen.value > maxVal) maxVal = dropOpen.value;
    if (openFrames === 4) valFrame4 = dropOpen.value;
    t += 1000 / 60;
  }
  assert.ok(valFrame4 >= 0.85, `Expected drop open >= 0.85 by frame 4 (~66.7ms), got ${valFrame4}`);
  assert.ok(maxVal > 1.02 && maxVal < 1.15, `Expected bounded bounce in (1.02, 1.15), got ${maxVal}`);
  assert.ok(openFrames <= 16, `Drop open took ${openFrames} frames (expected <= 16)`);
  assert.equal(dropOpen.value, 1);

  // Close spring: critically damped (never bounces < -0.01) and settles in <= 8 frames
  const dropClose = new Spring(1, {
    stiffness: 2000,
    damping: 63.25,
    mass: 0.5,
    restDisplacementThreshold: 0.025,
    restThreshold: 0.85,
  });
  dropClose.setTarget(0);
  dropClose.tick(0); // Initialize t0 = 0 (frame 0)
  t = 1000 / 60;
  let closeFrames = 0;
  let minVal = 1;
  while (dropClose.tick(t) && closeFrames < 60) {
    closeFrames++;
    if (dropClose.value < minVal) minVal = dropClose.value;
    t += 1000 / 60;
  }
  assert.ok(minVal >= -0.01, `Close spring overshot negatively to ${minVal}`);
  assert.ok(closeFrames <= 8, `Drop close took ${closeFrames} frames (expected <= 8)`);
  assert.equal(dropClose.value, 0);
});
