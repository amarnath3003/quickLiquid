import { MetaballSurface, type BlobShape } from './metaball-surface';
import { sdfRoundedRect } from '../math/sdf';
import { Spring, SpringConfig, SpringPreset } from './spring';
import { AnimationScheduler } from './scheduler';
import { LiquidGlassEngine, type LiquidGlassConfig } from '../core/engine';
import { computeBoundedJellyBox, ensureAnimStyles } from './interactive';

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
  /** Optional origin-clean 2D scene canvas covering the container, for direct backdrop sampling. */
  backdrop?: HTMLCanvasElement;
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

interface MemberInfo extends BlobShape {
  el: HTMLElement;
  merged: Set<HTMLElement>;
}

/** Members provide geometry and interaction. The group paints their shared glass. */
export class LiquidGroup {
  private cfg: LiquidGroupConfig;
  private members = new Map<HTMLElement, MemberInfo>();
  private scheduler = AnimationScheduler.shared();
  private blendSpring: Spring;
  private surface?: MetaballSurface;
  private animId: number | null = null;
  private observer: MutationObserver;
  private sizes: ResizeObserver;
  private previousPosition: string | undefined;

  constructor(private container: HTMLElement, config: Partial<LiquidGroupConfig> = {}) {
    this.cfg = { ...DEFAULT_GROUP_CONFIG, ...config };
    this.blendSpring = new Spring(1, this.cfg.spring);
    if (this.cfg.renderBlob) {
      if (getComputedStyle(container).position === 'static') {
        this.previousPosition = container.style.position;
        container.style.position = 'relative';
      }
      this.surface = new MetaballSurface(container, this.cfg);
    }
    this.observer = new MutationObserver(() => this.schedule());
    this.observer.observe(container, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class'] });
    this.sizes = new ResizeObserver(() => this.schedule());
    this.sizes.observe(container);
  }

  add(el: HTMLElement): void {
    if (this.members.has(el)) return;
    this.members.set(el, { el, cx: 0, cy: 0, rx: 0, ry: 0, radius: 0, merged: new Set() });
    this.sizes.observe(el);
    this.schedule();
  }

  remove(el: HTMLElement): void {
    this.sizes.unobserve(el);
    this.members.delete(el);
    for (const info of this.members.values()) info.merged.delete(el);
    this.schedule();
  }

  updatePositions(): void {
    this.surface?.refreshBackdrop();
    this.schedule();
  }

  merge(_elements: HTMLElement[], spring?: Partial<SpringConfig> | SpringPreset): void {
    this.blendSpring = new Spring(0, spring || this.cfg.spring);
    this.blendSpring.setTarget(1);
    this.schedule();
  }

  split(spring?: Partial<SpringConfig> | SpringPreset): void {
    this.blendSpring = new Spring(this.blendSpring.value, spring || 'liquidSplit');
    this.blendSpring.setTarget(0);
    this.schedule();
  }

  private schedule(): void {
    if (this.animId !== null) return;
    const reduced = AnimationScheduler.prefersReducedMotion();
    const id = this.scheduler.schedule(now => {
      const moving = this.blendSpring.tick(now);
      const rect = this.container.getBoundingClientRect();
      const scaleX = rect.width / (this.container.offsetWidth || 1) || 1;
      const scaleY = rect.height / (this.container.offsetHeight || 1) || 1;
      const shapes = [...this.members.values()];
      for (const s of shapes) {
        const bounds = s.el.getBoundingClientRect();
        s.rx = bounds.width / scaleX / 2;
        s.ry = bounds.height / scaleY / 2;
        s.cx = (bounds.left - rect.left) / scaleX + s.rx - this.container.clientLeft + this.container.scrollLeft;
        s.cy = (bounds.top - rect.top) / scaleY + s.ry - this.container.clientTop + this.container.scrollTop;
        const radius = getComputedStyle(s.el).borderTopLeftRadius;
        const limit = Math.min(s.rx, s.ry);
        s.radius = Math.min(limit, (parseFloat(radius) || 0) * (radius.includes('%') ? limit / 50 : 1));
      }
      // At the saddle between equal fields the cubic smooth-min subtracts k/6.
      // A gap of k/3 therefore closes exactly as the two lobes become connected.
      const reach = Math.max(0, Math.min(this.cfg.mergeDistance, this.cfg.blendRadius) * this.blendSpring.value);
      this.surface?.draw(shapes.filter(s => s.rx > 0 && s.ry > 0), reach * 3);
      for (let i = 0; i < shapes.length; i++) {
        const a = shapes[i];
        for (const b of shapes.slice(i + 1)) {
          const gap = sdfRoundedRect(a.cx, a.cy, b.cx, b.cy, a.rx + b.rx, a.ry + b.ry, a.radius + b.radius);
          const joined = gap < reach && a.rx > 0 && b.rx > 0;
          if (joined === a.merged.has(b.el)) continue;
          if (joined) {
            a.merged.add(b.el); b.merged.add(a.el);
            this.cfg.onMerge?.([a.el, b.el]);
          } else {
            a.merged.delete(b.el); b.merged.delete(a.el);
            this.cfg.onSplit?.([a.el, b.el]);
          }
        }
      }
      if (!moving) this.animId = null;
      return moving;
    });
    if (!reduced) this.animId = id;
  }

  getMergedWith(el: HTMLElement): HTMLElement[] { return [...(this.members.get(el)?.merged ?? [])]; }
  areMerged(a: HTMLElement, b: HTMLElement): boolean { return this.members.get(a)?.merged.has(b) ?? false; }

  destroy(): void {
    if (this.animId !== null) this.scheduler.cancel(this.animId);
    this.observer.disconnect();
    this.sizes.disconnect();
    this.surface?.destroy();
    if (this.previousPosition !== undefined) this.container.style.position = this.previousPosition;
    this.members.clear();
  }
}

export interface LiquidTabBarConfig {
  spring?: Partial<SpringConfig> | SpringPreset;
  orientation?: 'horizontal' | 'vertical';
  glass?: boolean | Partial<LiquidGlassConfig>;
  hoverFollower?: boolean;
  stretch?: number;
}

const DEFAULT_TAB_SPRING: Partial<SpringConfig> = {
  stiffness: 860,
  damping: 34,
  mass: 0.68,
  restDisplacementThreshold: 0.5,
  restThreshold: 12,
};

const DEFAULT_SCALE_SPRING: Partial<SpringConfig> = {
  stiffness: 920,
  damping: 42,
  mass: 0.68,
  restDisplacementThreshold: 0.006,
  restThreshold: 0.08,
};

function resolveTabPosSpring(spring?: Partial<SpringConfig> | SpringPreset): Partial<SpringConfig> | SpringPreset {
  if (!spring) return DEFAULT_TAB_SPRING;
  if (typeof spring === 'string') return spring;
  return { restDisplacementThreshold: 0.5, restThreshold: 12, ...spring };
}

function resolveTabScaleSpring(spring?: Partial<SpringConfig> | SpringPreset): Partial<SpringConfig> | SpringPreset {
  if (!spring) return DEFAULT_SCALE_SPRING;
  if (typeof spring === 'string') return spring;
  return { restDisplacementThreshold: 0.006, restThreshold: 0.08, ...spring };
}

const DEFAULT_TAB_GLASS: Partial<LiquidGlassConfig> = {
  quality: 'medium',
  appearance: 'dark',
  blur: 6,
  refractionStrength: 14,
  bezelWidth: 12,
  thickness: 14,
  tintOpacity: 0.14,
  edgeHighlight: 0.85,
  specularStrength: 0.36,
  elevation: 0,
};

/**
 * Liquid Tab Bar — specialized group for tab-like navigation.
 *
 * The selection indicator is a glass pill that glides and jiggles like
 * jelly strictly inside its container boundary box, optionally backed
 * by a real LiquidGlassEngine.
 */
export class LiquidTabBar {
  private container: HTMLElement;
  private items: HTMLElement[];
  private cfg: LiquidTabBarConfig;
  private indicator: HTMLElement;
  private hoverEl: HTMLDivElement | null = null;
  private glassEngine: LiquidGlassEngine | null = null;
  private currentIndex: number = 0;
  private xSpring: Spring;
  private ySpring: Spring;
  private wScaleSpring: Spring;
  private hScaleSpring: Spring;
  private hxSpring: Spring;
  private hySpring: Spring;
  private hwSpring: Spring;
  private hhSpring: Spring;
  private hoverVisible = false;
  private hoverAnimId: number | null = null;
  private targetX = 0;
  private targetY = 0;
  private targetW = 0;
  private targetH = 0;
  private bounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  private lastVisual = { x: 0, y: 0, w: 0, h: 0 };
  private scheduler: AnimationScheduler;
  private animId: number | null = null;
  private resizeObs: ResizeObserver | null = null;
  private destroyed = false;

