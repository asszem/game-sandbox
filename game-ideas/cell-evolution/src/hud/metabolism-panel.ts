import type { Cell } from '../core/types';
import { previewCellMetabolism } from '../core/metabolism';

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
  return previewCellMetabolism(cell);
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
