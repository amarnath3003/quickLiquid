const BEAM = [0.75, 0.71, 0.28, 0.30] as const;

export function flowBeamY(t: number) {
  const a = 1 - t;
  return a ** 3 * BEAM[0] + 3 * a ** 2 * t * BEAM[1] + 3 * a * t ** 2 * BEAM[2] + t ** 3 * BEAM[3];
}

/** The visible scene is also the texture sampled by the glass surface. */
export function paintFlowScene(canvas: HTMLCanvasElement, width: number, height: number) {
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  const sky = ctx.createRadialGradient(width * 0.51, height * 0.45, 0, width / 2, height / 2, width * 0.76);
  sky.addColorStop(0, '#202f46');
  sky.addColorStop(1, '#080d18');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#9ebad343';
  for (let y = 8; y < height; y += 16) {
    for (let x = 8; x < width; x += 16) ctx.fillRect(x, y, 1, 1);
  }
  const colors = ['#ff758e', '#ffac88', '#ffe1a2', '#a3efbd', '#74e3e6', '#87aafa', '#b19afa', '#ec9ce4'];
  colors.forEach((color, index) => {
    const offset = (index - 3.5) * 8;
    ctx.beginPath();
    ctx.moveTo(0, height * BEAM[0] + offset);
    ctx.bezierCurveTo(width / 3, height * BEAM[1] + offset, width * 2 / 3, height * BEAM[2] + offset, width, height * BEAM[3] + offset);
    ctx.strokeStyle = color;
    ctx.shadowBlur = 6;
    ctx.shadowColor = color;
    ctx.globalAlpha = 0.82;
    ctx.lineWidth = index % 3 === 0 ? 2 : 1.15;
    ctx.stroke();
  });
}
