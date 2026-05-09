import type { CellSimulation } from '../core/simulation';
import type { ResourceKind, Vec2 } from '../core/types';
import type { MapPick } from '../render/types';
import { defaultDishSize, tutorialDishPlacement } from './dish-layout';
import { DishManager } from './dish-manager';
import type { DishInstance } from './dish-types';

export function createTutorialDish(dishManager: DishManager, viewportWidth: number, viewportHeight: number): {
  dish: DishInstance;
  target: MapPick;
} {
  const size = defaultDishSize(viewportWidth, 430);
  const placement = tutorialDishPlacement(dishManager.dishes.length, size, viewportWidth, viewportHeight);
  const dish = dishManager.createDish({
    name: 'Tutorial Dish',
    ...placement,
    size,
    select: true,
    setup: {
      cellComplexity: 1,
      cellCount: 1,
      resourceCounts: { glucose: 0, 'amino-acid': 0, oxygen: 0, light: 0 },
      hazardCount: 0,
      blockCount: 0,
    },
  });
  const cell = tutorialCell(dish);
  if (!cell) {
    return { dish, target: { kind: 'dish', id: null } };
  }

  Object.assign(cell, {
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    atp: 20,
    energy: 20,
    glucose: 0,
    glucose6Phosphate: 0,
    pyruvate: 0,
    oxygen: 0,
    aminoAcids: 76,
    glycogen: 0,
    ros: 5,
    health: 1,
    glucoseTransport: 0.35,
    aminoTransport: 0.35,
    oxygenMetabolism: 0,
    sensorBudget: 0,
    movementBudget: 0,
    searchPreference: 'none',
    ribosomeActivity: 0.5,
  });
  return { dish, target: { kind: 'cell', id: cell.id } };
}

export function tutorialCell(dish: DishInstance | null): DishInstance['simulation']['state']['cells'][number] | null {
  return dish?.simulation.state.cells[0] ?? null;
}

export function spawnTutorialResource(
  simulation: CellSimulation,
  kind: ResourceKind,
  position: Vec2,
  message: string,
  showToast: (message: string) => void,
): void {
  simulation.spawnResource(kind, position, 1);
  showToast(message);
}
