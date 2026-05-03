import type { Cell } from './types';
import { clamp } from './vector';

export type SensingProfile = {
  radius: number;
  clarity: number;
  processing: number;
};

export function sensingProfile(cell: Cell): SensingProfile {
  const sensorBudget = cell.sensorBudget ?? 0.5;
  const baseRadius = (16 + cell.radius * 3.4 + cell.genome.caution * 16) * (0.72 + sensorBudget * 0.62);
  const atpResolution = clamp(cell.atp / 80, 0.18, 1.25);
  const aminoIntegrity = clamp(cell.aminoAcids / 45, 0.25, 1.15);
  const oxygenProcessing = clamp(cell.oxygen / 35, 0.35, 1.15);
  const rosIntegrity = clamp(1 - Math.max(0, cell.ros - 18) / 82, 0.35, 1);
  const healthIntegrity = clamp(cell.health, 0.3, 1);
  const radius = baseRadius
    * clamp(0.3 + atpResolution * 0.7, 0.3, 1.18)
    * clamp(0.68 + oxygenProcessing * 0.32, 0.68, 1.08)
    * clamp(0.78 + rosIntegrity * 0.22, 0.55, 1);
  const clarity = clamp(
    aminoIntegrity * 0.42
      + atpResolution * 0.24
      + oxygenProcessing * 0.16
      + rosIntegrity * 0.12
      + healthIntegrity * 0.06,
    0.15,
    1,
  );
  return {
    radius,
    clarity,
    processing: clamp(oxygenProcessing * rosIntegrity * (0.72 + sensorBudget * 0.48), 0.2, 1),
  };
}

export function awarenessRadius(cell: Cell): number {
  return sensingProfile(cell).radius;
}
