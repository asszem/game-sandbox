import type { Cell } from '../core/types';
import { clamp } from '../core/vector';

type MetabolicRates = {
  atp: number;
  glucose: number;
  glycogen: number;
  amino: number;
  oxygen: number;
  ros: number;
  autophagy: number;
};

export type MetabolicDashboardElements = {
  root: HTMLElement | null;
  atpCore: HTMLElement | null;
  glucoseRate: HTMLElement | null;
  glycogenRate: HTMLElement | null;
  aminoRate: HTMLElement | null;
  oxygenRate: HTMLElement | null;
  atpNodeDelta: HTMLElement | null;
  glucoseNodeDelta: HTMLElement | null;
  glycogenNodeDelta: HTMLElement | null;
  aminoNodeDelta: HTMLElement | null;
  oxygenNodeDelta: HTMLElement | null;
  lightFactor: HTMLElement | null;
  rosDelta: HTMLElement | null;
  autophagyDelta: HTMLElement | null;
  cellGenerationValue: HTMLElement | null;
  cellSizeValue: HTMLElement | null;
};

export function syncMetabolicDashboard(elements: MetabolicDashboardElements, cell: Cell | null, running: boolean): void {
  const rates = cell ? configuredMetabolicRates(cell) : null;
  setResourceReadout(elements.atpCore, elements.atpNodeDelta, cell?.atp ?? 0, rates?.atp ?? 0);
  setResourceReadout(elements.glucoseRate, elements.glucoseNodeDelta, cell?.glucose ?? 0, rates?.glucose ?? 0);
  setResourceReadout(elements.glycogenRate, elements.glycogenNodeDelta, cell?.glycogen ?? 0, rates?.glycogen ?? 0);
  setResourceReadout(elements.aminoRate, elements.aminoNodeDelta, cell?.aminoAcids ?? 0, rates?.amino ?? 0);
  setResourceReadout(elements.oxygenRate, elements.oxygenNodeDelta, cell?.oxygen ?? 0, rates?.oxygen ?? 0);
  setPhotosynthesis(elements.lightFactor, cell);
  setDelta(elements.rosDelta, rates?.ros ?? 0, true);
  setDelta(elements.autophagyDelta, rates?.autophagy ?? 0, true);
  setCellVitals(elements.cellGenerationValue, elements.cellSizeValue, cell);

  if (elements.root && cell) {
    elements.root.style.setProperty('--glucose-flow', `${3 + cell.glucoseTransport * 5}px`);
    elements.root.style.setProperty('--amino-flow', `${3 + cell.aminoTransport * 5}px`);
    elements.root.style.setProperty('--oxygen-flow', `${3 + cell.oxygenMetabolism * 5}px`);
    elements.root.style.setProperty('--glucose-speed', `${Math.round(1200 - cell.glucoseTransport * 650)}ms`);
    elements.root.style.setProperty('--amino-speed', `${Math.round(1250 - cell.aminoTransport * 560)}ms`);
    elements.root.style.setProperty('--oxygen-speed', `${Math.round(1200 - cell.oxygenMetabolism * 650)}ms`);
    elements.root.classList.toggle('is-toxic', cell.ros > 45);
    elements.root.classList.toggle('is-autophagy', cell.autophagyRate > 0);
    elements.root.classList.toggle('is-paused', !running);
  } else if (elements.root) {
    elements.root.style.setProperty('--glucose-flow', '3px');
    elements.root.style.setProperty('--amino-flow', '3px');
    elements.root.style.setProperty('--oxygen-flow', '3px');
    elements.root.style.setProperty('--glucose-speed', '1100ms');
    elements.root.style.setProperty('--amino-speed', '1100ms');
    elements.root.style.setProperty('--oxygen-speed', '1100ms');
    elements.root.classList.remove('is-toxic');
    elements.root.classList.remove('is-autophagy');
    elements.root.classList.add('is-paused');
  }
}

function setCellVitals(generationElement: HTMLElement | null, sizeElement: HTMLElement | null, cell: Cell | null): void {
  if (generationElement) {
    generationElement.textContent = cell ? String(cell.generation) : '0';
  }
  if (sizeElement) {
    sizeElement.textContent = cell ? cell.radius.toFixed(1) : '0.0';
  }
}

