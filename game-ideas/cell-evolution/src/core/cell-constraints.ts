import type { Block, Cell, SimulationState, Vec2 } from './types';
import { add, distance, length, normalize, scale, sub, vec } from './vector';
import { cellCollisionRadius } from './spawn-placement';

export function keepBlockInDish(block: Block, boardRadius: number): void {
  const max = Math.max(0, boardRadius - block.radius - 2);
  const d = length(block.position);
  if (d > max) {
    block.position = d > 0.001 ? scale(normalize(block.position), max) : vec();
  }
}

export function constrainCellToDishAndBlocks(state: SimulationState, cell: Cell): void {
  keepCellInDish(state, cell);
  resolveBlockCollisions(state, cell);
  keepCellInDish(state, cell);
}

export function keepCellInDish(state: SimulationState, cell: Cell): void {
  const d = length(cell.position);
  const max = Math.max(0, state.boardRadius - cellCollisionRadius(cell));
  if (d > max) {
    const inward = scale(normalize(cell.position), max);
    cell.position = inward;
    cell.velocity = scale(cell.velocity, -0.25);
    cell.energy -= 0.25;
  }
}

export function resolveBlockCollisions(state: SimulationState, cell: Cell): void {
  for (const block of state.blocks) {
    const d = distance(cell.position, block.position);
    const minDistance = block.radius + cellCollisionRadius(cell);
    if (d < minDistance) {
      const push = cellPushDirection(cell, block.position);
      cell.position = add(cell.position, scale(push, minDistance - d + 0.08));
      cell.velocity = scale(cell.velocity, -0.2);
    }
  }
}

function cellPushDirection(cell: Cell, origin: Vec2): Vec2 {
  const away = sub(cell.position, origin);
  if (length(away) > 0.001) {
    return normalize(away);
  }
  if (length(cell.velocity) > 0.001) {
    return normalize(cell.velocity);
  }
  return normalize(origin.x === 0 && origin.y === 0 ? vec(1, 0) : origin);
}
