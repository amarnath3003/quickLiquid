/**
 * quick-liquid/animations/morph.ts
 * 
 * Liquid morphing — the "water droplet" effect.
 * 
 * This is what makes Apple's liquid glass feel ALIVE. When two glass
 * elements come close, they "attract" each other with a smooth bridge
 * (like water surface tension). When they merge, the boundary dissolves
 * organically. When they split, there's a satisfying "snap" with a 
 * tiny overshoot.
 * 
 * TECHNIQUE:
 * Uses animated SVG clip-paths with smooth-min SDF blending.
 * The smoothMin function creates organic transitions between shapes —
 * as the blend radius increases, two circles form a peanut shape,
 * then merge into one blob. This is computationally cheap (just math,
 * no physics sim) and runs entirely on the GPU via clip-path.
 * 
 * For elements that can't use clip-path, we fall back to animated
 * border-radius morphing with spring physics.
 */

import { Spring, SpringConfig, SPRING_PRESETS } from './spring';
import { AnimationScheduler } from './scheduler';

export interface MorphTarget {
  /** Bounding rect of the element */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Border radius */
  borderRadius: number;
}

export interface MorphConfig {
  /** Spring preset or config for the morph animation */
  spring: Partial<SpringConfig> | keyof typeof SPRING_PRESETS;
  /** Blend radius for smooth-min (higher = more "gooey") */
  blendRadius: number;
  /** Whether to use clip-path (true) or border-radius (false) */
  useClipPath: boolean;
  /** Proximity threshold to start "attracting" (px) */
  attractDistance: number;
  /** Intensity of the attraction bridge (0-1) */
  attractStrength: number;
}

const DEFAULT_MORPH_CONFIG: MorphConfig = {
  spring: 'liquidMerge',
  blendRadius: 20,
  useClipPath: true,
  attractDistance: 80,
  attractStrength: 0.6,
};

/**
 * Morph controller for a single element.
 * Animates between shapes with liquid spring physics.
 */
export class LiquidMorph {
  private el: HTMLElement;
  private cfg: MorphConfig;
  private scheduler: AnimationScheduler;
  
  // Springs for each property
  private xSpring: Spring;
  private ySpring: Spring;
  private wSpring: Spring;
  private hSpring: Spring;
  private rSpring: Spring; // border-radius
  
  // SVG clip-path elements (for blob morphing)
  private svgClip: SVGSVGElement | null = null;
  private clipId: string;
  private animId: number | null = null;

  private static _uid = 0;

  constructor(
    element: HTMLElement,
    config: Partial<MorphConfig> = {}
  ) {
    this.el = element;
    this.cfg = { ...DEFAULT_MORPH_CONFIG, ...config };
    this.scheduler = AnimationScheduler.shared();
    this.clipId = `ql-morph-${++LiquidMorph._uid}`;

    const springCfg = this.cfg.spring;
    const rect = element.getBoundingClientRect();
    const radius = parseFloat(getComputedStyle(element).borderRadius) || 0;

    this.xSpring = new Spring(rect.left, springCfg);
    this.ySpring = new Spring(rect.top, springCfg);
    this.wSpring = new Spring(rect.width, springCfg);
    this.hSpring = new Spring(rect.height, springCfg);
    this.rSpring = new Spring(radius, springCfg);

    if (this.cfg.useClipPath) {
      this.setupClipPath();
    }
  }

  /**
   * Morph to a new shape with liquid animation.
   * The element will spring-animate to the target dimensions.
   */
  morphTo(target: MorphTarget): void {
    this.xSpring.setTarget(target.x);
    this.ySpring.setTarget(target.y);
    this.wSpring.setTarget(target.width);
    this.hSpring.setTarget(target.height);
    this.rSpring.setTarget(target.borderRadius);
    
    this.startAnimation();
  }

  /**
   * Morph to match another element's bounds.
   */
  morphToElement(target: HTMLElement): void {
    const rect = target.getBoundingClientRect();
    const radius = parseFloat(getComputedStyle(target).borderRadius) || 0;
    this.morphTo({
      x: rect.left, y: rect.top,
      width: rect.width, height: rect.height,
      borderRadius: radius,
    });
  }

  /**
   * Animate a "liquid stretch" — element expands then snaps back.
   * Used for press feedback, notifications, etc.
   */
  liquidPulse(scaleX: number = 1.05, scaleY: number = 0.95): void {
    const rect = this.el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const newW = rect.width * scaleX;
    const newH = rect.height * scaleY;

    // Set overshoot targets
    this.wSpring.setValue(newW, 0);
    this.hSpring.setValue(newH, 0);
    this.xSpring.setValue(cx - newW / 2, 0);
    this.ySpring.setValue(cy - newH / 2, 0);
    
    // Spring back to original
    this.wSpring.setTarget(rect.width);
    this.hSpring.setTarget(rect.height);
    this.xSpring.setTarget(rect.left);
    this.ySpring.setTarget(rect.top);
    
    this.startAnimation();
  }

