import type { Cell } from '../core/types';
import { previewCellMetabolism, type MetabolicPreview } from '../core/metabolism';

type MetabolicRates = MetabolicPreview;

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
  g6pRate: HTMLElement | null;
  g6pNodeDelta: HTMLElement | null;
  glycolysisRate: HTMLElement | null;
  pyruvateRate: HTMLElement | null;
  pyruvateNodeDelta: HTMLElement | null;
  respirationRate: HTMLElement | null;
  lactateRate: HTMLElement | null;
  lactateNodeDelta: HTMLElement | null;
  proteinRate: HTMLElement | null;
  proteinNodeDelta: HTMLElement | null;
  stressSignalRate: HTMLElement | null;
  damageNodeDelta: HTMLElement | null;
  lightFactor: HTMLElement | null;
  rosDelta: HTMLElement | null;
  damageRate: HTMLElement | null;
  autophagyDelta: HTMLElement | null;
  balanceImpact: HTMLElement | null;
  positiveBalanceValue: HTMLElement | null;
  negativeBalanceValue: HTMLElement | null;
  overallHealthValue: HTMLElement | null;
  overallHealthDelta: HTMLElement | null;
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
  setResourceReadout(elements.g6pRate, elements.g6pNodeDelta, cell?.glucose6Phosphate ?? 0, rates?.glucose6Phosphate ?? 0);
  setProcessReadout(elements.glycolysisRate, rates?.glycolysis ?? 0);
  setResourceReadout(elements.pyruvateRate, elements.pyruvateNodeDelta, cell?.pyruvate ?? 0, rates?.pyruvate ?? 0);
  setProcessReadout(elements.respirationRate, rates?.respiration ?? 0);
  setResourceReadout(elements.lactateRate, elements.lactateNodeDelta, rates?.fermentation ?? 0, cell?.lactate ?? 0);
  setResourceReadout(elements.proteinRate, elements.proteinNodeDelta, cell?.protein ?? 0, rates?.protein ?? 0);
  setResourceReadout(elements.stressSignalRate, elements.damageNodeDelta, cell?.stressSignal ?? 0, rates?.damage ?? 0, true);
  setPhotosynthesis(elements.lightFactor, cell);
  setResourceReadout(elements.rosDelta, elements.damageRate, cell?.ros ?? 0, rates?.damage ?? 0, true);
  setAutophagy(elements.autophagyDelta, rates?.autophagy ?? 0);
  setCellVitals(elements.cellGenerationValue, elements.cellSizeValue, cell);
  setBalance(elements, cell, rates);

  if (elements.root && cell) {
    elements.root.style.setProperty('--glycolysis-flow', `${Math.min(1, rates?.glycolysis ?? 0)}`);
    elements.root.style.setProperty('--respiration-flow', `${Math.min(1, rates?.respiration ?? 0)}`);
    elements.root.style.setProperty('--fermentation-flow', `${Math.min(1, rates?.fermentation ?? 0)}`);
    elements.root.style.setProperty('--repair-flow', `${Math.min(1, rates?.biosynthesis ?? 0)}`);
    elements.root.classList.toggle('is-toxic', cell.ros > 45);
    elements.root.classList.toggle('is-autophagy', cell.autophagyRate > 0);
    elements.root.classList.toggle('is-paused', !running);
  } else if (elements.root) {
    elements.root.style.setProperty('--glycolysis-flow', '0');
    elements.root.style.setProperty('--respiration-flow', '0');
    elements.root.style.setProperty('--fermentation-flow', '0');
    elements.root.style.setProperty('--repair-flow', '0');
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
  return previewCellMetabolism(cell);
}

function setResourceReadout(container: HTMLElement | null, deltaElement: HTMLElement | null, value: number, delta: number, inverted = false): void {
  if (container) {
    const valueElement = container.querySelector<HTMLElement>('.resource-value');
    if (valueElement) {
      valueElement.textContent = formatValue(value);
    } else {
      container.textContent = formatValue(value);
    }
  }
  setDelta(deltaElement, delta, inverted);
}

function setProcessReadout(container: HTMLElement | null, value: number): void {
  if (!container) {
    return;
  }
  const valueElement = container.querySelector<HTMLElement>('.resource-value');
  if (valueElement) {
    valueElement.textContent = formatValue(value);
  } else {
    container.textContent = formatValue(value);
  }
  const deltaElement = container.querySelector<HTMLElement>('.resource-delta');
  if (deltaElement) {
    deltaElement.textContent = 'flow';
    deltaElement.dataset.trend = value > 0.05 ? 'good' : 'flat';
  }
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

function setAutophagy(element: HTMLElement | null, value: number): void {
  if (!element) {
    return;
  }
  element.textContent = `Autophagy ${formatSignedOne(value)}`;
  element.dataset.trend = value > 0.05 ? 'bad' : 'flat';
}

function setBalance(elements: MetabolicDashboardElements, cell: Cell | null, rates: MetabolicRates | null): void {
  const positive = cell
    ? Math.min(100, Math.round(Math.min(cell.atp / 65, cell.aminoAcids / 45, cell.protein / 70) * (cell.ros < 35 ? 100 : 55)))
    : 0;
  const negative = cell
    ? Math.min(100, Math.round(
      (Math.max(0, cell.damage) / 100) * 48
      + (Math.max(0, cell.ros - 28) / 72) * 30
      + (Math.max(0, 28 - cell.protein) / 28) * 22,
    ))
    : 0;
  if (elements.positiveBalanceValue) {
    elements.positiveBalanceValue.textContent = String(Math.max(0, positive));
  }
  if (elements.negativeBalanceValue) {
    elements.negativeBalanceValue.textContent = String(Math.max(0, negative));
  }
  if (elements.overallHealthValue) {
    elements.overallHealthValue.textContent = `${Math.round((cell?.health ?? 0) * 100)}%`;
  }
  if (elements.overallHealthDelta) {
    setDelta(elements.overallHealthDelta, rates?.health ?? 0);
  }
  if (elements.balanceImpact) {
    const healthRate = rates?.health ?? 0;
    const label = healthRate > 0.001 ? 'Positive balance' : healthRate < -0.001 ? 'Negative balance' : 'Balance stable';
    elements.balanceImpact.textContent = `${label} | +${positive} / -${negative}`;
    elements.balanceImpact.dataset.trend = healthRate > 0.001 ? 'good' : healthRate < -0.001 ? 'bad' : 'flat';
  }
}

function formatSigned(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`;
}

function formatSignedOne(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}`;
}

function formatValue(value: number): string {
  return Math.abs(value) >= 10 ? String(Math.round(value)) : value.toFixed(1);
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