function configuredMetabolicRates(cell: Cell): MetabolicRates {
  const before = {
    atp: cell.atp,
    glucose: cell.glucose,
    glycogen: cell.glycogen,
    amino: cell.aminoAcids,
    oxygen: cell.oxygen,
    ros: cell.ros,
  };
  let atp = cell.atp;
  let glucose = cell.glucose;
  let glycogen = cell.glycogen;
  let amino = cell.aminoAcids;
  let oxygen = cell.oxygen;
  let ros = cell.ros;
  let autophagy = 0;

  const light = cell.lightFactor;
  glucose += Math.max(0, light) * (0.35 + cell.genome.harvest * 0.25);
  oxygen = clamp(oxygen + light * 0.018, 0, 100);

  const storagePriority = cell.glucoseTransport ?? 0.5;
  const storageThreshold = 92 - storagePriority * 32;
  if (glucose > storageThreshold && glycogen < 200 && atp > 1) {
    const glucoseToPack = Math.min((glucose - storageThreshold) * (0.35 + storagePriority), (200 - glycogen) * 2);
    glucose -= glucoseToPack;
    glycogen += glucoseToPack / 2;
    atp -= glucoseToPack / 2;
  }

  const releaseThreshold = 4 + (1 - storagePriority) * 12;
  if (glucose < releaseThreshold && glycogen > 0) {
    const glucoseNeeded = releaseThreshold - glucose;
    const glycogenToUnpack = Math.min(glycogen, glucoseNeeded / 2);
    glycogen -= glycogenToUnpack;
    glucose += glycogenToUnpack * 2;
  }

  const glucoseUsed = Math.min(glucose, 1);
  if (glucoseUsed > 0) {
    const oxygenNeeded = glucoseUsed * (0.28 + cell.oxygenMetabolism * 0.42);
    const oxygenUsed = Math.min(oxygen, oxygenNeeded);
    const oxygenRatio = oxygenNeeded > 0 ? oxygenUsed / oxygenNeeded : 0;
    glucose -= glucoseUsed;
    oxygen -= oxygenUsed;
    atp += 2 * glucoseUsed * oxygenRatio * (0.7 + cell.oxygenMetabolism * 0.6);
    ros += (0.06 + cell.oxygenMetabolism * 0.12) * glucoseUsed * oxygenRatio;
  }

  if (atp >= 1 && amino >= 0.2) {
    atp -= 1;
    amino -= 0.2;
  }

  if (glucose <= 0.01 && glycogen <= 0.01 && amino > 0) {
    autophagy = Math.min(amino, 2);
    amino -= autophagy;
    atp += autophagy * 0.8;
  }

  const velocity = Math.hypot(cell.velocity.x, cell.velocity.y);
  const movementCost = velocity
    * (0.28 + cell.genome.motility * 0.12)
    * Math.pow(cell.radius / 3.2, 1.45)
    * (0.85 + cell.oxygenMetabolism * 0.35)
    * (0.72 + (cell.movementBudget ?? 0.5) * 0.7);
  atp -= movementCost;
  atp -= (cell.sensorBudget ?? 0.5) * 0.045;

  const repairBudget = Math.min(atp, amino, 0.06 + cell.ribosomeActivity * 0.16);
  if (ros > 18 && repairBudget > 0) {
    ros -= repairBudget * (0.55 + cell.ribosomeActivity * 0.65);
    atp -= repairBudget * (0.35 + cell.ribosomeActivity * 0.45);
    amino -= repairBudget * (0.35 + cell.ribosomeActivity * 0.55);
  }

  if (atp < 12) {
    amino = Math.max(0, amino - 0.03);
  }

  atp = clamp(atp, -12, 100);
  glucose = clamp(glucose, 0, 100);
  glycogen = clamp(glycogen, 0, 200);
  amino = clamp(amino, 0, 100);
  oxygen = clamp(oxygen, 0, 100);
  ros = clamp(ros, 0, 100);

  return {
    atp: atp - before.atp,
    glucose: glucose - before.glucose,
    glycogen: glycogen - before.glycogen,
    amino: amino - before.amino,
    oxygen: oxygen - before.oxygen,
    ros: ros - before.ros,
    autophagy,
  };
}

function setResourceReadout(container: HTMLElement | null, deltaElement: HTMLElement | null, value: number, delta: number): void {
  if (container) {
    const valueElement = container.querySelector<HTMLElement>('.resource-value');
    if (valueElement) {
      valueElement.textContent = String(Math.round(value));
    } else {
      container.textContent = String(Math.round(value));
    }
  }
  setDelta(deltaElement, delta);
}

function setPhotosynthesis(element: HTMLElement | null, cell: Cell | null): void {
  if (!element) {
    return;
  }
  const intake = Math.max(0, cell?.lightFactor ?? 0);
  const glucose = cell ? intake * (0.35 + cell.genome.harvest * 0.25) : 0;
  const oxygen = intake * 0.018;
  element.innerHTML = `<span class="photosynthesis-intake">${intake.toFixed(2)} intake</span><span><span data-trend="${trendFor(glucose)}">${formatSigned(glucose)} Glucose</span> | <span data-trend="${trendFor(oxygen)}">${formatSigned(oxygen)} Oxygen</span></span>`;
  element.dataset.trend = intake > 0.01 ? 'good' : 'flat';
  const parent = element.closest<HTMLElement>('.tri-gauge');
  if (parent) {
    parent.dataset.flow = intake > 0.01 ? 'good' : 'flat';
    parent.style.setProperty('--net-size', `${Math.min(46, intake * 42)}%`);
  }
}

function formatSigned(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`;
}

function trendFor(value: number): 'good' | 'bad' | 'flat' {
  if (value > 0.005) {
    return 'good';
  }
  if (value < -0.005) {
    return 'bad';
  }
  return 'flat';
}

function setDelta(element: HTMLElement | null, value: number, inverted = false): void {
  if (!element) {
    return;
  }
  const rounded = value.toFixed(1);
  element.textContent = `${value >= 0 ? '+' : ''}${rounded}`;
  const bad = inverted ? value > 0 : value < -0.05;
  const good = inverted ? value < -0.05 : value > 0.05;
  element.dataset.trend = good ? 'good' : bad ? 'bad' : 'flat';
  const parent = element.closest<HTMLElement>('.tri-gauge');
  if (parent) {
    parent.dataset.flow = good ? 'good' : bad ? 'bad' : 'flat';
    parent.style.setProperty('--net-size', `${Math.min(46, Math.abs(value) * 16)}%`);
  }
}
