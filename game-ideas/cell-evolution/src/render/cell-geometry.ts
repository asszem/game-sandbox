import * as THREE from 'three';

export function createCellBodyGeometry(seed: number, radius: number, wobble: number): THREE.ShapeGeometry {
  const points: THREE.Vector2[] = [];
  const count = 56;
  const { stretchX, stretchY } = cellStretch(seed);

  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2;
    points.push(cellBoundaryPoint(seed, angle, radius, wobble, index, stretchX, stretchY));
  }

  const shape = new THREE.Shape(points);
  const geometry = new THREE.ShapeGeometry(shape, 12);
  geometry.computeVertexNormals();
  return geometry;
}

export function createCiliaGeometry(seed: number, time: number, speed: number): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(ciliaPositions(seed, time, speed), 3));
  return geometry;
}

export function updateCiliaGeometry(geometry: THREE.BufferGeometry, seed: number, velocity: { x: number; y: number }, time: number, running: boolean): void {
  const speed = Math.min(1, Math.hypot(velocity.x, velocity.y) * 10);
  const phase = running ? time * (0.012 + speed * 0.022) : 0;
  const attribute = geometry.getAttribute('position') as THREE.BufferAttribute;
  const positions = ciliaPositions(seed, phase, speed);
  (attribute.array as Float32Array).set(positions);
  attribute.needsUpdate = true;
}

export function seededNoise(seed: number, salt: number): number {
  const value = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
}

function ciliaPositions(seed: number, time: number, speed: number): number[] {
  const positions: number[] = [];
  const count = 76;
  const { stretchX, stretchY } = cellStretch(seed);
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2;
    const root = cellBoundaryPoint(seed, angle, 1.045, 0.16, index, stretchX, stretchY);
    const normal = new THREE.Vector2(Math.cos(angle) / stretchX, Math.sin(angle) / stretchY).normalize();
    const tangent = new THREE.Vector2(-normal.y, normal.x);
    const beat = Math.sin(time + index * 0.55 + seed * 0.013);
    const rearSweep = -speed * (0.028 + Math.max(0, Math.cos(angle)) * 0.035);
    const sideSweep = beat * (0.016 + speed * 0.026);
    const length = 0.018 + Math.abs(seededNoise(seed, index + 90)) * 0.018 + speed * 0.014;
    const tip = root
      .clone()
      .add(normal.multiplyScalar(length))
      .add(tangent.multiplyScalar(sideSweep))
      .add(new THREE.Vector2(rearSweep, beat * 0.006 * speed));
    positions.push(root.x, root.y, 0.32, tip.x, tip.y, 0.32);
  }
  return positions;
}

function cellBoundaryPoint(
  seed: number,
  angle: number,
  radius: number,
  wobble: number,
  index: number,
  stretchX: number,
  stretchY: number,
): THREE.Vector2 {
  const waveA = Math.sin(angle * 3 + seed * 0.017) * wobble;
  const waveB = Math.cos(angle * 5 + seed * 0.011) * wobble * 0.55;
  const noise = seededNoise(seed, index + 10) * wobble * 0.7;
  const r = radius * (1 + waveA + waveB + noise);
  return new THREE.Vector2(Math.cos(angle) * r * stretchX, Math.sin(angle) * r * stretchY);
}

function cellStretch(seed: number): { stretchX: number; stretchY: number } {
  return {
    stretchX: 1.04 + seededNoise(seed, 1) * 0.06,
    stretchY: 0.78 + seededNoise(seed, 2) * 0.05,
  };
}
