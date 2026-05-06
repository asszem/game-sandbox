import type { Cell } from './types';
import { clamp, length } from './vector';

export type MetabolismBaseline = {
  atp: number;
  glucose: number;
  glucose6Phosphate?: number;
  pyruvate?: number;
  lactate?: number;
  amino: number;
  protein?: number;
  oxygen: number;
  ros: number;
  damage?: number;
  glycogen: number;
  health?: number;
};

export type MetabolicPreview = {
  atp: number;
  glucose: number;
  glucose6Phosphate: number;
  pyruvate: number;
  lactate: number;
  glycogen: number;
  amino: number;
  protein: number;
  oxygen: number;
  ros: number;
  damage: number;
  health: number;
  glycolysis: number;
  respiration: number;
  fermentation: number;
  gluconeogenesis: number;
  glycogenesis: number;
  glycogenMobilization: number;
  autophagy: number;
  biosynthesis: number;
  antioxidant: number;
};

type MetabolismSnapshot = {
  atp: number;
  glucose: number;
  glucose6Phosphate: number;
  pyruvate: number;
  lactate: number;
  amino: number;
  protein: number;
  oxygen: number;
  ros: number;
  damage: number;
  glycogen: number;
  health: number;
};

const COMPLEXITY_ONE_UPKEEP_COST = 0.12;
const COMPLEXITY_ONE_SENSOR_COST = 0.03;
const COMPLEXITY_ONE_GLYCOLYSIS_ATP_COST = 0.02;

export function applyCellMetabolism(cell: Cell, lightFactor: number, before: MetabolismBaseline): void {
  runMetabolismPipeline(cell, lightFactor);
  recordMetabolismRates(cell, before);
}

export function applyComplexityOneMetabolism(cell: Cell, before: MetabolismBaseline): void {
  runComplexityOnePipeline(cell);
  recordMetabolismRates(cell, before);
}

export function previewCellMetabolism(cell: Cell, complexity = 1): MetabolicPreview {
  const preview = cloneCellForPreview(cell);
  const before = baselineFromCell(preview);
  if (complexity <= 1) {
    runComplexityOnePipeline(preview);
  } else {
    runMetabolismPipeline(preview, preview.lightFactor);
  }
  return {
    atp: preview.atp - before.atp,
    glucose: preview.glucose - before.glucose,
    glucose6Phosphate: preview.glucose6Phosphate - before.glucose6Phosphate,
    pyruvate: preview.pyruvate - before.pyruvate,
    lactate: preview.lactate - before.lactate,
    glycogen: preview.glycogen - before.glycogen,
    amino: preview.aminoAcids - before.amino,
    protein: preview.protein - before.protein,
    oxygen: preview.oxygen - before.oxygen,
    ros: preview.ros - before.ros,
    damage: preview.damage - before.damage,
    health: preview.health - before.health,
    glycolysis: preview.glycolysisRate,
    respiration: preview.respirationRate,
    fermentation: preview.fermentationRate,
    gluconeogenesis: preview.gluconeogenesisRate,
    glycogenesis: preview.glycogenesisRate,
    glycogenMobilization: preview.glycogenMobilizationRate,
    autophagy: preview.autophagyRate,
    biosynthesis: preview.biosynthesisRate,
    antioxidant: preview.antioxidantRate,
  };
}

function runComplexityOnePipeline(cell: Cell): void {
  const before = snapshotCell(cell);
  resetMetabolismRates(cell);
  cell.searchPreference = 'glucose';
  cell.sensorBudget = 0.4;
  cell.oxygenMetabolism = 0;
  cell.aminoTransport = 0;
  cell.ribosomeActivity = 0;
  cell.lightFactor = 0;
  cell.pyruvate = 0;
  cell.lactate = 0;
  cell.oxygen = 0;
  cell.ros = 0;
  cell.damage = 0;
  cell.glycogen = 0;
  transferFreeGlucoseToG6P(cell);
  runComplexityOneGlycolysis(cell);
  payComplexityOneCosts(cell);
  computeComplexityOneHealth(cell);
  clampMetabolicState(cell);
  cell.pyruvate = 0;
  cell.lactate = 0;
  cell.oxygen = 0;
  cell.ros = 0;
  cell.damage = 0;
  cell.glycogen = 0;
  cell.stressSignal = 0;
  recordInternalRates(cell, before);
}

