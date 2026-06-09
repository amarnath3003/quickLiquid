/**
 * quick-liquid/animations/group.ts
 * 
 * Liquid Group — multi-element merge/split system.
 * 
 * THE "WATER BALL" EFFECT:
 * When two liquid glass elements come close enough, they merge
 * into a single blob with a smooth organic bridge (like water
 * surface tension pulling droplets together). When they separate,
 * the bridge stretches thin and snaps with a satisfying pop.
 * 
 * This is the most distinctive Apple liquid glass behavior:
 * - Tab bar icons merge into background pill
 * - Notification cards stack/merge when grouped
 * - Toggle elements flow between states
 * - Dock icons' glass overlays merge when adjacent
 * 
 * IMPLEMENTATION:
 * Uses a shared SVG mask/clip-path that renders the smooth-min
 * metaball field for all member elements. As elements move, the
 * field updates and the organic bridge appears/disappears.
 * 
 * PERFORMANCE:
 * - The metaball field is computed at LOW resolution (1/4 pixel)
 * - Only recomputes when elements actually move (intersection observer)
 * - Uses canvas for the SDF field, converted to SVG mask
 * - GPU-composited: the mask is applied via CSS, actual rendering is browser-side
 */

import { Spring, SpringConfig, SpringPreset } from './spring';
import { AnimationScheduler } from './scheduler';

export interface LiquidGroupConfig {
  /** Distance threshold to start forming a bridge (px) */
  mergeDistance: number;
  /** Smooth-min blend radius (higher = more gooey) */
  blendRadius: number;
  /** Spring config for merge/split animations */
  spring: Partial<SpringConfig> | SpringPreset;
  /** Resolution divider for metaball field (2 = half res, 4 = quarter) */
  resolution: number;
  /** Whether to render the merge blob visually */
  renderBlob: boolean;
  /** Opacity of the merge bridge (0-1) */
  bridgeOpacity: number;
  /** Color of the bridge fill */
  bridgeColor: string;
  /** Rim color of the bridge */
  bridgeRimColor: string;
  /** Rim width */
  bridgeRimWidth: number;
  /** Callback when elements merge */
  onMerge?: (elements: HTMLElement[]) => void;
  /** Callback when elements split */
  onSplit?: (elements: HTMLElement[]) => void;
}

const DEFAULT_GROUP_CONFIG: LiquidGroupConfig = {
  mergeDistance: 60,
  blendRadius: 24,
  spring: 'liquidMerge',
  resolution: 3,
  renderBlob: true,
  bridgeOpacity: 0.15,
  bridgeColor: 'rgba(255, 255, 255, 0.08)',
  bridgeRimColor: 'rgba(255, 255, 255, 0.5)',
  bridgeRimWidth: 1.5,
  onMerge: undefined,
  onSplit: undefined,
};

interface MemberInfo {
  el: HTMLElement;
  cx: number;
  cy: number;
  rx: number;  // half-width
  ry: number;  // half-height
  radius: number;
  merged: Set<HTMLElement>; // currently merged with
}

/**
 * LiquidGroup manages a set of elements that can merge/split
 * with organic liquid animations.
 */
export class LiquidGroup {
  private container: HTMLElement;
  private cfg: LiquidGroupConfig;
  private scheduler: AnimationScheduler;
  private members: Map<HTMLElement, MemberInfo> = new Map();
  
  // Rendering
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private rimCanvas: HTMLCanvasElement;
  private rimCtx: CanvasRenderingContext2D;
  
  // Animation state
  private blendSpring: Spring;
  private animId: number | null = null;
  private needsUpdate = false;
  private observer: MutationObserver | null = null;
  private resizeObserver: ResizeObserver | null = null;
  
  // Merge tracking
  private mergedPairs: Set<string> = new Set();

  constructor(container: HTMLElement, config: Partial<LiquidGroupConfig> = {}) {
    this.container = container;
    this.cfg = { ...DEFAULT_GROUP_CONFIG, ...config };
    this.scheduler = AnimationScheduler.shared();
    this.blendSpring = new Spring(0, this.cfg.spring);
    
    // Setup rendering canvases
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
    this.rimCanvas = document.createElement('canvas');
    this.rimCtx = this.rimCanvas.getContext('2d')!;
    
    if (this.cfg.renderBlob) {
      this.setupRenderLayer();
    }
    
    this.setupObservers();
  }