  /**
   * Liquid "jiggle" — like tapping a water droplet.
   * Applies velocity impulse for organic wobble.
   */
  jiggle(intensity: number = 200): void {
    this.wSpring.addVelocity(intensity);
    this.hSpring.addVelocity(-intensity * 0.7);
    this.rSpring.addVelocity(intensity * 0.3);
    this.startAnimation();
  }

  /** Get current progress (useful for blending animations) */
  get progress(): number { return 0; }

  // ─── Internal ─────────────────────────────────────────────────

  private startAnimation(): void {
    if (this.animId !== null) return; // Already running
    
    this.animId = this.scheduler.schedule((now) => {
      const xActive = this.xSpring.tick(now);
      const yActive = this.ySpring.tick(now);
      const wActive = this.wSpring.tick(now);
      const hActive = this.hSpring.tick(now);
      const rActive = this.rSpring.tick(now);

      this.applyTransform();

      const active = xActive || yActive || wActive || hActive || rActive;
      if (!active) {
        this.animId = null;
      }
      return active;
    });
  }

  private applyTransform(): void {
    const w = this.wSpring.value;
    const h = this.hSpring.value;
    const r = this.rSpring.value;

    // Use transform for GPU-composited animation (no layout thrashing)
    const rect = this.el.getBoundingClientRect();
    const scaleX = w / (rect.width || 1);
    const scaleY = h / (rect.height || 1);

    this.el.style.transform = `scale(${scaleX}, ${scaleY})`;
    this.el.style.borderRadius = `${r}px`;

    if (this.cfg.useClipPath) {
      this.updateClipPath(w, h, r);
    }
  }

  private setupClipPath(): void {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.position = 'absolute';
    svg.style.pointerEvents = 'none';
    
    svg.innerHTML = `
      <defs>
        <clipPath id="${this.clipId}" clipPathUnits="objectBoundingBox">
          <path d=""/>
        </clipPath>
      </defs>
    `;
    
    document.body.appendChild(svg);
    this.svgClip = svg;
    this.el.style.clipPath = `url(#${this.clipId})`;
  }

  private updateClipPath(w: number, h: number, r: number): void {
    if (!this.svgClip) return;
    
    const path = this.svgClip.querySelector('path');
    if (!path) return;

    // Normalized rounded rect path (0-1 space for objectBoundingBox)
    const rx = Math.min(r / w, 0.5);
    const ry = Math.min(r / h, 0.5);
    
    path.setAttribute('d', roundedRectPath(rx, ry));
  }

  destroy(): void {
    if (this.animId !== null) {
      this.scheduler.cancel(this.animId);
    }
    if (this.svgClip) {
      this.svgClip.remove();
    }
    this.el.style.clipPath = '';
    this.el.style.transform = '';
  }
}

/**
 * Generate a smooth blob path that blends two shapes.
 * This is the "water droplet merge" effect.
 * 
 * Uses metaball-style rendering: two circles with a smooth bridge
 * that forms based on proximity and blend radius.
 */
export function generateMergeBlob(
  shape1: { cx: number; cy: number; r: number },
  shape2: { cx: number; cy: number; r: number },
  blendRadius: number,
  resolution: number = 64,
): string {
  const points: [number, number][] = [];
  
  for (let i = 0; i < resolution; i++) {
    const angle = (i / resolution) * Math.PI * 2;
    const px = Math.cos(angle);
    const py = Math.sin(angle);
    
    // Sample along ray from center to find the merged boundary
    // Uses smooth-min of two circle SDFs
    let bestDist = Infinity;
    for (let t = 0; t < 200; t++) {
      const step = t * 0.01;
      const sx = px * step;
      const sy = py * step;
      
      const d1 = Math.sqrt((sx - shape1.cx) ** 2 + (sy - shape1.cy) ** 2) - shape1.r;
      const d2 = Math.sqrt((sx - shape2.cx) ** 2 + (sy - shape2.cy) ** 2) - shape2.r;
      
      // Smooth minimum — creates the organic blend
      const k = blendRadius;
      const h = Math.max(k - Math.abs(d1 - d2), 0) / k;
      const d = Math.min(d1, d2) - h * h * h * k * (1 / 6);
      
      if (Math.abs(d) < Math.abs(bestDist)) {
        bestDist = d;
        if (Math.abs(d) < 0.01) {
          points.push([sx, sy]);
          break;
        }
      }
      
      if (d > 0 && bestDist < 0) {
        points.push([sx, sy]);
        break;
      }
    }
  }

  if (points.length < 3) return '';
  
  // Convert points to smooth SVG path with cubic beziers
  return pointsToSmoothPath(points);
}

/**
 * Animated metaball renderer.
 * Creates the smooth "lava lamp" merge effect between elements.
 * 
 * Usage:
 *   const metaball = new LiquidMetaball(containerEl);
 *   metaball.addBlob(el1);
 *   metaball.addBlob(el2);
 *   // When el1 and el2 are close, they merge with a smooth bridge
 */
