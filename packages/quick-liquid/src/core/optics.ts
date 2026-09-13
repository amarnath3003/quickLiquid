/** Pure, DOM-free optics used by the production renderer and regression tests. */
export const PROFILE_SAMPLES = 512;
const profiles = new Map<string, Float32Array>();

/** Normalized vector-Snell displacement for a convex circular bezel.
 * Only T/B and IOR affect the normalized profile, not the raster resolution.
 */
export function refractionProfile(thickness: number, bezel: number, ior: number): Float32Array {
  const ratio = thickness / Math.max(bezel, 0.001);
  const key = `${ratio}|${ior}`;
  const hit = profiles.get(key);
  if (hit) {
    profiles.delete(key);
    profiles.set(key, hit);
    return hit;
  }
  const lut = new Float32Array(PROFILE_SAMPLES + 1);
  // Avoid normalizing floating-point cancellation noise into a false lens.
  if (ior <= 1 || thickness <= 0) return lut;
  const eta = 1 / Math.max(1, ior);
  let peak = 0;
  for (let i = 1; i < PROFILE_SAMPLES; i++) {
    const s = i / PROFILE_SAMPLES;
    const root = Math.sqrt(s * (2 - s));
    const slope = ratio * (1 - s) / root;
    const cosI = 1 / Math.sqrt(1 + slope * slope);
    const sinI = slope * cosI;
    const k = eta * cosI - Math.sqrt(Math.max(0, 1 - eta * eta * sinI * sinI));
    const displacement = root * Math.abs(k * sinI / (-eta + k * cosI));
    lut[i] = displacement;
    peak = Math.max(peak, displacement);
  }
  if (peak > 0) for (let i = 1; i < PROFILE_SAMPLES; i++) lut[i] /= peak;
  if (profiles.size >= 32) profiles.delete(profiles.keys().next().value!);
  profiles.set(key, lut);
  return lut;
}

export interface MapGeometry {
  width: number; height: number; radius: number;
  bezel: number; thickness: number; ior: number;
  /** Content resolution; the neutral guard band is additional. */
  mapWidth: number; mapHeight: number; padding: number;
}

export function rasterizeLens(g: MapGeometry) {
  const { width: w, height: h, mapWidth: mw, mapHeight: mh } = g;
  const sx = mw / w, sy = mh / h;
  const padX = Math.ceil(g.padding * sx), padY = Math.ceil(g.padding * sy);
  const bw = mw + 2 * padX, bh = mh + 2 * padY;
  const data = new Uint8ClampedArray(bw * bh * 4);
  // One word per pixel; detect byte order rather than assuming a platform.
  // SVG recenters R/G with (x*255-1)/254.
  const littleEndian = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
  new Uint32Array(data.buffer).fill(littleEndian ? 0xff008080 : 0x808000ff);
  const radius = Math.min(g.radius, w / 2, h / 2);
  const bezel = Math.min(g.bezel, w / 2, h / 2);
  const profile = refractionProfile(g.thickness, bezel, g.ior);
  const band = Math.max(radius, bezel) + 1 / Math.min(sx, sy);
  const qw = Math.ceil(mw / 2), qh = Math.ceil(mh / 2);
  let pixelsComputed = 0;
  const put = (x: number, y: number, dx: number, dy: number) => {
    const i = ((y + padY) * bw + x + padX) * 4;
    data[i] = 128 + dx; data[i + 1] = 128 + dy;
  };
  for (let y = 0; y < qh; y++) {
    const ey = (y + 0.5) / sy;
    const limit = ey <= bezel ? qw : Math.min(qw, Math.ceil((ey <= band ? band : bezel + 1 / sx) * sx));
    for (let x = 0; x < limit; x++) {
      const ex = (x + 0.5) / sx;
      const qx = radius - ex, qy = radius - ey;
      let distance: number, nx: number, ny: number;
      if (qx > 0 && qy > 0) {
        const length = Math.hypot(qx, qy);
        distance = radius - length;
        nx = qx / length; ny = qy / length;
      } else if (qx > qy) {
        distance = ex; nx = 1; ny = 0;
      } else {
        distance = ey; nx = 0; ny = 1;
      }
      if (distance <= 0 || distance >= bezel) continue;
      pixelsComputed++;
      const f = distance / bezel * PROFILE_SAMPLES;
      const i = Math.min(PROFILE_SAMPLES - 1, Math.floor(f));
      const displacement = profile[i] + (profile[i + 1] - profile[i]) * (f - i);
      // Quantize once then negate: mirror symmetry is exact, including odd sizes.
      const dx = x === mw - 1 - x ? 0 : Math.round(nx * displacement * 127);
      const dy = y === mh - 1 - y ? 0 : Math.round(ny * displacement * 127);
      put(x, y, dx, dy);
      put(mw - 1 - x, y, -dx, dy);
      put(x, mh - 1 - y, dx, -dy);
      put(mw - 1 - x, mh - 1 - y, -dx, -dy);
    }
  }
  return { data, width: bw, height: bh, padX, padY, mapWidth: mw, mapHeight: mh, pixelsComputed };
}

/** Conservative heuristic: keep exact RGB when fringes can survive frost.
 * No approximation/extrapolation of color channels on the high quality path.
 */
export function usesDispersion(strength: number, chroma: number, blur: number, quality: string, mode = 'auto'): boolean {
  if (chroma <= 0.01 || quality === 'low') return false;
  return mode === 'exact' || 0.24 * chroma * strength >= 0.2 * blur;
}

export function filterPadding(blur: number): number {
  return Math.ceil((2.5 * blur + 2) / 8) * 8;
}