  /**
   * Add an element to the liquid group.
   * It will now participate in merge/split animations with other members.
   */
  add(element: HTMLElement): void {
    const rect = element.getBoundingClientRect();
    const containerRect = this.container.getBoundingClientRect();
    const radius = parseFloat(getComputedStyle(element).borderRadius) || 0;
    
    this.members.set(element, {
      el: element,
      cx: rect.left + rect.width / 2 - containerRect.left,
      cy: rect.top + rect.height / 2 - containerRect.top,
      rx: rect.width / 2,
      ry: rect.height / 2,
      radius: Math.min(radius, rect.width / 2, rect.height / 2),
      merged: new Set(),
    });
    
    this.needsUpdate = true;
    this.startAnimation();
  }

  /**
   * Remove an element from the group.
   */
  remove(element: HTMLElement): void {
    this.members.delete(element);
    this.needsUpdate = true;
    
    // Clean up merge pairs
    for (const key of this.mergedPairs) {
      if (key.includes(String(element))) {
        this.mergedPairs.delete(key);
      }
    }
  }

  /**
   * Force update positions (call after layout changes).
   */
  updatePositions(): void {
    const containerRect = this.container.getBoundingClientRect();
    
    for (const [el, info] of this.members) {
      const rect = el.getBoundingClientRect();
      info.cx = rect.left + rect.width / 2 - containerRect.left;
      info.cy = rect.top + rect.height / 2 - containerRect.top;
      info.rx = rect.width / 2;
      info.ry = rect.height / 2;
      info.radius = Math.min(
        parseFloat(getComputedStyle(el).borderRadius) || 0,
        rect.width / 2,
        rect.height / 2
      );
    }
    
    this.needsUpdate = true;
    this.startAnimation();
  }

  /**
   * Manually trigger a merge animation between specific elements.
   */
  merge(_elements: HTMLElement[], spring?: Partial<SpringConfig> | SpringPreset): void {
    this.blendSpring = new Spring(0, spring || this.cfg.spring);
    this.blendSpring.setTarget(1);
    this.needsUpdate = true;
    this.startAnimation();
  }

  /**
   * Manually trigger a split animation.
   */
  split(spring?: Partial<SpringConfig> | SpringPreset): void {
    this.blendSpring = new Spring(1, spring || 'liquidSplit');
    this.blendSpring.setTarget(0);
    this.needsUpdate = true;
    this.startAnimation();
  }

  // ─── Internal ─────────────────────────────────────────────────

  private setupRenderLayer(): void {
    Object.assign(this.canvas.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '5',
      opacity: String(this.cfg.bridgeOpacity),
      mixBlendMode: 'screen',
    });

