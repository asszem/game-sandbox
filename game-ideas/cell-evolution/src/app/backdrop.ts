export function drawMicroscopeBackdrop(canvas: HTMLCanvasElement | null): void {
  if (!canvas) {
    return;
  }
  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(62, 110, 105, 0.18)';
  ctx.fillRect(0, 0, width, height);

  let seed = 1138;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let index = 0; index < 95; index += 1) {
    const hue = 150 + random() * 58;
    ctx.strokeStyle = `hsla(${hue}, 40%, 72%, ${0.035 + random() * 0.045})`;
    ctx.lineWidth = 1 + random() * 2.4;
    ctx.beginPath();
    const x = random() * width;
    const y = random() * height;
    ctx.ellipse(x, y, 90 + random() * 290, 5 + random() * 26, random() * Math.PI, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (let index = 0; index < 34; index += 1) {
    ctx.strokeStyle = `rgba(180, 225, 206, ${0.025 + random() * 0.035})`;
    ctx.lineWidth = 1 + random() * 1.8;
    ctx.beginPath();
    const startX = random() * width;
    const startY = random() * height;
    ctx.moveTo(startX, startY);
    ctx.lineTo(startX + (random() - 0.5) * width * 1.4, startY + (random() - 0.5) * height * 1.4);
    ctx.stroke();
  }
}
