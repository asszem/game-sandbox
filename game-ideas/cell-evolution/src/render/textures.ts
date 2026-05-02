import * as THREE from 'three';

export function createDishTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }
  ctx.fillStyle = '#153d43';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < 160; i += 1) {
    const hue = 145 + Math.random() * 115;
    ctx.strokeStyle = `hsla(${hue}, 95%, 63%, ${0.035 + Math.random() * 0.07})`;
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    ctx.ellipse(x, y, 20 + Math.random() * 95, 2 + Math.random() * 8, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.stroke();
  }
  return new THREE.CanvasTexture(canvas);
}

export function createMicroscopeBackdropTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 640;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }
  const gradient = ctx.createRadialGradient(512, 320, 40, 512, 320, 560);
  gradient.addColorStop(0, '#274d4f');
  gradient.addColorStop(0.58, '#142c31');
  gradient.addColorStop(1, '#071217');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < 90; index += 1) {
    ctx.strokeStyle = `rgba(184, 238, 220, ${0.018 + Math.random() * 0.035})`;
    ctx.lineWidth = 1 + Math.random() * 2.2;
    ctx.beginPath();
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    ctx.ellipse(x, y, 80 + Math.random() * 260, 8 + Math.random() * 26, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let index = 0; index < 3500; index += 1) {
    const value = 80 + Math.random() * 90;
    ctx.fillStyle = `rgba(${value}, ${value + 22}, ${value + 16}, ${Math.random() * 0.04})`;
    ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 1, 1);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}
