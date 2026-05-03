import type { Cell, SimulationState, Vec2 } from './types';
import { add, distance, normalize, scale, sub, vec } from './vector';

export function scanEnvironment(state: SimulationState, cell: Cell, awareness: number): Vec2 {
  let pull = vec();

  for (const resource of state.resources) {
    const d = distance(cell.position, resource.position);
    if (d > awareness) {
      continue;
    }
    const preferred = cell.searchPreference === resource.kind ? 1.8 : cell.searchPreference === 'balanced' ? 1 : 0.72;
    const need =
      resource.kind === 'glucose'
        ? 1.4 - Math.min(1, (cell.glucose + cell.glycogen * 0.45) / 80)
        : resource.kind === 'oxygen'
          ? 1.35 - Math.min(1, cell.oxygen / 55)
          : resource.kind === 'amino-acid'
            ? 1.3 - Math.min(1, cell.aminoAcids / 55)
            : 1.1 - Math.min(1, cell.lightFactor * 2);
    const value = (resource.kind === 'light' ? 0.75 : 1.25) * preferred * Math.max(0.35, need);
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