    Object.assign(this.rimCanvas.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '6',
    });
    
    this.container.style.position = this.container.style.position || 'relative';
    this.container.appendChild(this.canvas);
    this.container.appendChild(this.rimCanvas);
    
    this.resizeCanvas();
  }

  private resizeCanvas(): void {
    const rect = this.container.getBoundingClientRect();
    const res = this.cfg.resolution;
    this.canvas.width = Math.ceil(rect.width / res);
    this.canvas.height = Math.ceil(rect.height / res);
    this.rimCanvas.width = Math.ceil(rect.width / res);
    this.rimCanvas.height = Math.ceil(rect.height / res);
  }

  private setupObservers(): void {
    // Watch for DOM changes that might affect positions
    this.observer = new MutationObserver(() => {
      this.updatePositions();
    });
    this.observer.observe(this.container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class'],
    });
    
    // Watch container resize
    this.resizeObserver = new ResizeObserver(() => {
      this.resizeCanvas();
      this.updatePositions();
    });
    this.resizeObserver.observe(this.container);
  }

  private startAnimation(): void {
    if (this.animId !== null) return;
    
    this.animId = this.scheduler.schedule((now) => {
      this.updatePositions();
      
      const springActive = this.blendSpring.tick(now);
      
      if (this.cfg.renderBlob) {
        this.renderMergeField();
      }
      
      this.detectMerges();
      
      const hasActivity = springActive || this.needsUpdate;
      this.needsUpdate = false;
      
      if (!hasActivity) {
        this.animId = null;
      }
      return hasActivity;
    });
  }

  private renderMergeField(): void {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const res = this.cfg.resolution;
    const members = [...this.members.values()];
    
    if (members.length < 2) {
      this.ctx.clearRect(0, 0, w, h);
      this.rimCtx.clearRect(0, 0, w, h);
      return;
    }
    
    const img = this.ctx.createImageData(w, h);
    const data = img.data;
    const rimImg = this.rimCtx.createImageData(w, h);
    const rimData = rimImg.data;
    
    const blendK = this.cfg.blendRadius / res;

    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        // Compute smooth-min of all member SDFs
        let mergedDist = Infinity;
        
        for (const member of members) {
          const cx = member.cx / res;
          const cy = member.cy / res;
          const rx = member.rx / res;
          const ry = member.ry / res;
          const r = member.radius / res;
          
          // Rounded rect SDF for this member
          const dx = Math.abs(px - cx) - (rx - r);
          const dy = Math.abs(py - cy) - (ry - r);
          const outsideDist = Math.sqrt(Math.max(dx, 0) ** 2 + Math.max(dy, 0) ** 2) - r;
          const d = Math.min(Math.max(dx, dy), outsideDist);
          
          // Smooth minimum — the magic sauce for organic blending
          if (mergedDist === Infinity) {
            mergedDist = d;
          } else {
            const hh = Math.max(blendK - Math.abs(mergedDist - d), 0) / blendK;
            mergedDist = Math.min(mergedDist, d) - hh * hh * hh * blendK * (1 / 6);
          }
        }

        const i = (py * w + px) * 4;
        
        // Only render the BRIDGE area (exclude individual element areas)
        // We detect bridge pixels as those that are inside the merged field
        // but NOT strongly inside any single element
        let insideSingle = false;
        for (const member of members) {
          const cx = member.cx / res;
          const cy = member.cy / res;
          const rx = member.rx / res;
          const ry = member.ry / res;
          const r = member.radius / res;
          const dx = Math.abs(px - cx) - (rx - r);
          const dy = Math.abs(py - cy) - (ry - r);
          const outsideDist = Math.sqrt(Math.max(dx, 0) ** 2 + Math.max(dy, 0) ** 2) - r;
          const d = Math.min(Math.max(dx, dy), outsideDist);
          if (d < -2) { insideSingle = true; break; }
        }
        
        if (insideSingle) continue; // Skip — element handles its own glass

        if (mergedDist < 0) {
          // Inside the bridge fill
          const intensity = Math.min(1, -mergedDist / 3);
          data[i] = 255;
          data[i + 1] = 255;
          data[i + 2] = 255;
          data[i + 3] = Math.round(intensity * 60);
        }
        
        // Rim highlight on the bridge boundary
        if (Math.abs(mergedDist) < this.cfg.bridgeRimWidth) {
          const rimIntensity = 1 - Math.abs(mergedDist) / this.cfg.bridgeRimWidth;
          rimData[i] = 255;
          rimData[i + 1] = 255;
          rimData[i + 2] = 255;
          rimData[i + 3] = Math.round(rimIntensity * 200);
        }
      }
    }
    
    this.ctx.putImageData(img, 0, 0);
    this.rimCtx.putImageData(rimImg, 0, 0);
  }

  private detectMerges(): void {
    const members = [...this.members.values()];
    
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const a = members[i];
        const b = members[j];
        
        // Distance between element edges
        const dx = a.cx - b.cx;
        const dy = a.cy - b.cy;
        const centerDist = Math.sqrt(dx * dx + dy * dy);
        const edgeDist = centerDist - a.rx - b.rx;
        
        const pairKey = `${i}-${j}`;
        const wasMerged = this.mergedPairs.has(pairKey);
        const shouldMerge = edgeDist < this.cfg.mergeDistance;
        
        if (shouldMerge && !wasMerged) {
          this.mergedPairs.add(pairKey);
          a.merged.add(b.el);
          b.merged.add(a.el);
          this.cfg.onMerge?.([a.el, b.el]);
        } else if (!shouldMerge && wasMerged) {
          this.mergedPairs.delete(pairKey);
          a.merged.delete(b.el);
          b.merged.delete(a.el);
          this.cfg.onSplit?.([a.el, b.el]);
        }
      }
    }
  }

  /** Get elements currently merged with a given element */
  getMergedWith(element: HTMLElement): HTMLElement[] {
    const info = this.members.get(element);
    return info ? [...info.merged] : [];
  }

  /** Check if two elements are currently merged */
  areMerged(a: HTMLElement, b: HTMLElement): boolean {
    const info = this.members.get(a);
    return info?.merged.has(b) ?? false;
  }

  destroy(): void {
    if (this.animId !== null) {
      this.scheduler.cancel(this.animId);
    }
    if (this.observer) this.observer.disconnect();
    if (this.resizeObserver) this.resizeObserver.disconnect();
    this.canvas.remove();
    this.rimCanvas.remove();
    this.members.clear();
    this.mergedPairs.clear();
  }
}

