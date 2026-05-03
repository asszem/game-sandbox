import type { Block, Cell, SimulationState, Vec2 } from './types';
import { add, distance, length, normalize, scale, vec } from './vector';

type PlacementRng = {
  next: () => number;
  range: (min: number, max: number) => number;
};

export function cellCollisionRadius(cell: Cell): number {
  return cell.radius * Math.max(1, cell.bodyLength) * 1.18 + 0.35;
}

export function findCellSpawnPoint(context: {
  state: SimulationState;
  rng: PlacementRng;
  cell: Cell;
  preferred?: Vec2;
  allowFallback?: boolean;
}): Vec2 | null {
  const { state, rng, cell, preferred, allowFallback = false } = context;
  const collisionRadius = cellCollisionRadius(cell);
  const maxCenterDistance = Math.max(0, state.boardRadius - collisionRadius);
  if (preferred) {
    const clampedPreferred = clampPointToCellBounds(preferred, state.boardRadius, collisionRadius);
    if (isCellSpawnPointOpen(state, clampedPreferred, cell)) {
      return clampedPreferred;
    }
    for (let attempt = 0; attempt < 48; attempt += 1) {
      const angle = rng.range(0, Math.PI * 2);
      const spread = Math.sqrt(rng.next()) * (collisionRadius + 18);
      const point = clampPointToCellBounds(
        add(preferred, vec(Math.cos(angle) * spread, Math.sin(angle) * spread)),
        state.boardRadius,
        collisionRadius,
      );
      if (isCellSpawnPointOpen(state, point, cell)) {
        return point;
      }
    }
  }
  for (let attempt = 0; attempt < 220; attempt += 1) {
    const point = randomDishPoint(rng, maxCenterDistance);
    if (isCellSpawnPointOpen(state, point, cell)) {
      return point;
    }
  }
  return allowFallback ? leastCrowdedCellSpawnPoint(state, rng, cell, maxCenterDistance) : null;
}

export function clampPointToCellBounds(point: Vec2, boardRadius: number, collisionRadius: number): Vec2 {
  const max = Math.max(0, boardRadius - collisionRadius);
  const d = length(point);
  return d > max ? scale(normalize(point), max) : { ...point };
}

export function randomDishPoint(rng: PlacementRng, radius: number): Vec2 {
  const angle = rng.range(0, Math.PI * 2);
  const distanceFromCenter = Math.sqrt(rng.next()) * radius;
  return vec(Math.cos(angle) * distanceFromCenter, Math.sin(angle) * distanceFromCenter);
}

function isCellSpawnPointOpen(state: SimulationState, point: Vec2, cell: Cell): boolean {
  const collisionRadius = cellCollisionRadius(cell);
  if (length(point) > state.boardRadius - collisionRadius) {
    return false;
  }
  for (const block of state.blocks) {
    if (pointNearBlockForCell(point, block, collisionRadius)) {
      return false;
    }
  }
  for (const other of state.cells) {
    if (distance(point, other.position) < collisionRadius + cellCollisionRadius(other) + 0.6) {
      return false;
    }
  }
  return true;
}

function leastCrowdedCellSpawnPoint(state: SimulationState, rng: PlacementRng, cell: Cell, maxCenterDistance: number): Vec2 {
  let best = randomDishPoint(rng, maxCenterDistance);
  let bestScore = -Infinity;
  for (let attempt = 0; attempt < 220; attempt += 1) {
    const point = randomDishPoint(rng, maxCenterDistance);
    const score = cellSpawnClearanceScore(state, point, cell);
    if (score > bestScore) {
      best = point;
      bestScore = score;
    }
  }
  return best;
}

function cellSpawnClearanceScore(state: SimulationState, point: Vec2, cell: Cell): number {
  const collisionRadius = cellCollisionRadius(cell);
  let score = state.boardRadius - collisionRadius - length(point);
  for (const block of state.blocks) {
    score = Math.min(score, distance(point, block.position) - block.radius - collisionRadius);
  }
  for (const other of state.cells) {
    score = Math.min(score, distance(point, other.position) - cellCollisionRadius(other) - collisionRadius);
  }
  return score;
}

function pointNearBlockForCell(point: Vec2, block: Block, collisionRadius: number): boolean {
  return distance(point, block.position) < block.radius + collisionRadius + 0.6;
}