function runMetabolismPipeline(cell: Cell, lightFactor: number): void {
  const before = snapshotCell(cell);
  resetMetabolismRates(cell);
  applyPhotosynthesis(cell, lightFactor);
  transferFreeGlucoseToG6P(cell);
  mobilizeGlycogenIfNeeded(cell);
  runGlycolysis(cell);
  branchPyruvate(cell);
  payMovementAndSensorCosts(cell);
  runAntioxidantDefense(cell);
  runAutophagyIfStressed(cell);
  runBiosynthesis(cell);
  runGluconeogenesisIfNeeded(cell);
  storeGlycogenSurplus(cell);
  applyDamageAndStress(cell);
  computeOverallHealth(cell);
  clampMetabolicState(cell);
  recordInternalRates(cell, before);
}

function runComplexityOneGlycolysis(cell: Cell): void {
  const used = Math.min(cell.glucose6Phosphate, 1);
  if (used <= 0) {
    return;
  }
  cell.glucose6Phosphate -= used;
  cell.atp += used * 0.65;
  cell.atp -= glycolysisAtpCostPerTick(cell, 1, used);
  cell.glycolysisRate = used;
}

function resetMetabolismRates(cell: Cell): void {
  cell.atpRate = 0;
  cell.glucoseRate = 0;
  cell.glycogenRate = 0;
  cell.glycolysisRate = 0;
  cell.respirationRate = 0;
  cell.fermentationRate = 0;
  cell.gluconeogenesisRate = 0;
  cell.glycogenesisRate = 0;
  cell.glycogenMobilizationRate = 0;
  cell.autophagyRate = 0;
  cell.aminoRate = 0;
  cell.proteinRate = 0;
  cell.biosynthesisRate = 0;
  cell.oxygenRate = 0;
  cell.rosRate = 0;
  cell.antioxidantRate = 0;
  cell.damageRate = 0;
  cell.healthRate = 0;
}

function applyPhotosynthesis(cell: Cell, lightFactor: number): void {
  cell.lightFactor = Math.max(0, lightFactor);
  const glucose = cell.lightFactor * (0.35 + cell.genome.harvest * 0.25);
  cell.glucose += glucose;
  cell.oxygen += cell.lightFactor * 0.018;
}

function transferFreeGlucoseToG6P(cell: Cell): void {
  const converted = Math.min(cell.glucose, 1.4 + cell.genome.harvest * 0.35);
  cell.glucose -= converted;
  cell.glucose6Phosphate += converted;
}

function mobilizeGlycogenIfNeeded(cell: Cell): void {
  const storagePriority = cell.glucoseTransport ?? 0.5;
  const lowEnergy = cell.atp < 24;
  const lowHub = cell.glucose6Phosphate < 0.8 + (1 - storagePriority) * 0.6;
  if ((!lowEnergy && !lowHub) || cell.glycogen <= 0) {
    return;
  }
  const mobilized = Math.min(cell.glycogen, 0.45 + (1 - storagePriority) * 0.85 + Math.max(0, 24 - cell.atp) * 0.015);
  cell.glycogen -= mobilized;
  cell.glucose6Phosphate += mobilized * 1.8;
  cell.glycogenMobilizationRate = mobilized;
}

function runGlycolysis(cell: Cell): void {
  const used = Math.min(cell.glucose6Phosphate, 1 + cell.oxygenMetabolism * 0.25);
  if (used <= 0) {
    return;
  }
  cell.glucose6Phosphate -= used;
  cell.pyruvate += used * 0.9;
  cell.atp += used * 0.65;
  cell.glycolysisRate = used;
}

function branchPyruvate(cell: Cell): void {
  const pyruvateAvailable = cell.pyruvate;
  if (pyruvateAvailable <= 0) {
    cell.lactate *= 0.965;
    return;
  }

  const oxygenPerPyruvate = 0.45;
  const respirationDemand = pyruvateAvailable * (0.2 + cell.oxygenMetabolism * 0.8);
  const respired = Math.min(pyruvateAvailable, respirationDemand, cell.oxygen / oxygenPerPyruvate);
  if (respired > 0) {
    cell.pyruvate -= respired;
    cell.oxygen -= respired * oxygenPerPyruvate;
    cell.atp += respired * (2.2 + cell.oxygenMetabolism * 0.9);
    cell.ros += respired * (0.08 + cell.oxygenMetabolism * 0.18);
    cell.respirationRate = respired;
  }

  const fermented = Math.min(cell.pyruvate, 0.55 + (1 - cell.oxygenMetabolism) * 0.45);
  if (fermented > 0) {
    cell.pyruvate -= fermented;
    cell.atp += fermented * 0.45;
    cell.lactate += fermented * 0.6;
    cell.fermentationRate = fermented;
  }
  cell.lactate *= 0.965;
}