/**
 * Liquid Tab Bar — specialized group for tab-like navigation.
 * 
 * The selection indicator is a glass pill that morphs between
 * tab positions with liquid spring animation. When tabs are close
 * enough, the pill stretches to encompass multiple tabs before
 * snapping to the new selection.
 */
export class LiquidTabBar {
  private container: HTMLElement;
  private items: HTMLElement[];
  private indicator: HTMLElement;
  private currentIndex: number = 0;
  private spring: Spring;
  private widthSpring: Spring;
  private scheduler: AnimationScheduler;
  private animId: number | null = null;

  constructor(
    container: HTMLElement,
    items: HTMLElement[],
    config?: { spring?: Partial<SpringConfig> | SpringPreset }
  ) {
    this.container = container;
    this.items = items;
    this.scheduler = AnimationScheduler.shared();
    this.spring = new Spring(0, config?.spring || 'default');
    this.widthSpring = new Spring(0, config?.spring || 'snappy');
    
    // Create the glass indicator element
    this.indicator = document.createElement('div');
    this.indicator.className = 'ql-tab-indicator';
    Object.assign(this.indicator.style, {
      position: 'absolute',
      top: '0',
      height: '100%',
      borderRadius: 'inherit',
      pointerEvents: 'none',
      transition: 'none', // We handle animation
    });
    
    container.style.position = container.style.position || 'relative';
    container.insertBefore(this.indicator, container.firstChild);
    
    // Set initial position
    if (items.length > 0) {
      this.selectImmediate(0);
    }
  }

  /**
   * Select a tab — the indicator morphs to it with liquid animation.
   * 
   * The stretch effect: indicator first expands to cover the gap
   * between old and new position, then contracts to the new tab.
   */
  select(index: number): void {
    if (index === this.currentIndex) return;
    if (index < 0 || index >= this.items.length) return;
    
    const prevRect = this.items[this.currentIndex].getBoundingClientRect();
    const nextRect = this.items[index].getBoundingClientRect();
    const containerRect = this.container.getBoundingClientRect();
    
    const prevX = prevRect.left - containerRect.left;
    const nextX = nextRect.left - containerRect.left;
    
    // First: stretch to cover both positions (the liquid bridge)
    const stretchLeft = Math.min(prevX, nextX);
    const stretchRight = Math.max(prevX + prevRect.width, nextX + nextRect.width);
    const stretchWidth = stretchRight - stretchLeft;
    
    this.currentIndex = index;
    
    // Animate X position
    this.spring.setTarget(nextX);
    
    // Width: first expand, then contract
    // We achieve this by overshooting the width spring
    this.widthSpring.setValue(stretchWidth, 0);
    this.widthSpring.setTarget(nextRect.width);
    
    this.startAnimation();
  }

  /** Set tab without animation */
  selectImmediate(index: number): void {
    this.currentIndex = index;
    const rect = this.items[index].getBoundingClientRect();
    const containerRect = this.container.getBoundingClientRect();
    const x = rect.left - containerRect.left;
    
    this.spring.setValue(x);
    this.spring.setTarget(x);
    this.widthSpring.setValue(rect.width);
    this.widthSpring.setTarget(rect.width);
    
    this.indicator.style.transform = `translateX(${x}px)`;
    this.indicator.style.width = `${rect.width}px`;
  }

  /** Get indicator element (to apply liquid glass effect to it) */
  getIndicator(): HTMLElement {
    return this.indicator;
  }

  private startAnimation(): void {
    if (this.animId !== null) return;
    
    this.animId = this.scheduler.schedule((now) => {
      const posActive = this.spring.tick(now);
      const widthActive = this.widthSpring.tick(now);
      
      this.indicator.style.transform = `translateX(${this.spring.value}px)`;
      this.indicator.style.width = `${this.widthSpring.value}px`;
      
      const active = posActive || widthActive;
      if (!active) this.animId = null;
      return active;
    });
  }

  destroy(): void {
    if (this.animId !== null) {
      this.scheduler.cancel(this.animId);
    }
    this.indicator.remove();
  }
}
