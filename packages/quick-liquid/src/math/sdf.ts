/**
 * quick-liquid/math/sdf.ts
 * 
 * Signed Distance Field computations for liquid glass boundaries.
 * 
 * OPTIMIZATION INSIGHT:
 * Instead of computing per-pixel normals for refraction, we use SDFs.
 * An SDF gives us the distance from any point to the nearest edge,
 * and its gradient gives us the surface normal - both in O(1) per pixel
 * using closed-form solutions for common shapes (rounded rect, circle, pill).
 * 
 * This replaces expensive per-pixel gradient estimation (Sobel/Scharr kernels)
 * with a single arithmetic expression.
 */

/**
 * SDF for a rounded rectangle.
 * Returns negative values inside, positive outside, zero at boundary.
 * 
 * Math: For a rect centered at origin with half-extents (w,h) and radius r:
 *   d = length(max(|p| - (half_size - r), 0)) - r
 * 
 * This is the foundation of the liquid glass shape - it defines
 * where refraction intensity peaks (at edges where d ≈ 0).
 */
export function sdfRoundedRect(
  px: number, py: number,
  cx: number, cy: number,
  halfW: number, halfH: number,
  radius: number
): number {
  // Translate to local coordinates
  const dx = Math.abs(px - cx) - (halfW - radius);
  const dy = Math.abs(py - cy) - (halfH - radius);
  
  // Outside corner: Euclidean distance
  // Inside: Chebyshev-like distance
  const outsideDist = Math.sqrt(
    Math.max(dx, 0) * Math.max(dx, 0) + 
    Math.max(dy, 0) * Math.max(dy, 0)
  );
  const insideDist = Math.min(Math.max(dx, dy), 0);
  
  return outsideDist + insideDist - radius;
}

/**
 * SDF for a circle (special case, fastest computation).
 */
export function sdfCircle(
  px: number, py: number,
  cx: number, cy: number,
  radius: number
): number {
  const dx = px - cx;
  const dy = py - cy;
  return Math.sqrt(dx * dx + dy * dy) - radius;
}

/**
 * SDF for a pill/capsule shape (used for buttons/chips).
 */
export function sdfPill(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
  radius: number
): number {
  // Project point onto line segment AB
  const pax = px - ax;
  const pay = py - ay;
  const bax = bx - ax;
  const bay = by - ay;
  
  const t = Math.max(0, Math.min(1, 
    (pax * bax + pay * bay) / (bax * bax + bay * bay)
  ));
  
  const closestX = ax + t * bax;
  const closestY = ay + t * bay;
  
  const dx = px - closestX;
  const dy = py - closestY;
  
  return Math.sqrt(dx * dx + dy * dy) - radius;
}

/**
 * Compute the gradient (normal) of an SDF at a point.
 * Uses central differences with a small epsilon.
 * 
 * OPTIMIZATION: For rounded rects, we could derive the analytical gradient,
 * but central differences with eps=0.5px is sufficient and more flexible
 * (works for any SDF composition/blending).
 * 
 * Returns normalized [nx, ny] pointing away from the surface.
 */
export function sdfGradient(
  sdfFn: (x: number, y: number) => number,
  px: number, py: number,
  eps: number = 0.5
): [number, number] {
  const gx = sdfFn(px + eps, py) - sdfFn(px - eps, py);
  const gy = sdfFn(px, py + eps) - sdfFn(px, py - eps);
  
  const len = Math.sqrt(gx * gx + gy * gy);
  if (len < 1e-8) return [0, 0];
  
  return [gx / len, gy / len];
}

/**
 * Smooth minimum for blending multiple SDF shapes.
 * Creates organic "liquid" transitions between shapes.
 * 
 * k controls the blend radius. Larger k = smoother blend.
 * 
 * Math: smin(a, b, k) = -ln(e^(-k*a) + e^(-k*b)) / k
 * Approximation (polynomial, cheaper): 
 *   h = max(k - |a-b|, 0) / k
 *   return min(a,b) - h^3 * k / 6
 */
export function smoothMin(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * h * k * (1 / 6);
}

/**
 * Map SDF distance to refraction intensity.
 * 
 * PHYSICS APPROXIMATION:
 * Real glass refraction follows Snell's law: n1*sin(θ1) = n2*sin(θ2)
 * For a curved surface, θ depends on the surface normal angle.
 * Near edges (d ≈ 0), the surface curves sharply -> maximum refraction.
 * Deep inside (d << 0), the surface is flat -> minimal refraction.
 * 
 * We approximate this with a smooth falloff function:
 *   intensity = smoothstep(-thickness, 0, d) * (1 - smoothstep(0, feather, d))
 * 
 * This gives a band of maximum refraction at the edge that falls off
 * both inward and outward - matching the optical behavior of curved glass.
 */
export function sdfToRefractionIntensity(
  distance: number,
  thickness: number = 20,
  feather: number = 3
): number {
  // Inner falloff: from center to edge
  const inner = smoothstep(-thickness, 0, distance);
  // Outer falloff: from edge to outside  
  const outer = 1 - smoothstep(0, feather, distance);
  
  return inner * outer;
}

/**
 * Attempt to estimate curvature from SDF.
 * Curvature = divergence of the unit normal = laplacian(sdf) for |grad(sdf)|=1
 * 
 * Higher curvature = more refraction (light bends more at sharper curves).
 */
export function sdfCurvature(
  sdfFn: (x: number, y: number) => number,
  px: number, py: number,
  eps: number = 1.0
): number {
  const c = sdfFn(px, py);
  const laplacian = (
    sdfFn(px + eps, py) + sdfFn(px - eps, py) +
    sdfFn(px, py + eps) + sdfFn(px, py - eps) - 4 * c
  ) / (eps * eps);
  
  return laplacian;
}

/** GLSL-style smoothstep */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