function payMovementAndSensorCosts(cell: Cell): void {
  cell.atp -= movementAtpCostPerTick(cell, 2);
  cell.atp -= sensorAtpCostPerTick(cell, 2);
}

function payComplexityOneCosts(cell: Cell): void {
  cell.atp -= COMPLEXITY_ONE_UPKEEP_COST;
  cell.atp -= sensorAtpCostPerTick(cell, 1);
  cell.atp -= movementAtpCostPerTick(cell, 1);
}

function runAntioxidantDefense(cell: Cell): void {
  if (cell.ros <= 18 || cell.atp <= 0 || cell.aminoAcids <= 0) {
    return;
  }
  const capacity = Math.min(cell.atp, cell.aminoAcids, 0.05 + cell.ribosomeActivity * 0.18);
  const reduction = Math.min(cell.ros - 18, capacity * (0.7 + cell.ribosomeActivity * 0.8));
  cell.ros -= reduction;
  cell.atp -= capacity * 0.55;
  cell.aminoAcids -= capacity * 0.25;
  cell.antioxidantRate = reduction;
}

function runAutophagyIfStressed(cell: Cell): void {
  const fuelEmpty = cell.glucose < 1 && cell.glucose6Phosphate < 0.4 && cell.glycogen < 1.2;
  const stressFactor = Math.max(
    cell.atp < 10 ? (10 - cell.atp) / 10 : 0,
    cell.damage > 45 ? (cell.damage - 45) / 45 : 0,
    cell.stressSignal > 50 ? (cell.stressSignal - 50) / 50 : 0,
    fuelEmpty && cell.atp < 16 ? 0.45 : 0,
  );
  if (stressFactor <= 0 || cell.protein <= 12) {
    return;
  }
  const proteinBroken = Math.min(cell.protein - 12, 0.2 + stressFactor * 0.8);
  cell.protein -= proteinBroken;
  cell.aminoAcids += proteinBroken * 0.75;
  cell.damage += proteinBroken * 0.12;
  cell.autophagyRate = proteinBroken;
}

function runBiosynthesis(cell: Cell): void {
  if (cell.atp <= 1 || cell.aminoAcids <= 0.2) {
    return;
  }
  const proteinNeed = Math.max(0, 82 - cell.protein);
  const repairPriority = cell.ribosomeActivity ?? 0.5;
  const proteinSynthesis = Math.min(
    cell.aminoAcids,
    cell.atp * 0.35,
    0.08 + repairPriority * 0.22,
    Math.max(0.04, proteinNeed * 0.04),
  );
  if (proteinSynthesis > 0 && proteinNeed > 0) {
    cell.protein += proteinSynthesis;
    cell.aminoAcids -= proteinSynthesis;
    cell.atp -= proteinSynthesis * 0.9;
    cell.biosynthesisRate += proteinSynthesis;
  }

  const growthBias = 1 - repairPriority;
  const growthBudget = Math.max(0, Math.min(cell.atp - 78, cell.aminoAcids - 45, cell.protein - 65));
  const growth = growthBudget * 0.001 * (0.42 + growthBias * 0.72 + cell.genome.harvest * 0.36);
  if (growth > 0 && cell.damage < 24 && cell.ros < 42) {
    cell.mass += growth;
    cell.aminoAcids -= growth * 4.2;
    cell.atp -= growth * 3.4;
    cell.biosynthesisRate += growth;
  }
}

function runGluconeogenesisIfNeeded(cell: Cell): void {
  const depletedGlucose = cell.glucose6Phosphate < 0.6 && cell.glucose < 3 && cell.glycogen < 4;
  if (!depletedGlucose || cell.aminoAcids <= 12 || cell.atp <= 6) {
    return;
  }
  const aminoUsed = Math.min(cell.aminoAcids - 10, 0.35);
  cell.aminoAcids -= aminoUsed;
  cell.atp -= aminoUsed * 0.45;
  cell.glucose6Phosphate += aminoUsed * 0.65;
  cell.gluconeogenesisRate = aminoUsed;
}

