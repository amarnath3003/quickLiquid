/**
 * quick-liquid/math/blur.ts
 * 
 * Optimized blur computations for liquid glass.
 * 
 * KEY OPTIMIZATION - Cascaded Box Blur ≈ Gaussian Blur:
 * =====================================================
 * The Central Limit Theorem tells us that convolving a uniform distribution
 * (box filter) with itself multiple times converges to a Gaussian.
 * 
 * 3 passes of box blur with radius r gives us a very good approximation
 * of Gaussian blur with σ ≈ r * √(3/N) where N = number of passes.
 * 
 * Why this matters:
 * - Gaussian kernel: O(r²) per pixel (2D) or O(2r) separable
 * - Box blur: O(1) per pixel using sliding window (running sum)
 * - 3x box blur: O(3) per pixel = constant time regardless of radius!
 * 
 * For CSS/SVG, we rely on the browser's native feGaussianBlur (already optimized),
 * but for Canvas-based fallbacks, this is critical.
 * 
 * ADDITIONAL OPTIMIZATION - Downsampled Blur:
 * ============================================
 * Blur is a low-frequency operation. We can:
 * 1. Downsample the image 2x-4x
 * 2. Apply blur at reduced resolution
 * 3. Upsample (the upsampling itself adds blur!)
 * 
 * This gives us a 4x-16x speedup with imperceptible quality loss.
 */

/**
 * Compute optimal box blur radii for N passes to approximate Gaussian σ.
 * 
 * From the W3C spec for feGaussianBlur, the ideal box radius for
 * approximating a Gaussian with standard deviation σ using 3 passes:
 * 
 *   w_ideal = sqrt(12σ²/3 + 1)
 * 
 * We alternate between floor and ceil of w_ideal to handle
 * even/odd kernel sizes correctly.
 * 
 * Reference: "Fastest Gaussian Blur (in linear time)" - Ivan Googol
 */
export function boxBlurRadiiForGaussian(sigma: number, passes: number = 3): number[] {
  const wIdeal = Math.sqrt((12 * sigma * sigma / passes) + 1);
  let wl = Math.floor(wIdeal);
  if (wl % 2 === 0) wl--;
  const wu = wl + 2;
  
  const mIdeal = (12 * sigma * sigma - passes * wl * wl - 4 * passes * wl - 3 * passes) /
                 (-4 * wl - 4);
  const m = Math.round(mIdeal);
  
  const radii: number[] = [];
  for (let i = 0; i < passes; i++) {
    radii.push(i < m ? wl : wu);
  }
  return radii;
}

/**
 * Single-pass horizontal box blur using running sum.
 * O(1) per pixel regardless of blur radius.
 * 
 * The running sum trick:
 *   sum[x] = sum[x-1] + pixel[x+r] - pixel[x-r-1]
 *   result[x] = sum[x] / (2r + 1)
 */
export function boxBlurH(
  src: Uint8ClampedArray,
  dst: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number
): void {
  const kernelSize = radius + radius + 1;
  const invKernel = 1 / kernelSize;
  
  for (let y = 0; y < height; y++) {
    const rowOffset = y * width * 4;
    
    for (let ch = 0; ch < 4; ch++) {
      // Initialize running sum for the first pixel
      let sum = 0;
      for (let i = -radius; i <= radius; i++) {
        const xi = Math.min(Math.max(i, 0), width - 1);
        sum += src[rowOffset + xi * 4 + ch];
      }
      dst[rowOffset + ch] = (sum * invKernel + 0.5) | 0;
      
      // Slide the window across the row
      for (let x = 1; x < width; x++) {
        const addIdx = Math.min(x + radius, width - 1);
        const subIdx = Math.max(x - radius - 1, 0);
        sum += src[rowOffset + addIdx * 4 + ch] - src[rowOffset + subIdx * 4 + ch];
        dst[rowOffset + x * 4 + ch] = (sum * invKernel + 0.5) | 0;
      }
    }
  }
}

/**
 * Single-pass vertical box blur using running sum.
 */
export function boxBlurV(
  src: Uint8ClampedArray,
  dst: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number
): void {
  const kernelSize = radius + radius + 1;
  const invKernel = 1 / kernelSize;
  
  for (let x = 0; x < width; x++) {
    for (let ch = 0; ch < 4; ch++) {
      let sum = 0;
      for (let i = -radius; i <= radius; i++) {
        const yi = Math.min(Math.max(i, 0), height - 1);
        sum += src[(yi * width + x) * 4 + ch];
      }
      dst[x * 4 + ch] = (sum * invKernel + 0.5) | 0;
      
      for (let y = 1; y < height; y++) {
        const addIdx = Math.min(y + radius, height - 1);
        const subIdx = Math.max(y - radius - 1, 0);
        sum += src[(addIdx * width + x) * 4 + ch] - src[(subIdx * width + x) * 4 + ch];
        dst[(y * width + x) * 4 + ch] = (sum * invKernel + 0.5) | 0;
      }
    }
  }
}

/**
 * Complete Gaussian-approximate blur using 3 box blur passes.
 * Total complexity: O(6 * width * height) = O(n) linear in pixel count.
 * Compared to true Gaussian O(n * r²) or separable O(n * 2r).
 */
export function fastGaussianBlur(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  sigma: number
): Uint8ClampedArray {
  const radii = boxBlurRadiiForGaussian(sigma);
  const buf1 = new Uint8ClampedArray(data);
  const buf2 = new Uint8ClampedArray(data.length);
  
  for (const r of radii) {
    const halfR = (r - 1) / 2;
    boxBlurH(buf1, buf2, width, height, halfR);
    boxBlurV(buf2, buf1, width, height, halfR);
  }
  
  return buf1;
}

/**
 * Compute the optimal downsample factor for a given blur radius.
 * 
 * Rule of thumb: we can downsample by factor k if blur radius > k*2.
 * The Nyquist theorem tells us we won't lose visible detail because
 * blur already removes high-frequency content.
 */
export function optimalDownsampleFactor(sigma: number): number {
  if (sigma < 4) return 1;
  if (sigma < 8) return 2;
  if (sigma < 16) return 4;
  return 8;
}

/**
 * Convert a CSS blur radius to Gaussian sigma.
 * CSS blur() uses radius = 2σ (per the spec).
 */
export function cssBlurToSigma(cssRadius: number): number {
  return cssRadius / 2;
}

/**
 * Convert Gaussian sigma to CSS blur radius.
 */
export function sigmaToCssBlur(sigma: number): number {
  return sigma * 2;
}
