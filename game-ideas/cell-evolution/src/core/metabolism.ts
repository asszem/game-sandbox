import type { Cell } from './types';
import { clamp, length } from './vector';

export type MetabolismBaseline = {
  atp: number;
  glucose: number;
  amino: number;
  oxygen: number;
  ros: number;
  glycogen: number;
};

export function applyCellMetabolism(cell: Cell, lightFactor: number, before: MetabolismBaseline): void {
  cell.lightFactor = Math.max(0, lightFactor);
  const photosynthesisGlucose = Math.max(0, lightFactor) * (0.35 + cell.genome.harvest * 0.25);
  cell.glucose += photosynthesisGlucose;
  cell.oxygen = clamp(cell.oxygen + lightFactor * 0.018, 0, 100);

  const storagePriority = cell.glucoseTransport ?? 0.5;
  const storageThreshold = 92 - storagePriority * 32;
  if (cell.glucose > storageThreshold && cell.glycogen < 200 && cell.atp > 1) {
    const glucoseToPack = Math.min((cell.glucose - storageThreshold) * (0.35 + storagePriority), (200 - cell.glycogen) * 2);
    cell.glucose -= glucoseToPack;
    cell.glycogen += glucoseToPack / 2;
    cell.atp -= glucoseToPack / 2;
  }

  const releaseThreshold = 4 + (1 - storagePriority) * 12;
  if (cell.glucose < releaseThreshold && cell.glycogen > 0) {
    const glucoseNeeded = releaseThreshold - cell.glucose;
    const glycogenToUnpack = Math.min(cell.glycogen, glucoseNeeded / 2);
    cell.glycogen -= glycogenToUnpack;
    cell.glucose += glycogenToUnpack * 2;
  }

  const glucoseUsed = Math.min(cell.glucose, 1);
  if (glucoseUsed > 0) {
    const oxygenNeeded = glucoseUsed * (0.28 + cell.oxygenMetabolism * 0.42);
    const oxygenUsed = Math.min(cell.oxygen, oxygenNeeded);
    const oxygenRatio = oxygenNeeded > 0 ? oxygenUsed / oxygenNeeded : 0;
    cell.glucose -= glucoseUsed;
    cell.oxygen -= oxygenUsed;
    cell.atp += 2 * glucoseUsed * oxygenRatio * (0.7 + cell.oxygenMetabolism * 0.6);
    cell.ros += (0.06 + cell.oxygenMetabolism * 0.12) * glucoseUsed * oxygenRatio;
  }

  if (cell.atp >= 1 && cell.aminoAcids >= 0.2) {
    cell.atp -= 1;
    cell.aminoAcids -= 0.2;
    cell.health = clamp(cell.health + 0.002, 0, 1);
  } else {
    cell.health -= 0.012;
  }

  if (cell.glucose <= 0.01 && cell.glycogen <= 0.01 && cell.aminoAcids > 0) {
    const autophagyAmino = Math.min(cell.aminoAcids, 2);
    cell.aminoAcids -= autophagyAmino;
    cell.mass -= autophagyAmino * 0.002;
    cell.health -= autophagyAmino * 0.003;
    cell.atp += autophagyAmino * 0.8;
    cell.autophagyRate = autophagyAmino;
  }

  const movementCost = length(cell.velocity) * (0.28 + cell.genome.motility * 0.12) * Math.pow(cell.radius / 3.2, 1.45) * (0.85 + cell.oxygenMetabolism * 0.35) * (0.72 + (cell.movementBudget ?? 0.5) * 0.7);
  cell.atp -= movementCost;
  cell.atp -= (cell.sensorBudget ?? 0.5) * 0.045;
  const repairBudget = Math.min(cell.atp, cell.aminoAcids, 0.06 + cell.ribosomeActivity * 0.16);
  if (cell.ros > 18 && repairBudget > 0) {
    cell.ros -= repairBudget * (0.55 + cell.ribosomeActivity * 0.65);
    cell.atp -= repairBudget * (0.35 + cell.ribosomeActivity * 0.45);
    cell.aminoAcids -= repairBudget * (0.35 + cell.ribosomeActivity * 0.55);
  }
  const growthBias = 1 - cell.ribosomeActivity;
  cell.mass += Math.max(0, Math.min(cell.atp - 78, cell.aminoAcids - 45)) * 0.0012 * (0.45 + growthBias * 0.75 + cell.genome.harvest * 0.4);
  if (cell.atp < 12) {
    cell.mass -= 0.0045;
    cell.aminoAcids = Math.max(0, cell.aminoAcids - 0.03);
  }
  if (cell.aminoAcids < 8) {
    cell.health -= 0.006;
  }
  cell.health -= Math.max(0, cell.ros - 45) * 0.0008;
  cell.mass = clamp(cell.mass, 0.18, 2.4);
  cell.radius = radiusForMass(cell);
  cell.atp = clamp(cell.atp, -12, 100);
  cell.glucose = clamp(cell.glucose, 0, 100);
  cell.aminoAcids = clamp(cell.aminoAcids, 0, 100);
  cell.oxygen = clamp(cell.oxygen, 0, 100);
  cell.ros = clamp(cell.ros, 0, 100);
  cell.glycogen = clamp(cell.glycogen, 0, 200);
  cell.energy = cell.atp;
  cell.health = clamp(cell.health + (cell.atp > 15 && cell.aminoAcids > 12 && cell.ros < 35 ? 0.001 : -0.006), 0, 1);
  cell.atpRate = cell.atp - before.atp;
  cell.glucoseRate = cell.glucose - before.glucose;
  cell.glycogenRate = cell.glycogen - before.glycogen;
  cell.aminoRate = cell.aminoAcids - before.amino;
  cell.oxygenRate = cell.oxygen - before.oxygen;
  cell.rosRate = cell.ros - before.ros;
}

export function radiusForMass(cell: Cell): number {
  return clamp(1.85 + Math.sqrt(cell.mass) * 2.55, 2.2, 6.4);
}