function storeGlycogenSurplus(cell: Cell): void {
  const storagePriority = cell.glucoseTransport ?? 0.5;
  const threshold = 3 + (1 - storagePriority) * 3;
  if (cell.glucose6Phosphate <= threshold || cell.glycogen >= 200 || cell.atp <= 8) {
    return;
  }
  const storedG6P = Math.min(cell.glucose6Phosphate - threshold, (200 - cell.glycogen) * 1.8, 0.35 + storagePriority * 0.9);
  cell.glucose6Phosphate -= storedG6P;
  cell.glycogen += storedG6P * 0.55;
  cell.atp -= storedG6P * 0.22;
  cell.glycogenesisRate = storedG6P;
}

function applyDamageAndStress(cell: Cell): void {
  const rosDamage = Math.max(0, cell.ros - 28) * 0.012;
  const lactateStress = Math.max(0, cell.lactate - 6) * 0.004;
  const proteinStress = Math.max(0, 24 - cell.protein) * 0.012;
  const starvationStress = cell.atp < 8 && cell.glucose < 1 && cell.glucose6Phosphate < 0.4 && cell.glycogen < 1 ? 0.18 : 0;
  cell.damage += rosDamage + lactateStress + proteinStress + starvationStress;
  if (cell.atp > 20 && cell.protein > 55 && cell.ros < 30) {
    cell.damage -= 0.06 + cell.ribosomeActivity * 0.08;
  }
  cell.stressSignal += (rosDamage + starvationStress + Math.max(0, cell.damage - 45) * 0.004) * 2.2;
  cell.stressSignal *= 0.94;
}

function computeOverallHealth(cell: Cell): void {
  const energyScore = clamp(cell.atp / 65, 0, 1.2);
  const buildingScore = clamp(cell.aminoAcids / 45, 0, 1.1);
  const proteinScore = clamp(cell.protein / 70, 0, 1.1);
  const positiveHomeostasis = Math.min(energyScore, buildingScore, proteinScore) * (cell.ros < 35 ? 1 : 0.55);
  const damagePressure = clamp(cell.damage / 60, 0, 1.4);
  const rosPressure = clamp(Math.max(0, cell.ros - 28) / 60, 0, 1.2);
  const starvationPressure = cell.glucose < 1 && cell.glucose6Phosphate < 0.4 && cell.glycogen < 1 && cell.atp < 18 ? 0.8 : 0;
  const structuralPressure = clamp(Math.max(0, 28 - cell.protein) / 28, 0, 1);
  cell.health += positiveHomeostasis * 0.003;
  cell.health -= (damagePressure + rosPressure + starvationPressure + structuralPressure + cell.autophagyRate * 0.2) * 0.006;
}

function computeComplexityOneHealth(cell: Cell): void {
  const glucoseReserve = cell.glucose + cell.glucose6Phosphate;
  const energyScore = clamp(cell.atp / 50, 0, 1.2);
  const glucoseScore = clamp(glucoseReserve / 30, 0, 1.1);
  const positiveHomeostasis = Math.min(energyScore, glucoseScore);
  const starvationPressure = Math.max(0, 8 - cell.atp) / 8 + Math.max(0, 2 - glucoseReserve) / 2;
  cell.health += positiveHomeostasis * 0.0035;
  cell.health -= starvationPressure * 0.01;
}

function clampMetabolicState(cell: Cell): void {
  cell.mass = clamp(cell.mass, 0.18, 2.4);
  cell.radius = radiusForMass(cell);
  cell.atp = clamp(cell.atp, -12, 100);
  cell.glucose = clamp(cell.glucose, 0, 100);
  cell.glucose6Phosphate = clamp(cell.glucose6Phosphate, 0, 100);
  cell.pyruvate = clamp(cell.pyruvate, 0, 100);
  cell.lactate = clamp(cell.lactate, 0, 100);
  cell.aminoAcids = clamp(cell.aminoAcids, 0, 100);
  cell.protein = clamp(cell.protein, 0, 100);
  cell.oxygen = clamp(cell.oxygen, 0, 100);
  cell.ros = clamp(cell.ros, 0, 100);
  cell.damage = clamp(cell.damage, 0, 100);
  cell.glycogen = clamp(cell.glycogen, 0, 200);
  cell.stressSignal = clamp(cell.stressSignal, 0, 100);
  cell.health = clamp(cell.health, 0, 1);
  cell.energy = cell.atp;
}

