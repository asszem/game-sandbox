import type { Cell, ResourceKind, Vec2 } from '../core/types';
import { distance } from '../core/vector';
import type { TutorialStep } from './tutorial';

type TutorialScenarioContext = {
  cell: Cell;
  spawnResource: (kind: ResourceKind, position: Vec2, message: string) => void;
  offsetPoint: (origin: Vec2, dx: number, dy: number) => Vec2;
};

export function prepareTutorialScenario(step: TutorialStep, context: TutorialScenarioContext): void {
  const { cell, offsetPoint, spawnResource } = context;

  if (step.id === 'atp') {
    Object.assign(cell, { position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, atp: 72, glucose: 0, glucose6Phosphate: 100, pyruvate: 0, oxygen: 0, aminoAcids: 76, glycogen: 0, ros: 0, oxygenMetabolism: 0, sensorBudget: 0.4, movementBudget: 0.5, searchPreference: 'glucose' });
  }
  if (step.id === 'glucose') {
    Object.assign(cell, { velocity: { x: 0, y: 0 }, atp: Math.max(cell.atp, 82), glucose: 0, glucose6Phosphate: 18, oxygen: 0, aminoAcids: Math.max(cell.aminoAcids, 70), glycogen: 0, glucoseTransport: 0.35, searchPreference: 'glucose' });
    spawnResource('glucose', offsetPoint(cell.position, 24, 0), 'Glucose dropped');
  }
}

export function offsetTutorialPoint(boardRadius: number, origin: Vec2, dx: number, dy: number): Vec2 {
  const point = { x: origin.x + dx, y: origin.y + dy };
  const max = Math.max(0, boardRadius - 8);
  const d = distance(point, { x: 0, y: 0 });
  return d > max ? { x: (point.x / d) * max, y: (point.y / d) * max } : point;
}
