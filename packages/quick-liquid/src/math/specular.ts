/**
 * quick-liquid/math/specular.ts
 * 
 * Specular highlight and edge lighting computation.
 * 
 * PHYSICS MODEL:
 * ==============
 * Real glass has Fresnel reflections: reflectivity increases at glancing angles.
 * Schlick's approximation: R(θ) = R0 + (1 - R0) * (1 - cos(θ))^5
 * Where R0 = ((n1-n2)/(n1+n2))^2
 * 
 * For glass (n=1.5): R0 ≈ 0.04 (4% reflection at normal, ~100% at grazing)
 * 
 * OPTIMIZATION:
 * =============
 * Instead of computing Fresnel per pixel, we observe that:
 * 1. The viewing angle relative to the surface = angle of SDF normal
 * 2. At edges (grazing angle), SDF distance ≈ 0
 * 3. Therefore: Fresnel reflectivity ≈ f(sdf_distance)
 * 
 * This reduces the expensive per-pixel Fresnel computation to a simple
 * 1D lookup based on SDF distance - which we already have!
 */

export interface SpecularConfig {
  /** Light direction as [x, y, z] normalized vector */
  lightDir: [number, number, number];
  /** Specular power (shininess). Higher = tighter highlights */
  power: number;
  /** Fresnel R0 value. Default 0.04 for glass */
  fresnelR0: number;
  /** Edge glow intensity (0-1) */
  edgeGlow: number;
  /** Light color as [r, g, b] in 0-1 range */
  lightColor: [number, number, number];
}

export const DEFAULT_SPECULAR: SpecularConfig = {
  lightDir: [0.3, -0.5, 0.8], // Top-left light
  power: 64,
  fresnelR0: 0.04,
  edgeGlow: 0.6,
  lightColor: [1, 1, 1],
};

/**
 * Schlick's Fresnel approximation.
 * 
 * R(θ) = R0 + (1-R0)(1-cosθ)^5
 * 
 * Much cheaper than the full Fresnel equations while being visually identical.
 */
export function fresnelSchlick(cosTheta: number, r0: number): number {
  const oneMinusCos = 1 - Math.max(0, cosTheta);
  // (1-cos)^5 using multiplication (faster than Math.pow for small integers)
  const x2 = oneMinusCos * oneMinusCos;
  const x5 = x2 * x2 * oneMinusCos;
  return r0 + (1 - r0) * x5;
}

/**
 * Map SDF distance to Fresnel reflectivity.
 * 
 * INSIGHT: The viewing angle at a point on curved glass is related
 * to how far inside the glass we are (SDF value).
 * - At center (d << 0): we're looking straight through -> cos(θ) ≈ 1 -> low reflectivity
 * - At edges (d ≈ 0): glancing angle -> cos(θ) ≈ 0 -> high reflectivity
 * 
 * We map: cosTheta = smoothstep(0, -thickness, distance)
 */
export function sdfToFresnel(
  distance: number,
  thickness: number,
  r0: number = 0.04
): number {
  // Map distance to viewing angle cosine
  const t = Math.max(0, Math.min(1, -distance / thickness));
  const cosTheta = t; // 0 at edge, 1 at center
  
  return fresnelSchlick(cosTheta, r0);
}

/**
 * Compute specular highlight at a point given the SDF normal.
 * 
 * Uses Blinn-Phong model: spec = (N · H)^p
 * Where H = normalize(L + V), L = light dir, V = view dir (0,0,1 for screen)
 * 
 * For a 2D glass panel viewed straight-on:
 *   V = [0, 0, 1]
 *   N = [nx, ny, nz] where [nx,ny] from SDF gradient, nz from curvature
 *   H = normalize(L + V)
 */
export function specularHighlight(
  nx: number, ny: number,
  config: SpecularConfig = DEFAULT_SPECULAR
): number {
  // Reconstruct 3D normal: nx, ny from SDF, nz from hemisphere assumption
  // nz = sqrt(1 - nx² - ny²) for a unit normal on a hemisphere
  const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
  
  // View direction (screen-aligned)
  const vx = 0, vy = 0, vz = 1;
  
  // Half-vector H = normalize(L + V)
  const [lx, ly, lz] = config.lightDir;
  const hx = lx + vx;
  const hy = ly + vy;
  const hz = lz + vz;
  const hLen = Math.sqrt(hx * hx + hy * hy + hz * hz);
  const hnx = hx / hLen;
  const hny = hy / hLen;
  const hnz = hz / hLen;
  
  // N · H
  const ndotH = Math.max(0, nx * hnx + ny * hny + nz * hnz);
  
  // Specular power
  return Math.pow(ndotH, config.power);
}

/**
 * Generate the CSS/SVG encoding of the specular highlight layer.
 * 
 * OPTIMIZATION: Instead of computing specular per-pixel in JS,
 * we generate a radial gradient that approximates the highlight
 * and overlay it using CSS mix-blend-mode: screen.
 * 
 * This is GPU-composited and costs zero JS computation per frame.
 */
export function generateSpecularCSS(
  config: SpecularConfig = DEFAULT_SPECULAR,
  width: number = 100,
  height: number = 100
): string {
  // Light position maps to highlight center
  const [lx, ly] = config.lightDir;
  // Convert light direction to highlight position (reflected)
  const highlightX = 50 - lx * 40; // percentage
  const highlightY = 50 + ly * 40;
  
  const intensity = 0.3 + config.edgeGlow * 0.4;
  
  return `radial-gradient(
    ellipse at ${highlightX}% ${highlightY}%,
    rgba(255, 255, 255, ${intensity}) 0%,
    rgba(255, 255, 255, ${intensity * 0.3}) 30%,
    rgba(255, 255, 255, 0) 70%
  )`;
}

/**
 * Generate edge glow CSS.
 * 
 * Edge glow simulates Fresnel: brighter at edges where light refracts more.
 * We use an inset box-shadow with spread to create the edge highlight,
 * which is GPU-composited and free per frame.
 */
export function generateEdgeGlowCSS(
  config: SpecularConfig = DEFAULT_SPECULAR,
  borderRadius: number = 16
): string {
  const intensity = config.edgeGlow;
  const [lx, ly] = config.lightDir;
  
  // Offset the glow based on light direction
  const offsetX = -lx * 2;
  const offsetY = ly * 2;
  
  return [
    // Outer subtle glow
    `inset ${offsetX}px ${offsetY}px ${borderRadius * 0.5}px rgba(255, 255, 255, ${intensity * 0.4})`,
    // Inner bright edge
    `inset ${offsetX * 0.5}px ${offsetY * 0.5}px 1px rgba(255, 255, 255, ${intensity * 0.8})`,
    // Bottom ambient
    `inset 0px -1px 1px rgba(255, 255, 255, ${intensity * 0.2})`,
  ].join(', ');
}