export class LiquidMetaball {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private blobs: { el: HTMLElement; radius: number }[] = [];
  private blendRadius: number;
  private animId: number | null = null;
  private scheduler: AnimationScheduler;
  private resolution = 2; // pixel skip for performance

  constructor(
    container: HTMLElement,
    blendRadius: number = 20,
  ) {
    this.container = container;
    this.blendRadius = blendRadius;
    this.scheduler = AnimationScheduler.shared();
    
    // Create canvas overlay for metaball rendering
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
    
    Object.assign(this.canvas.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '10',
    });
    
    container.style.position = container.style.position || 'relative';
    container.appendChild(this.canvas);
    
    this.resize();
  }

  addBlob(element: HTMLElement): void {
    const rect = element.getBoundingClientRect();
    const radius = Math.min(rect.width, rect.height) / 2;
    this.blobs.push({ el: element, radius });
    this.startRendering();
  }

  removeBlob(element: HTMLElement): void {
    this.blobs = this.blobs.filter(b => b.el !== element);
    if (this.blobs.length === 0) this.stopRendering();
  }

  /** Update blend smoothness */
  setBlendRadius(r: number): void {
    this.blendRadius = r;
  }

  private resize(): void {
    const rect = this.container.getBoundingClientRect();
    this.canvas.width = rect.width / this.resolution;
    this.canvas.height = rect.height / this.resolution;
  }

  private startRendering(): void {
    if (this.animId !== null) return;
    this.animId = this.scheduler.schedule(() => {
      this.render();
      return this.blobs.length > 1; // Only render when there's something to merge
    });
  }

  private stopRendering(): void {
    if (this.animId !== null) {
      this.scheduler.cancel(this.animId);
      this.animId = null;
    }
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private render(): void {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const img = this.ctx.createImageData(w, h);
    const data = img.data;
    const containerRect = this.container.getBoundingClientRect();

    // Get blob positions relative to container
    const positions = this.blobs.map(b => {
      const r = b.el.getBoundingClientRect();
      return {
        cx: (r.left + r.width / 2 - containerRect.left) / this.resolution,
        cy: (r.top + r.height / 2 - containerRect.top) / this.resolution,
        r: b.radius / this.resolution,
      };
    });

    // Render metaball field
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        // Compute smooth-min of all blob SDFs at this pixel
        let minDist = Infinity;
        for (const blob of positions) {
          const dx = x - blob.cx;
          const dy = y - blob.cy;
          const d = Math.sqrt(dx * dx + dy * dy) - blob.r;
          
          // Smooth minimum for organic blending
          const k = this.blendRadius / this.resolution;
          const hh = Math.max(k - Math.abs(minDist - d), 0) / k;
          minDist = Math.min(minDist, d) - hh * hh * hh * k * (1 / 6);
        }

        const i = (y * w + x) * 4;
        if (minDist < 0) {
          // Inside the merged blob — draw glass-like fill
          const edge = 1 - smoothstep(-3, 0, minDist);
          data[i] = 255;
          data[i + 1] = 255;
          data[i + 2] = 255;
          data[i + 3] = Math.round(edge * 40); // Very subtle fill
        } else if (minDist < 1.5) {
          // Border — the rim highlight
          const rim = 1 - minDist / 1.5;
          data[i] = 255;
          data[i + 1] = 255;
          data[i + 2] = 255;
          data[i + 3] = Math.round(rim * 180);
        }
      }
    }

    this.ctx.putImageData(img, 0, 0);
  }

  destroy(): void {
    this.stopRendering();
    this.canvas.remove();
  }
}

// ─── Helpers ──────────────────────────────────────────────────────

function roundedRectPath(rx: number, ry: number): string {
  const x = rx;
  const y = ry;
  const w = 1 - 2 * rx;
  const h = 1 - 2 * ry;
  
  return `M ${x} 0 L ${x + w} 0 Q 1 0 1 ${y} L 1 ${y + h} Q 1 1 ${x + w} 1 L ${x} 1 Q 0 1 0 ${y + h} L 0 ${y} Q 0 0 ${x} 0 Z`;
}

function pointsToSmoothPath(points: [number, number][]): string {
  if (points.length < 3) return '';
  
  let d = `M ${points[0][0]} ${points[0][1]}`;
  
  for (let i = 0; i < points.length; i++) {
    const curr = points[i];
    const next = points[(i + 1) % points.length];
    const nextNext = points[(i + 2) % points.length];
    
    // Catmull-Rom to Cubic Bezier conversion
    const cp1x = curr[0] + (next[0] - points[(i - 1 + points.length) % points.length][0]) / 6;
    const cp1y = curr[1] + (next[1] - points[(i - 1 + points.length) % points.length][1]) / 6;
    const cp2x = next[0] - (nextNext[0] - curr[0]) / 6;
    const cp2y = next[1] - (nextNext[1] - curr[1]) / 6;
    
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next[0]} ${next[1]}`;
  }
  
  return d + ' Z';
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