  constructor(
    container: HTMLElement,
    items: HTMLElement[],
    config?: LiquidTabBarConfig
  ) {
    ensureAnimStyles();
    this.container = container;
    this.items = items;
    this.cfg = { orientation: 'horizontal', hoverFollower: false, stretch: 0.18, ...config };
    this.scheduler = AnimationScheduler.shared();

    const posSpringCfg = resolveTabPosSpring(this.cfg.spring);
    const scaleSpringCfg = resolveTabScaleSpring(this.cfg.spring);
    this.xSpring = new Spring(0, posSpringCfg);
    this.ySpring = new Spring(0, posSpringCfg);
    this.wScaleSpring = new Spring(1, scaleSpringCfg);
    this.hScaleSpring = new Spring(1, scaleSpringCfg);

    this.hxSpring = new Spring(0, 'snappy');
    this.hySpring = new Spring(0, 'snappy');
    this.hwSpring = new Spring(0, 'snappy');
    this.hhSpring = new Spring(0, 'snappy');

    if (getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }

    if (this.cfg.hoverFollower) {
      this.createHoverFollower();
    }

    // Create the glass indicator element
    this.indicator = document.createElement('div');
    this.indicator.className = 'ql-tab-indicator';
    this.indicator.setAttribute('aria-hidden', 'true');
    Object.assign(this.indicator.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      transformOrigin: 'center center',
      pointerEvents: 'none',
      transition: 'none',
    });