function recordInternalRates(cell: Cell, before: MetabolismSnapshot): void {
  cell.proteinRate = cell.protein - before.protein;
  cell.damageRate = cell.damage - before.damage;
  cell.healthRate = cell.health - before.health;
}

function recordMetabolismRates(cell: Cell, before: MetabolismBaseline): void {
  cell.atpRate = cell.atp - before.atp;
  cell.glucoseRate = cell.glucose - before.glucose;
  cell.glucosePoolRate = (cell.glucose + cell.glucose6Phosphate) - (before.glucose + (before.glucose6Phosphate ?? cell.glucose6Phosphate));
  cell.glycogenRate = cell.glycogen - before.glycogen;
  cell.aminoRate = cell.aminoAcids - before.amino;
  cell.oxygenRate = cell.oxygen - before.oxygen;
  cell.rosRate = cell.ros - before.ros;
  cell.proteinRate = cell.protein - (before.protein ?? cell.protein);
  cell.damageRate = cell.damage - (before.damage ?? cell.damage);
  cell.healthRate = cell.health - (before.health ?? cell.health);
}

function snapshotCell(cell: Cell): MetabolismSnapshot {
  return {
    atp: cell.atp,
    glucose: cell.glucose,
    glucose6Phosphate: cell.glucose6Phosphate,
    pyruvate: cell.pyruvate,
    lactate: cell.lactate,
    amino: cell.aminoAcids,
    protein: cell.protein,
    oxygen: cell.oxygen,
    ros: cell.ros,
    damage: cell.damage,
    glycogen: cell.glycogen,
    health: cell.health,
  };
}

function baselineFromCell(cell: Cell): Required<MetabolismBaseline> {
  return {
    atp: cell.atp,
    glucose: cell.glucose,
    glucose6Phosphate: cell.glucose6Phosphate,
    pyruvate: cell.pyruvate,
    lactate: cell.lactate,
    amino: cell.aminoAcids,
    protein: cell.protein,
    oxygen: cell.oxygen,
    ros: cell.ros,
    damage: cell.damage,
    glycogen: cell.glycogen,
    health: cell.health,
  };
}

function cloneCellForPreview(cell: Cell): Cell {
  return {
    ...cell,
    position: { ...cell.position },
    velocity: { ...cell.velocity },
    genome: { ...cell.genome },
    lastSignal: { ...cell.lastSignal },
  };
}

export function radiusForMass(cell: Cell): number {
  return clamp(1.85 + Math.sqrt(cell.mass) * 2.55, 2.2, 6.4);
}

export function sensorAtpCostPerTick(cell: Cell, complexity = 1): number {
  if (complexity <= 1) {
    return COMPLEXITY_ONE_SENSOR_COST;
  }
  return (cell.sensorBudget ?? 0.5) * 0.04;
}

export function upkeepAtpCostPerTick(_cell: Cell, complexity = 1): number {
  if (complexity <= 1) {
    return COMPLEXITY_ONE_UPKEEP_COST;
  }
  return 0;
}

export function glycolysisAtpCostPerTick(cell: Cell, complexity = 1, glycolysisRate = cell.glycolysisRate): number {
  if (complexity <= 1) {
    return glycolysisRate > 0 ? COMPLEXITY_ONE_GLYCOLYSIS_ATP_COST : 0;
  }
  return glycolysisRate * 0.03;
}

export function movementAtpCostPerTick(cell: Cell, complexity = 1): number {
  if (complexity <= 1) {
    return length(cell.velocity)
      * (0.16 + cell.genome.motility * 0.08)
      * Math.pow(cell.radius / 3.2, 1.2)
      * (0.5 + (cell.movementBudget ?? 0.5) * 0.7);
  }
  return length(cell.velocity)
    * (0.22 + cell.genome.motility * 0.1)
    * Math.pow(cell.radius / 3.2, 1.35)
    * (0.8 + cell.oxygenMetabolism * 0.22)
    * (0.68 + (cell.movementBudget ?? 0.5) * 0.62);
}
