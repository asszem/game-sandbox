import type { Cell, ResourceKind, Vec2 } from '../core/types';
import { distance } from '../core/vector';
import type { TutorialStep } from './tutorial';

type TutorialScenarioContext = {
  cell: Cell;
  spawnResource: (kind: ResourceKind, position: Vec2, message: string) => void;
  spawnHazard: (position: Vec2, potency: number) => void;
  spawnBlock: (position: Vec2, width: number, height: number) => void;
  spawnCell: (position: Vec2, generation: number) => Cell;
  offsetPoint: (origin: Vec2, dx: number, dy: number) => Vec2;
  showToast: (message: string) => void;
};

export function prepareTutorialScenario(step: TutorialStep, context: TutorialScenarioContext): void {
  const { cell, offsetPoint, showToast, spawnBlock, spawnCell, spawnHazard, spawnResource } = context;

  if (step.id === 'atp') {
    Object.assign(cell, { position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, atp: 72, glucose: 92, oxygen: 88, aminoAcids: 76, ros: 5, oxygenMetabolism: 0.35 });
  }
  if (step.id === 'glucose') {
    Object.assign(cell, { velocity: { x: 0, y: 0 }, atp: Math.max(cell.atp, 82), glucose: Math.min(cell.glucose, 18), oxygen: Math.max(cell.oxygen, 75), aminoAcids: Math.max(cell.aminoAcids, 70), glucoseTransport: 0.35 });
    spawnResource('glucose', offsetPoint(cell.position, 24, 0), 'Glucose dropped');
  }
  if (step.id === 'amino') {
    Object.assign(cell, { velocity: { x: 0, y: 0 }, atp: Math.max(cell.atp, 86), glucose: Math.max(cell.glucose, 72), oxygen: Math.max(cell.oxygen, 70), aminoAcids: Math.min(cell.aminoAcids, 18), aminoTransport: 0.35 });
    spawnResource('amino-acid', offsetPoint(cell.position, 24, 8), 'Amino-acid cluster dropped');
  }
  if (step.id === 'light') {
    Object.assign(cell, { velocity: { x: 0, y: 0 }, atp: Math.max(cell.atp, 80), glucose: Math.max(cell.glucose, 45), oxygen: Math.max(cell.oxygen, 55), aminoAcids: Math.max(cell.aminoAcids, 65) });
    spawnResource('light', offsetPoint(cell.position, 20, -8), 'Light source dropped');
  }
  if (step.id === 'poison') {
    Object.assign(cell, { velocity: { x: 0, y: 0 }, atp: Math.max(cell.atp, 84), glucose: Math.max(cell.glucose, 70), oxygen: Math.max(cell.oxygen, 70), aminoAcids: Math.max(cell.aminoAcids, 72) });
    spawnHazard(offsetPoint(cell.position, 28, 0), 0.7);
    showToast('Poison cloud dropped');
  }
  if (step.id === 'rock') {
    Object.assign(cell, { velocity: { x: 0, y: 0 }, atp: Math.max(cell.atp, 86), glucose: Math.max(cell.glucose, 72), oxygen: Math.max(cell.oxygen, 70), aminoAcids: Math.max(cell.aminoAcids, 72) });
    spawnBlock(offsetPoint(cell.position, 24, 0), 8, 7);
    spawnResource('glucose', offsetPoint(cell.position, 42, 0), 'Rock and glucose dropped');
  }
  if (step.id === 'directives') {
    Object.assign(cell, { velocity: { x: 0, y: 0 }, atp: Math.max(cell.atp, 88), glucose: Math.max(cell.glucose, 75), oxygen: Math.max(cell.oxygen, 70), aminoAcids: Math.max(cell.aminoAcids, 74) });
    const neighbor = spawnCell(offsetPoint(cell.position, 20, -10), 0);
    neighbor.radius = Math.max(2.4, cell.radius * 0.82);
    const rival = spawnCell(offsetPoint(cell.position, 31, 9), 0);
    rival.radius = Math.max(cell.radius * 1.02, 3.2);
    showToast('Neighbor cells dropped');
  }
}

export function offsetTutorialPoint(boardRadius: number, origin: Vec2, dx: number, dy: number): Vec2 {
  const point = { x: origin.x + dx, y: origin.y + dy };
  const max = Math.max(0, boardRadius - 8);
  const d = distance(point, { x: 0, y: 0 });
  return d > max ? { x: (point.x / d) * max, y: (point.y / d) * max } : point;
}
