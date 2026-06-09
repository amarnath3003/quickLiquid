/**
 * quick-liquid/math/refraction.ts
 * 
 * Optimized refraction computation for liquid glass effect.
 * 
 * CORE INSIGHT - Why this is fast:
 * ================================
 * Traditional approach: Per-frame, per-pixel ray tracing through glass material.
 * Our approach: Pre-computed displacement map via analytical Snell's Law on SDF.
 * 
 * The displacement at each pixel is computed ONCE and stored as an SVG
 * feDisplacementMap, which the GPU applies in hardware every frame.
 * We only recompute when the element resizes (not every frame).
 * 
 * PHYSICS MODEL:
 * ==============
 * Snell's Law: n1 * sin(θi) = n2 * sin(θr)
 * For small angles (paraxial approximation): displacement ≈ t * (1 - n1/n2) * tan(θ)
 * 
 * Where:
 *   - t = glass thickness (virtual)
 *   - n1/n2 = refractive index ratio (1.0 / 1.5 for glass)
 *   - θ = angle of the surface normal (from SDF gradient)
 * 
 * For a curved glass surface, the displacement is proportional to the
 * surface normal direction scaled by the refraction intensity from the SDF.
 */

import { sdfRoundedRect, sdfGradient, sdfToRefractionIntensity, sdfCurvature } from './sdf';

export interface RefractionConfig {
  /** Index of refraction for the glass material. Default 1.5 (crown glass) */
  ior: number;
  /** Virtual glass thickness in pixels. Controls displacement magnitude. */
  thickness: number;
  /** Chromatic aberration strength (0 = none, 1 = strong) */
  chromaticAberration: number;
  /** Edge feather in pixels */
  feather: number;
}

export const DEFAULT_REFRACTION: RefractionConfig = {
  ior: 1.5,
  thickness: 12,
  chromaticAberration: 0.3,
  feather: 3,
};

/**
 * Generate a displacement map for a rounded rectangle glass element.
 * 
 * Returns a Float32Array of [dx, dy] pairs representing the UV offset
 * at each pixel. This gets encoded into an SVG displacement map.
 * 
 * OPTIMIZATION: We only compute for a 1/4 quadrant and mirror (symmetry).
 * This gives us 4x speedup on the pre-computation step.
 * 
 * @param width - Element width in pixels
 * @param height - Element height in pixels  
 * @param borderRadius - Corner radius in pixels
 * @param config - Refraction parameters
 * @returns Uint8Array in RGBA format (R=dx, G=dy encoded as 0-255 where 128=zero)
 */
export function generateDisplacementMap(
  width: number,
  height: number,
  borderRadius: number,
  config: RefractionConfig = DEFAULT_REFRACTION
): Uint8Array {
  const w = Math.ceil(width);
  const h = Math.ceil(height);
  const data = new Uint8Array(w * h * 4);
  
  const cx = w / 2;
  const cy = h / 2;
  const halfW = w / 2;
  const halfH = h / 2;
  const radius = Math.min(borderRadius, halfW, halfH);
  
  // Refraction strength from Snell's law (paraxial)
  // displacement = thickness * (1 - 1/ior) * normal_component
  const refractionStrength = config.thickness * (1 - 1 / config.ior);
  
  // Create bound SDF function for this shape
  const sdf = (x: number, y: number) => 
    sdfRoundedRect(x, y, cx, cy, halfW, halfH, radius);
  
  // We exploit X and Y symmetry: compute one quadrant, mirror the rest
  const halfWidth = Math.ceil(w / 2);
  const halfHeight = Math.ceil(h / 2);
  
  for (let qy = 0; qy <= halfHeight; qy++) {
    for (let qx = 0; qx <= halfWidth; qx++) {
      // Compute in the top-left quadrant (offset by 0.5 for pixel centers)
      const px = qx + 0.5;
      const py = qy + 0.5;
      
      const dist = sdf(px, py);
      
      // Skip pixels clearly outside the glass
      if (dist > config.feather + 2) {
        // Write neutral displacement (128, 128) = no offset
        setQuadrantPixels(data, w, h, qx, qy, 128, 128, 0);
        continue;
      }
      
      // Compute refraction intensity (peaks at edges, zero at center/outside)
      const intensity = sdfToRefractionIntensity(dist, config.thickness, config.feather);
      
      if (intensity < 0.001) {
        setQuadrantPixels(data, w, h, qx, qy, 128, 128, 0);
        continue;
      }
      
      // Get surface normal direction from SDF gradient
      const [nx, ny] = sdfGradient(sdf, px, py);
      
      // Add curvature-based enhancement (sharper curves = more displacement)
      const curvature = Math.abs(sdfCurvature(sdf, px, py));
      const curvatureFactor = 1 + Math.min(curvature * 2, 1.5);
      
      // Final displacement: normal direction * refraction strength * intensity * curvature
      const dx = nx * refractionStrength * intensity * curvatureFactor;
      const dy = ny * refractionStrength * intensity * curvatureFactor;
      
      // Encode as 0-255 (128 = no displacement, 0 = max negative, 255 = max positive)
      // Clamp to [-127, 127] pixel range
      const encodedDx = Math.round(128 + clamp(dx, -127, 127));
      const encodedDy = Math.round(128 + clamp(dy, -127, 127));
      
      // Alpha encodes the aberration mask (where chromatic split happens)
      const aberrationMask = Math.round(intensity * 255 * config.chromaticAberration);
      
      setQuadrantPixels(data, w, h, qx, qy, encodedDx, encodedDy, aberrationMask);
    }
  }
  
  return data;
}

