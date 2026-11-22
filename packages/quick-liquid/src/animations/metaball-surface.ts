import { PROFILE_SAMPLES, refractionProfile } from '../core/optics';
import { sdfRoundedRect, smoothMin } from '../math/sdf';
import type { LiquidGroupConfig } from './group';

export interface BlobShape {
  cx: number; cy: number; rx: number; ry: number; radius: number;
}

let nextFilter = 0;

function color(value: string) {
  const ctx = document.createElement('canvas').getContext('2d')!;
  ctx.fillStyle = value;
  ctx.fillRect(0, 0, 1, 1);
  return ctx.getImageData(0, 0, 1, 1).data;
}

/** One height field drives backdrop displacement, tint and reflection across every lobe. */
export class MetaballSurface {
  private canvas = document.createElement('canvas');
  private ctx = this.canvas.getContext('2d')!;
  private map = document.createElement('canvas');
  private mapCtx = this.map.getContext('2d')!;
  private lens = document.createElement('div');
  private svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  private image: SVGFEImageElement;
  private profile = refractionProfile(28, 36, 1.5);
  private tint: Uint8ClampedArray;
  private rim: Uint8ClampedArray;
  private scene?: ImageData;
  private sceneVersion = '';
  private field = new Float32Array(0);

  constructor(private host: HTMLElement, private cfg: LiquidGroupConfig) {
    const id = 'ql-metaball-' + ++nextFilter;
    this.svg.innerHTML = `<defs><filter id="${id}" x="0%" y="0%" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feImage preserveAspectRatio="none" width="100%" height="100%" result="encoded"/>
      <feComponentTransfer in="encoded" result="normal"><feFuncR type="linear" slope="1.003937" intercept="-0.003937"/><feFuncG type="linear" slope="1.003937" intercept="-0.003937"/></feComponentTransfer>
      <feDisplacementMap in="SourceGraphic" in2="normal" scale="48" xChannelSelector="R" yChannelSelector="G"/>
    </filter></defs>`;
    this.image = this.svg.querySelector('feImage')!;
    this.svg.style.cssText = 'position:absolute;width:0;height:0;pointer-events:none';
    for (const layer of [this.lens, this.canvas]) {
      layer.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
      layer.setAttribute('aria-hidden', 'true');
    }
    this.lens.style.backdropFilter = 'url(#' + id + ')';
    this.tint = color(cfg.bridgeColor);
    this.rim = color(cfg.bridgeRimColor);
    if (!cfg.backdrop) host.append(this.svg, this.lens);
    host.append(this.canvas);
  }

  /** Call updatePositions after changing the pixels of a supplied backdrop. */
  refreshBackdrop() { this.sceneVersion = ''; }

