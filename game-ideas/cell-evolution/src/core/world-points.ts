import type { Block, SimulationState, Vec2 } from './types';
import { add, distance, length, normalize, scale, vec } from './vector';
import { randomDishPoint } from './spawn-placement';

type PointRng = {
  next: () => number;
  range: (min: number, max: number) => number;
};

export function findOpenPoint(state: SimulationState, rng: PointRng, radius: number, clearance: number): Vec2 {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const point = randomDishPoint(rng, radius);
    if (isOpenPoint(state, point, clearance)) {
      return point;
    }
  }
  return randomDishPoint(rng, radius * 0.65);
}

export function isOpenPoint(state: SimulationState, point: Vec2, clearance: number): boolean {
  for (const block of state.blocks) {
    if (pointNearBlock(point, block, clearance)) {
      return false;
    }
  }
  for (const cell of state.cells) {
    if (distance(point, cell.position) < clearance + cell.radius * cell.bodyLength) {
      return false;
    }
  }
  for (const resource of state.resources) {
    if (distance(point, resource.position) < clearance + resource.radius) {
      return false;
    }
  }
  return true;
}

export function pointNearBlock(point: Vec2, block: Block, clearance: number): boolean {
  return distance(point, block.position) < block.radius + clearance;
}

export function scatterPoint(state: SimulationState, rng: PointRng, center: Vec2, radius: number): Vec2 {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const angle = rng.range(0, Math.PI * 2);
    const spread = Math.sqrt(rng.next()) * radius;
    const point = add(center, vec(Math.cos(angle) * spread, Math.sin(angle) * spread));
    if (length(point) <= state.boardRadius - 4 && !state.blocks.some((block) => pointNearBlock(point, block, 1.2))) {
      return point;
    }
  }
  const max = state.boardRadius - 5;
  return length(center) > max ? scale(normalize(center), max) : center;
}