/**
 * Set pixels in all 4 quadrants (exploiting symmetry).
 * For displacement, we negate the direction for mirrored quadrants.
 */
function setQuadrantPixels(
  data: Uint8Array, w: number, h: number,
  qx: number, qy: number,
  dx: number, dy: number, alpha: number
): void {
  const mirrorDx = 256 - dx; // Flip X displacement
  const mirrorDy = 256 - dy; // Flip Y displacement
  
  // Top-left
  setPixel(data, w, qx, qy, dx, dy, alpha);
  // Top-right (mirror X)
  if (w - 1 - qx !== qx) {
    setPixel(data, w, w - 1 - qx, qy, mirrorDx, dy, alpha);
  }
  // Bottom-left (mirror Y)
  if (h - 1 - qy !== qy) {
    setPixel(data, w, qx, h - 1 - qy, dx, mirrorDy, alpha);
  }
  // Bottom-right (mirror XY)
  if (w - 1 - qx !== qx && h - 1 - qy !== qy) {
    setPixel(data, w, w - 1 - qx, h - 1 - qy, mirrorDx, mirrorDy, alpha);
  }
}

function setPixel(
  data: Uint8Array, w: number,
  x: number, y: number,
  r: number, g: number, a: number
): void {
  const idx = (y * w + x) * 4;
  data[idx] = clamp(r, 0, 255);     // R = X displacement
  data[idx + 1] = clamp(g, 0, 255); // G = Y displacement  
  data[idx + 2] = 128;              // B = reserved (specular map)
  data[idx + 3] = a;                // A = chromatic aberration mask
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/**
 * Generate a lightweight displacement map using purely analytical approach.
 * 
 * FAST PATH: For when we don't need per-pixel precision.
 * Instead of computing SDF per pixel, we generate an SVG filter chain
 * that approximates the displacement using built-in SVG primitives.
 * 
 * This is O(1) computation - we just output the SVG filter definition
 * and let the GPU do all the work.
 */
export function generateAnalyticalSVGFilter(
  id: string,
  width: number,
  height: number,
  borderRadius: number,
  config: RefractionConfig = DEFAULT_REFRACTION
): string {
  const scale = config.thickness * (1 - 1 / config.ior) * 2;
  const blurRadius = Math.max(1, config.thickness * 0.3);
  
  // The key insight: feGaussianBlur on a shape creates a natural
  // gradient that mimics the SDF-based normal field.
  // Then feDisplacementMap uses this blurred shape as displacement source.
  return `
<filter id="${id}" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
  <!-- Create the glass shape mask -->
  <feFlood flood-color="rgb(128,128,128)" flood-opacity="1" result="neutral"/>
  
  <!-- Generate displacement from the element's own alpha channel.
       Blurring the alpha creates a gradient field at edges = SDF approximation -->
  <feGaussianBlur in="SourceAlpha" stdDeviation="${blurRadius}" result="blurredAlpha"/>
  
  <!-- Convert alpha gradient to displacement vectors.
       The blur naturally creates vectors pointing away from edges (= surface normals) -->
  <feDisplacementMap in="SourceGraphic" in2="blurredAlpha" 
    scale="${scale}" xChannelSelector="R" yChannelSelector="G" result="displaced"/>
  
  <!-- Backdrop blur for the glass material -->
  <feGaussianBlur in="BackgroundImage" stdDeviation="${Math.max(4, config.thickness * 0.5)}" result="bgBlur"/>
  
  <!-- Saturation boost on the blurred background -->
  <feColorMatrix in="bgBlur" type="saturate" values="1.7" result="saturated"/>
  
  <!-- Composite displaced content over blurred background -->
  <feBlend in="displaced" in2="saturated" mode="normal"/>
</filter>`;
}
