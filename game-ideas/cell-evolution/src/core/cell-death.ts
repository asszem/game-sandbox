import type { Cell, SimulationEvent, SimulationState } from './types';
import { add, clamp, vec } from './vector';
import { findOpenPoint, isOpenPoint } from './world-points';

type DeathRng = {
  next: () => number;
  range: (min: number, max: number) => number;
};

export function removeDeadCells(context: {
  state: SimulationState;
  events: SimulationEvent[];
  rng: DeathRng;
  nextId: number;
}): number {
  const { state, events, rng } = context;
  let nextId = context.nextId;
  const survivors: Cell[] = [];
  for (const cell of state.cells) {
    if (cell.health > 0 && cell.atp > -10 && cell.mass > 0.16 && cell.protein > 4 && cell.damage < 100) {
      survivors.push(cell);
      continue;
    }
    events.push({
      kind: 'cell-died',
      position: { ...cell.position },
      cellId: cell.id,
      mass: cell.mass,
      radius: cell.radius,
    });
    nextId = spawnRemains(state, rng, nextId, cell);
  }
  state.cells = survivors;
  return nextId;
}

function spawnRemains(state: SimulationState, rng: DeathRng, nextId: number, cell: Cell): number {
  const pieces = clamp(Math.round(cell.mass * 3), 1, 7);
  for (let index = 0; index < pieces; index += 1) {
    const angle = rng.range(0, Math.PI * 2);
    const spread = rng.range(0.3, cell.radius * 1.4);
    const position = add(cell.position, vec(Math.cos(angle) * spread, Math.sin(angle) * spread));
    state.resources.push({
      id: nextId++,
      kind: 'amino-acid',
      position: isOpenPoint(state, position, 2) ? position : findOpenPoint(state, rng, 82, 3),
      amount: clamp(cell.mass / pieces, 0.18, 0.9),
      radius: rng.range(1.1, Math.max(1.4, cell.radius * 0.42)),
    });
  }
  return nextId;
}