  draw(shapes: BlobShape[], blend: number) {
    const width = this.host.clientWidth, height = this.host.clientHeight;
    if (!width || !height) return;
    const step = Math.max(0.5, this.cfg.resolution);
    const w = Math.ceil(width / step), h = Math.ceil(height / step);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = this.map.width = w;
      this.canvas.height = this.map.height = h;
    }
    const backdrop = this.cfg.backdrop;
    if (backdrop && backdrop.width && backdrop.height) {
      const version = backdrop.width + 'x' + backdrop.height;
      if (this.sceneVersion !== version) {
        this.scene = backdrop.getContext('2d')!.getImageData(0, 0, backdrop.width, backdrop.height);
        this.sceneVersion = version;
      }
    }
    this.ctx.clearRect(0, 0, w, h);
    if (!shapes.length) { this.lens.hidden = true; return; }
    this.lens.hidden = false;
    const sx = width / w, sy = height / h;
    // Pad the active bounds for the smooth union and central differences.
    const pad = blend + 4 * step;
    const left = Math.max(0, Math.floor((Math.min(...shapes.map(s => s.cx - s.rx)) - pad) / sx));
    const top = Math.max(0, Math.floor((Math.min(...shapes.map(s => s.cy - s.ry)) - pad) / sy));
    const right = Math.min(w, Math.ceil((Math.max(...shapes.map(s => s.cx + s.rx)) + pad) / sx));
    const bottom = Math.min(h, Math.ceil((Math.max(...shapes.map(s => s.cy + s.ry)) + pad) / sy));
    const cols = right - left, rows = bottom - top;
    if (cols < 1 || rows < 1) { this.lens.hidden = true; return; }
    const stride = cols + 2, size = stride * (rows + 2);
    if (this.field.length < size) this.field = new Float32Array(size);
    const field = this.field;
    for (let y = -1; y <= rows; y++) {
      for (let x = -1; x <= cols; x++) {
        const px = (left + x + 0.5) * sx, py = (top + y + 0.5) * sy;
        let distance = Infinity;
        for (const s of shapes) {
          const d = sdfRoundedRect(px, py, s.cx, s.cy, s.rx, s.ry, s.radius);
          distance = blend > 0 ? smoothMin(distance, d, blend) : Math.min(distance, d);
        }
        field[(y + 1) * stride + x + 1] = distance;
      }
    }
    const scene = this.scene;
    const pixels = this.ctx.createImageData(cols, rows);
    const map = scene ? undefined : this.mapCtx.createImageData(cols, rows);
    if (map) { this.mapCtx.fillStyle = '#808000'; this.mapCtx.fillRect(0, 0, w, h); }
    const bezel = Math.max(1, Math.min(44, ...shapes.map(s => Math.min(s.rx, s.ry))));
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = 4 * (y * cols + x), p = (y + 1) * stride + x + 1;
        if (map) { map.data[i] = map.data[i + 1] = 128; map.data[i + 3] = 255; }
        const depth = -field[p], coverage = Math.min(1, 0.5 + depth / step);
        if (coverage <= 0) continue;
        const nx = (field[p + 1] - field[p - 1]) / (2 * sx);
        const ny = (field[p + stride] - field[p - stride]) / (2 * sy);
        const u = Math.max(0, Math.min(1, depth / bezel));
        const bend = this.profile[Math.round(u * PROFILE_SAMPLES)];
        const dx = -nx * bend, dy = -ny * bend;
        if (map) { map.data[i] += dx * 126; map.data[i + 1] += dy * 126; }
        const edge = Math.max(0, 1 - Math.max(0, depth) / Math.max(0.1, this.cfg.bridgeRimWidth + step));
        const light = -(nx * 0.52 + ny * 0.85);
        const slope = 1 - u;
        const glint = Math.pow(Math.max(0, light), 5) * slope ** 3;
        const reflection = Math.min(1, (edge * (0.30 + 0.66 * light * light) + glint * 0.48) * this.rim[3] / 255);
        const tint = this.cfg.bridgeOpacity * this.tint[3] / 255;
        const alpha = reflection + tint * (1 - reflection);
        let source = 0, across = 0, down = 0, fx = 0, fy = 0;
        if (scene) {
          const bx = Math.min(scene.width - 1, Math.max(0, ((left + x + 0.5) * sx + dx * 24) * scene.width / width - 0.5));
          const by = Math.min(scene.height - 1, Math.max(0, ((top + y + 0.5) * sy + dy * 24) * scene.height / height - 0.5));
          const ix = Math.floor(bx), iy = Math.floor(by);
          source = 4 * (iy * scene.width + ix);
          across = ix < scene.width - 1 ? 4 : 0;
          down = iy < scene.height - 1 ? scene.width * 4 : 0;
          fx = bx - ix;
          fy = by - iy;
        }
        for (let c = 0; c < 3; c++) {
          const lit = this.rim[c] * reflection + this.tint[c] * tint * (1 - reflection);
          if (scene) {
            const k = source + c;
            const first = scene.data[k] * (1 - fx) + scene.data[k + across] * fx;
            const second = scene.data[k + down] * (1 - fx) + scene.data[k + down + across] * fx;
            pixels.data[i + c] = lit + (first + (second - first) * fy) * (1 - alpha);
          } else {
            pixels.data[i + c] = lit / Math.max(alpha, 0.001);
          }
        }
        pixels.data[i + 3] = 255 * coverage * (scene ? 1 : alpha);
      }
    }
    this.ctx.putImageData(pixels, left, top);
    if (map) {
      this.mapCtx.putImageData(map, left, top);
      this.image.setAttribute('href', this.map.toDataURL());
    }
  }

  destroy() { this.canvas.remove(); this.svg.remove(); this.lens.remove(); }
}
