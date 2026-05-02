import type { Cell, SimulationState, Vec2 } from './types';
import { add, distance, normalize, scale, sub, vec } from './vector';

export function scanEnvironment(state: SimulationState, cell: Cell, awareness: number): Vec2 {
  let pull = vec();

  for (const resource of state.resources) {
    const d = distance(cell.position, resource.position);
    if (d > awareness) {
      continue;
    }
    const value = resource.kind === 'light' ? 0.75 : 1.25;
    pull = add(pull, scale(normalize(sub(resource.position, cell.position)), value * (1 - d / awareness) * cell.genome.harvest));
  }

  for (const hazard of state.hazards) {
    const d = distance(cell.position, hazard.position);
    if (d < awareness + hazard.radius) {
      pull = add(pull, scale(normalize(sub(cell.position, hazard.position)), (1.5 - d / awareness) * cell.genome.caution * 1.8));
    }
  }

  for (const other of state.cells) {
    if (other === cell) {
      continue;
    }
    const d = distance(cell.position, other.position);
    if (d < awareness) {
      const direction = normalize(sub(other.position, cell.position));
      const predatory = cell.radius > other.radius * 1.08 && cell.genome.predator > 0.4;
      pull = add(pull, scale(direction, predatory ? cell.genome.predator : -0.15));
    }
  }

  return pull;
}
