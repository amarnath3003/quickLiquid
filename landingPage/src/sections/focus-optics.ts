/** The printed chart doubles as the lens texture. Supersampling keeps small type
 * legible when viewed through the highest-power lens. */
export function drawFocusChart(canvas: HTMLCanvasElement, width: number, height: number) {
  const scale = 3;
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.scale(scale, scale);
  const paper = ctx.createLinearGradient(0, 0, width, height);
  paper.addColorStop(0, '#101926');
  paper.addColorStop(0.55, '#203249');
  paper.addColorStop(1, '#141b30');
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#a8c3e124';
  for (let x = 0; x < width; x += 16) ctx.fillRect(x, 0, 0.6, height);
  for (let y = 0; y < height; y += 16) ctx.fillRect(0, y, width, 0.6);

  const left = width * 0.12, baseline = height * 0.51;
  ctx.font = '10px monospace';
  ctx.fillStyle = '#b9cade';
  ctx.fillText('RESOLUTION CHART', left, baseline - 36);
  ctx.font = '500 32px system-ui';
  ctx.fillStyle = '#f1f7ff';
  ctx.fillText('Qq 01', left, baseline);
  ctx.font = '10px monospace';
  ctx.fillText('2 px line pairs', left, baseline + 18);

  const colors = ['#ff89a1', '#ffc494', '#f5da95', '#ace9bb', '#8de3de', '#9abdfa', '#b7a4f4'];
  colors.forEach((color, i) => {
    ctx.beginPath();
    ctx.moveTo(0, height * 0.66 + i * 3);
    ctx.bezierCurveTo(width * 0.25, height * 0.75 + i * 3, width * 0.68, height * 0.48 + i * 3, width, height * 0.36 + i * 3);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  });
  ctx.fillStyle = '#cbdbeb';
  for (let x = width * 0.66; x < width * 0.86; x += 4) ctx.fillRect(x, height * 0.24, 2, height * 0.13);
  for (let n = 0; left + n * 5 < width * 0.9; n++) {
    const x = left + n * 5, y = height * 0.82;
    ctx.fillRect(x, y, 0.8, n % 5 ? 4 : 9);
    if (n % 10 === 0) ctx.fillText(String(n), x, y + 21);
  }
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/** Cache the inverse optical map; dragging only changes its sampling origin. */
export function makeLens(diameter: number, zoom: number, pixelRatio: number) {
  const size = Math.max(1, Math.round(diameter * pixelRatio));
  const offsets = new Float32Array(size * size * 2);
  const reflection = new Float32Array(size * size);
  const glass = new ImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const nx = (2 * x + 1) / size - 1, ny = (2 * y + 1) / size - 1;
      const r = Math.hypot(nx, ny);
      const coverage = Math.min(1, Math.max(0, (1 - r) * size / 2 + 0.5));
      if (!coverage) continue;
      const u = Math.min(1, r);
      // Central power is exactly zoom. At the boundary both position and
      // slope match the uncovered chart, so a printed line crosses continuously.
      const shoulder = u ** 6 * (7 - 6 * u);
      const ratio = 1 / zoom + (1 - 1 / zoom) * shoulder;
      offsets[2 * i] = nx * diameter / 2 * ratio;
      offsets[2 * i + 1] = ny * diameter / 2 * ratio;
      const facing = Math.max(0, -(0.48 * nx + 0.88 * ny));
      reflection[i] = 0.012 + 0.09 * facing ** 3 + u ** 22 * (0.09 + 0.51 * facing ** 4);
      glass.data[4 * i + 3] = Math.round(coverage * 255);
    }
  }
  return { size, offsets, reflection, glass };
}

export function drawLens(canvas: HTMLCanvasElement, lens: ReturnType<typeof makeLens>, chart: ImageData,
  width: number, height: number, cx: number, cy: number) {
  if (canvas.width !== lens.size || canvas.height !== lens.size) canvas.width = canvas.height = lens.size;
  const sx = chart.width / width, sy = chart.height / height;
  const pixels = lens.glass.data, source = chart.data;
  for (let i = 0; i < lens.reflection.length; i++) {
    if (!pixels[4 * i + 3]) continue;
    const x = Math.max(0, Math.min(chart.width - 1.001, (cx + lens.offsets[2 * i]) * sx - 0.5));
    const y = Math.max(0, Math.min(chart.height - 1.001, (cy + lens.offsets[2 * i + 1]) * sy - 0.5));
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const k = 4 * (iy * chart.width + ix), row = chart.width * 4;
    const light = lens.reflection[i];
    for (let c = 0; c < 3; c++) {
      const top = source[k + c] * (1 - fx) + source[k + c + 4] * fx;
      const bottom = source[k + row + c] * (1 - fx) + source[k + row + c + 4] * fx;
      pixels[4 * i + c] = (top + (bottom - top) * fy) * (1 - light) + (223 + c * 15) * light;
    }
  }
  canvas.getContext('2d')!.putImageData(lens.glass, 0, 0);
}
