import type { SimulationState, Vec2 } from '../core/types';
import { pointInBlock } from './blocks';
import type { MapPick } from './types';

export function pickAtWorldPoint(point: Vec2, state: SimulationState): MapPick {
  let target: MapPick = { kind: 'dish', id: null };
  let best = Infinity;

  const consider = (candidate: MapPick, distance: number): void => {
    if (distance < best) {
      target = candidate;
      best = distance;
    }
  };

  for (const cell of state.cells) {
    const d = Math.hypot(point.x - cell.position.x, point.y - cell.position.y);
    if (d <= cell.radius * cell.bodyLength * 1.25) {
      consider({ kind: 'cell', id: cell.id }, d);
    }
  }

  for (const resource of state.resources) {
    const d = Math.hypot(point.x - resource.position.x, point.y - resource.position.y);
    if (d <= Math.max(resource.radius * 1.35, 2.8)) {
      consider({ kind: 'resource', id: resource.id }, d + 0.2);
    }
  }

  for (const hazard of state.hazards) {
    const d = Math.hypot(point.x - hazard.position.x, point.y - hazard.position.y);
    if (d <= hazard.radius * 1.25) {
      consider({ kind: 'hazard', id: hazard.id }, d + 0.4);
    }
  }

  for (const block of state.blocks) {
    if (pointInBlock(point, block)) {
      const dx = Math.abs(point.x - block.position.x);
      const dy = Math.abs(point.y - block.position.y);
      consider({ kind: 'block', id: block.id }, Math.max(dx, dy) + 0.6);
    }
  }

  return target;
}