    container.insertBefore(this.indicator, container.firstChild ? (this.hoverEl ? this.hoverEl.nextSibling : container.firstChild) : null);

    if (items.length > 0) {
      this.selectImmediate(0);
    }

    this.syncGlassEngine();

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObs = new ResizeObserver(() => {
        if (!this.destroyed && this.items.length > 0 && this.currentIndex < this.items.length) {
          this.selectImmediate(this.currentIndex);
        }
      });
      this.resizeObs.observe(container);
    }
  }

  private createHoverFollower(): void {
    if (this.hoverEl) return;
    const hover = document.createElement('div');
    hover.className = 'ql-tab-hover';
    hover.setAttribute('aria-hidden', 'true');
    Object.assign(hover.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      pointerEvents: 'none',
      opacity: '0',
    });
    this.container.insertBefore(hover, this.container.firstChild);
    this.hoverEl = hover;
    this.container.addEventListener('pointerover', this.onHoverOver, { passive: true });
    this.container.addEventListener('focusin', this.onHoverOver, { passive: true });
    this.container.addEventListener('pointerleave', this.onHoverLeave, { passive: true });
  }

  private removeHoverFollower(): void {
    if (this.hoverAnimId !== null) {
      this.scheduler.cancel(this.hoverAnimId);
      this.hoverAnimId = null;
    }
    this.container.removeEventListener('pointerover', this.onHoverOver);
    this.container.removeEventListener('focusin', this.onHoverOver);
    this.container.removeEventListener('pointerleave', this.onHoverLeave);
    this.hoverEl?.remove();
    this.hoverEl = null;
    this.hoverVisible = false;
  }

  private syncGlassEngine(): void {
    if (this.cfg.glass) {
      const sample = this.items[0] || this.container;
      const sampleStyle = getComputedStyle(sample);
      const rawRadius = parseFloat(sampleStyle.borderTopLeftRadius) || parseFloat(getComputedStyle(this.container).borderTopLeftRadius) || 10;
      const detectedRadius = Math.min(rawRadius, Math.max(8, (this.targetH || 36) / 2));
      const extra = typeof this.cfg.glass === 'object' ? this.cfg.glass : {};
      const nextCfg: Partial<LiquidGlassConfig> = {
        ...DEFAULT_TAB_GLASS,
        borderRadius: detectedRadius,
        ...extra,
      };
      if (this.glassEngine) {
        this.glassEngine.setConfig(nextCfg);
      } else {
        this.glassEngine = new LiquidGlassEngine(this.indicator, nextCfg);
      }
    } else if (this.glassEngine) {
      this.glassEngine.destroy();
      this.glassEngine = null;
    }
  }

  private measureItem(el: HTMLElement): { x: number; y: number; w: number; h: number } {
    const containerRect = this.container.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    const scaleX = containerRect.width / (this.container.offsetWidth || 1) || 1;
    const scaleY = containerRect.height / (this.container.offsetHeight || 1) || 1;
    return {
      x: (rect.left - containerRect.left) / scaleX - this.container.clientLeft + this.container.scrollLeft,
      y: (rect.top - containerRect.top) / scaleY - this.container.clientTop + this.container.scrollTop,
      w: rect.width / scaleX,
      h: rect.height / scaleY,
    };
  }

  private measureBounds(): void {
    if (this.items.length === 0) return;
    const rects = this.items.map(el => this.measureItem(el));
    const itemMinX = Math.min(...rects.map(r => r.x));
    const itemMaxX = Math.max(...rects.map(r => r.x + r.w));
    const itemMinY = Math.min(...rects.map(r => r.y));
    const itemMaxY = Math.max(...rects.map(r => r.y + r.h));
    const maxW = Math.max(...rects.map(r => r.w));
    const maxH = Math.max(...rects.map(r => r.h));
    const clientW = this.container.clientWidth || itemMaxX;
    const clientH = this.container.clientHeight || itemMaxY;

    const singleRow = itemMaxY - itemMinY <= maxH + 2;
    const singleCol = itemMaxX - itemMinX <= maxW + 2;

    this.bounds = {
      minX: singleCol ? Math.max(0, Math.min(itemMinX, itemMinX - 2)) : Math.max(0, itemMinX),
      maxX: singleCol ? Math.min(clientW, Math.max(itemMaxX, itemMaxX + 2)) : Math.min(clientW, itemMaxX),
      minY: singleRow ? Math.max(0, Math.min(itemMinY, itemMinY - 2)) : Math.max(0, itemMinY),
      maxY: singleRow ? Math.min(clientH, Math.max(itemMaxY, itemMaxY + 2)) : Math.min(clientH, itemMaxY),
    };
  }

  private onHoverOver = (e: Event): void => {
    if (this.destroyed || !this.hoverEl) return;
    const target = e.target as Node | null;
    const item = this.items.find(it => it === target || it.contains(target));
    if (!item) return;

    const { x, y, w, h } = this.measureItem(item);
    if (!this.hoverVisible || AnimationScheduler.prefersReducedMotion()) {
      this.hxSpring.setValue(x); this.hxSpring.setTarget(x);
      this.hySpring.setValue(y); this.hySpring.setTarget(y);
      this.hwSpring.setValue(w); this.hwSpring.setTarget(w);
      this.hhSpring.setValue(h); this.hhSpring.setTarget(h);
      this.applyHover();
      this.hoverVisible = true;
      this.hoverEl.style.opacity = '1';
      return;
    }

    this.hxSpring.setTarget(x);
    this.hySpring.setTarget(y);
    this.hwSpring.setTarget(w);
    this.hhSpring.setTarget(h);
    this.hoverEl.style.opacity = '1';
    if (this.hoverAnimId === null) {
      this.hoverAnimId = this.scheduler.schedule(now => {
        const a = this.hxSpring.tick(now);
        const b = this.hySpring.tick(now);
        const c = this.hwSpring.tick(now);
        const d = this.hhSpring.tick(now);
        const active = a || b || c || d;
        this.applyHover();
        if (!active) this.hoverAnimId = null;
        return active;
      });
    }
  };

  private onHoverLeave = (): void => {
    this.hoverVisible = false;
    if (this.hoverEl) this.hoverEl.style.opacity = '0';
  };

  private applyHover(): void {
    if (!this.hoverEl) return;
    this.hoverEl.style.width = `${Math.max(0, this.hwSpring.value).toFixed(1)}px`;
    this.hoverEl.style.height = `${Math.max(0, this.hhSpring.value).toFixed(1)}px`;
    this.hoverEl.style.transform = `translate3d(${this.hxSpring.value.toFixed(2)}px, ${this.hySpring.value.toFixed(2)}px, 0)`;
  }

  /**
   * Select a tab — the indicator glides and stretches to it with liquid spring physics.
   */
  select(index: number): void {
    if (index === this.currentIndex) return;
    if (index < 0 || index >= this.items.length) return;

    this.measureBounds();
    const fallback = this.measureItem(this.items[this.currentIndex]);
    const prevCenterX = this.lastVisual.w > 0 ? this.lastVisual.x + this.lastVisual.w / 2 : fallback.x + fallback.w / 2;
    const prevCenterY = this.lastVisual.h > 0 ? this.lastVisual.y + this.lastVisual.h / 2 : fallback.y + fallback.h / 2;
    const currW = this.lastVisual.w > 0 ? this.lastVisual.w : fallback.w;
    const currH = this.lastVisual.h > 0 ? this.lastVisual.h : fallback.h;

    const next = this.measureItem(this.items[index]);
    this.currentIndex = index;

    if (AnimationScheduler.prefersReducedMotion()) {
      this.selectImmediate(index);
      return;
    }

    this.targetX = next.x;
    this.targetY = next.y;
    this.targetW = next.w;
    this.targetH = next.h;

    this.indicator.style.width = `${next.w.toFixed(1)}px`;
    this.indicator.style.height = `${next.h.toFixed(1)}px`;

    this.xSpring.setValue(prevCenterX - next.w / 2, this.xSpring.velocity);
    this.xSpring.setTarget(next.x);
    this.ySpring.setValue(prevCenterY - next.h / 2, this.ySpring.velocity);
    this.ySpring.setTarget(next.y);

    this.wScaleSpring.setValue(currW / Math.max(1, next.w), 0);
    this.wScaleSpring.setTarget(1);
    this.hScaleSpring.setValue(currH / Math.max(1, next.h), 0);
    this.hScaleSpring.setTarget(1);

    this.applyIndicator(true);
    this.startAnimation();
  }

  /** Set active tab index and animate if changed. */
  setActiveIndex(index: number): void {
    this.select(index);
  }

  /** Set tab without animation */
  selectImmediate(index: number): void {
    if (index < 0 || index >= this.items.length) return;
    if (this.animId !== null) {
      this.scheduler.cancel(this.animId);
      this.animId = null;
    }
    this.currentIndex = index;
    this.measureBounds();
    const m = this.measureItem(this.items[index]);
    this.targetX = m.x;
    this.targetY = m.y;
    this.targetW = m.w;
    this.targetH = m.h;

    this.xSpring.setValue(m.x, 0);
    this.xSpring.setTarget(m.x);
    this.ySpring.setValue(m.y, 0);
    this.ySpring.setTarget(m.y);
    this.wScaleSpring.setValue(1, 0);
    this.wScaleSpring.setTarget(1);
    this.hScaleSpring.setValue(1, 0);
    this.hScaleSpring.setTarget(1);

    this.indicator.style.width = `${m.w.toFixed(1)}px`;
    this.indicator.style.height = `${m.h.toFixed(1)}px`;
    this.applyIndicator(false);
  }

  /** Replace tracked tab elements cleanly when dynamic options change. */
  updateItems(items: HTMLElement[], activeIndex?: number): void {
    this.items = items;
    const nextIdx = activeIndex ?? Math.min(this.currentIndex, Math.max(0, items.length - 1));
    if (items.length > 0) this.selectImmediate(nextIdx);
  }

  /** Update spring, glass, stretch, or hoverFollower configuration live. */
  updateConfig(config: LiquidTabBarConfig): void {
    this.cfg = { ...this.cfg, ...config };
    if (config.spring !== undefined) {
      const posCfg = resolveTabPosSpring(config.spring);
      const scaleCfg = resolveTabScaleSpring(config.spring);
      if (typeof posCfg === 'string') {
        this.xSpring = new Spring(this.xSpring.value, posCfg);
        this.xSpring.setTarget(this.targetX);
        this.ySpring = new Spring(this.ySpring.value, posCfg);
        this.ySpring.setTarget(this.targetY);
        this.wScaleSpring = new Spring(this.wScaleSpring.value, scaleCfg);
        this.wScaleSpring.setTarget(1);
        this.hScaleSpring = new Spring(this.hScaleSpring.value, scaleCfg);
        this.hScaleSpring.setTarget(1);
      } else {
        this.xSpring.updateConfig(posCfg);
        this.ySpring.updateConfig(posCfg);
        this.wScaleSpring.updateConfig(scaleCfg as Partial<SpringConfig>);
        this.hScaleSpring.updateConfig(scaleCfg as Partial<SpringConfig>);
      }
    }
    if (config.hoverFollower !== undefined) {
      if (config.hoverFollower) this.createHoverFollower();
      else this.removeHoverFollower();
    }
    if (config.glass !== undefined) {
      this.syncGlassEngine();
    }
  }

  /** Get indicator element (to inspect or style) */
  getIndicator(): HTMLElement {
    return this.indicator;
  }

  private applyIndicator(withStretch: boolean): void {
    const out = computeBoundedJellyBox({
      rawX: this.xSpring.value,
      rawY: this.ySpring.value,
      width: Math.max(1, this.targetW),
      height: Math.max(1, this.targetH),
      scaleX: this.wScaleSpring.value,
      scaleY: this.hScaleSpring.value,
      vx: withStretch ? this.xSpring.velocity : 0,
      vy: withStretch ? this.ySpring.velocity : 0,
      minX: this.bounds.minX,
      maxX: this.bounds.maxX,
      minY: this.bounds.minY,
      maxY: this.bounds.maxY,
      stretch: withStretch ? (this.cfg.stretch ?? 0.18) : 0,
      maxWallBulge: 1.09,
    });

    this.lastVisual = {
      x: out.visualLeft,
      y: out.visualTop,
      w: out.visualRight - out.visualLeft,
      h: out.visualBottom - out.visualTop,
    };

    this.indicator.style.transform = `translate3d(${out.x.toFixed(2)}px, ${out.y.toFixed(2)}px, 0) scale(${out.scaleX.toFixed(4)}, ${out.scaleY.toFixed(4)})`;
  }

  private startAnimation(): void {
    if (this.animId !== null || this.destroyed) return;

    this.animId = this.scheduler.schedule((now) => {
      const a = this.xSpring.tick(now);
      const b = this.ySpring.tick(now);
      const c = this.wScaleSpring.tick(now);
      const d = this.hScaleSpring.tick(now);
      const active = a || b || c || d;

      this.applyIndicator(active);

      if (!active) {
        this.animId = null;
      }
      return active;
    });
  }

  destroy(): void {
    this.destroyed = true;
    if (this.animId !== null) {
      this.scheduler.cancel(this.animId);
      this.animId = null;
    }
    this.resizeObs?.disconnect();
    this.resizeObs = null;
    this.removeHoverFollower();
    this.glassEngine?.destroy();
    this.glassEngine = null;
    this.indicator.remove();
  }
}
