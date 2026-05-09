import type { Cell, ResourceKind, SimulationState } from '../core/types';
import { awarenessRadius } from '../core/sensing';
import { distance } from '../core/vector';
import {
  glycolysisAtpCostPerTick,
  movementAtpCostPerTick,
  previewCellMetabolism,
  sensorAtpCostPerTick,
  upkeepAtpCostPerTick,
  type MetabolicPreview,
} from '../core/metabolism';

type MetabolicRates = MetabolicPreview;
type SensedObjectKind = ResourceKind | 'poison' | 'cell' | 'block';

export type MetabolicDashboardElements = {
  root: HTMLElement | null;
  sensorAtpCost: HTMLElement | null;
  sensorRangeValue: HTMLElement | null;
  sensorDetections: HTMLElement | null;
  movementAtpCost: HTMLElement | null;
  metabolismAtpCost: HTMLElement | null;
  healthAtpCost: HTMLElement | null;
  externalGlucoseInput: HTMLElement | null;
  glucosePoolValue: HTMLElement | null;
  glucosePoolDelta: HTMLElement | null;
  glycolysisProcessValue: HTMLElement | null;
  atpPoolValue: HTMLElement | null;
  atpPoolDelta: HTMLElement | null;
  healthUpkeepFactor: HTMLElement | null;
  cellHealthValue: HTMLElement | null;
  cellHealthDelta: HTMLElement | null;
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
  metabolicHealthImpactList: HTMLElement | null;
  cellGenerationValue: HTMLElement | null;
  cellSizeValue: HTMLElement | null;
};

export function syncMetabolicDashboard(
  elements: MetabolicDashboardElements,
  cell: Cell | null,
  running: boolean,
  complexity = 1,
  state: SimulationState | null = null,
): void {
  const rates = cell ? configuredMetabolicRates(cell, complexity) : null;
  setBasicMetabolismSections(elements, cell, rates, complexity, state);
  setResourceReadout(elements.atpCore, elements.atpNodeDelta, cell?.atp ?? 0, rates?.atp ?? 0);
  setResourceReadout(elements.glucoseRate, elements.glucoseNodeDelta, cell?.glucose ?? 0, rates?.glucose ?? 0);
  setResourceReadout(elements.glycogenRate, elements.glycogenNodeDelta, cell?.glycogen ?? 0, rates?.glycogen ?? 0);
  setResourceReadout(elements.aminoRate, elements.aminoNodeDelta, cell?.aminoAcids ?? 0, rates?.amino ?? 0);
  setResourceReadout(elements.oxygenRate, elements.oxygenNodeDelta, cell?.oxygen ?? 0, rates?.oxygen ?? 0);
  setResourceReadout(elements.g6pRate, elements.g6pNodeDelta, cell?.glucose6Phosphate ?? 0, rates?.glucose6Phosphate ?? 0);
  setGlycolysisReadout(elements.glycolysisRate, rates?.glycolysis ?? 0, complexity);
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
  setHealthImpactList(elements.metabolicHealthImpactList, cell, complexity);

  if (elements.root && cell) {
    elements.root.dataset.complexity = String(Math.max(1, Math.round(complexity)));
    elements.root.style.setProperty('--glycolysis-flow', `${Math.min(1, rates?.glycolysis ?? 0)}`);
    elements.root.style.setProperty('--respiration-flow', `${Math.min(1, rates?.respiration ?? 0)}`);
    elements.root.style.setProperty('--fermentation-flow', `${Math.min(1, rates?.fermentation ?? 0)}`);
    elements.root.style.setProperty('--repair-flow', `${Math.min(1, rates?.biosynthesis ?? 0)}`);
    elements.root.classList.toggle('is-toxic', cell.ros > 45);
    elements.root.classList.toggle('is-autophagy', cell.autophagyRate > 0);
    elements.root.classList.toggle('is-paused', !running);
  } else if (elements.root) {
    elements.root.dataset.complexity = String(Math.max(1, Math.round(complexity)));
    elements.root.style.setProperty('--glycolysis-flow', '0');
    elements.root.style.setProperty('--respiration-flow', '0');
    elements.root.style.setProperty('--fermentation-flow', '0');
    elements.root.style.setProperty('--repair-flow', '0');
    elements.root.classList.remove('is-toxic');
    elements.root.classList.remove('is-autophagy');
    elements.root.classList.add('is-paused');
  }
}

function setBasicMetabolismSections(
  elements: MetabolicDashboardElements,
  cell: Cell | null,
  rates: MetabolicRates | null,
  complexity: number,
  state: SimulationState | null,
): void {
  setUsage(elements.sensorAtpCost, cell ? -sensorAtpCostPerTick(cell, complexity) : 0);
  setText(elements.sensorRangeValue, formatValue(cell ? awarenessRadius(cell) : 0));
  setUsage(elements.movementAtpCost, cell ? -movementAtpCostPerTick(cell, complexity) : 0);
  setUsage(elements.metabolismAtpCost, cell ? -glycolysisAtpCostPerTick(cell, complexity, rates?.glycolysis ?? cell.glycolysisRate) : 0);
  setUsage(elements.healthAtpCost, cell ? -upkeepAtpCostPerTick(cell, complexity) : 0);
  setText(elements.externalGlucoseInput, formatValue(cell?.externalGlucoseInputRate ?? 0));
  const glucosePool = cell ? cell.glucose + cell.glucose6Phosphate : 0;
  setText(elements.glucosePoolValue, formatValue(glucosePool));
  setDelta(elements.glucosePoolDelta, cell?.glucosePoolRate ?? 0);
  setText(elements.glycolysisProcessValue, `${formatValue(cell?.glycolysisRate ?? 0)}/tick`);
  setText(elements.atpPoolValue, formatValue(cell?.atp ?? 0));
  setDelta(elements.atpPoolDelta, cell?.atpRate ?? 0);
  setText(elements.healthUpkeepFactor, `${formatCost(cell ? upkeepAtpCostPerTick(cell, complexity) : 0)} ATP/tick`);
  setText(elements.cellHealthValue, `${Math.round((cell?.health ?? 0) * 100)}%`);
  setDelta(elements.cellHealthDelta, cell?.healthRate ?? 0);
  setDetectionList(elements.sensorDetections, cell, state, complexity);
}

function setDetectionList(
  element: HTMLElement | null,
  cell: Cell | null,
  state: SimulationState | null,
  complexity: number,
): void {
  if (!element) {
    return;
  }
  const counts = sensedObjectCounts(cell, state);
  element.textContent = '';
  for (const kind of sensedObjectKindsForComplexity(complexity)) {
    const item = document.createElement('span');
    const value = document.createElement('strong');
    item.append(`${sensedObjectLabel(kind)} `);
    value.textContent = String(counts[kind] ?? 0);
    item.appendChild(value);
    element.appendChild(item);
  }
}

function sensedObjectCounts(cell: Cell | null, state: SimulationState | null): Partial<Record<SensedObjectKind, number>> {
  if (!cell || !state) {
    return {};
  }
  const radius = awarenessRadius(cell);
  const counts = state.resources.reduce<Partial<Record<SensedObjectKind, number>>>((accumulator, resource) => {
    if (distance(cell.position, resource.position) <= radius) {
      accumulator[resource.kind] = (accumulator[resource.kind] ?? 0) + 1;
    }
    return accumulator;
  }, {});
  counts.poison = state.hazards.filter((hazard) => distance(cell.position, hazard.position) <= radius + hazard.radius).length;
  counts.cell = state.cells.filter((other) => other.id !== cell.id && distance(cell.position, other.position) <= radius).length;
  counts.block = state.blocks.filter((block) => distance(cell.position, block.position) <= radius + block.radius).length;
  return counts;
}

function sensedObjectKindsForComplexity(complexity: number): SensedObjectKind[] {
  const base: SensedObjectKind[] = ['glucose', 'poison', 'cell', 'block'];
  if (complexity <= 1) {
    return base;
  }
  return ['glucose', 'amino-acid', 'oxygen', 'light', 'poison', 'cell', 'block'];
}

function sensedObjectLabel(kind: SensedObjectKind): string {
  if (kind === 'amino-acid') {
    return 'Amino Acids';
  }
  if (kind === 'cell') {
    return 'Cells';
  }
  if (kind === 'block') {
    return 'Blocks';
  }
  if (kind === 'poison') {
    return 'Poison';
  }
  return kind[0].toUpperCase() + kind.slice(1);
}

function setText(element: HTMLElement | null, text: string): void {
  if (element) {
    element.textContent = text;
  }
}

function setUsage(element: HTMLElement | null, value: number): void {
  if (!element) {
    return;
  }
  element.textContent = formatSignedCost(value);
  element.dataset.trend = trendFor(value);
}

function setHealthImpactList(element: HTMLElement | null, cell: Cell | null, complexity: number): void {
  if (!element) {
    return;
  }
  element.textContent = '';
  if (!cell) {
    return;
  }
  const glucosePool = cell.glucose + cell.glucose6Phosphate;
  const impacts = complexity <= 1
    ? [
      { label: `ATP ${Math.round(cell.atp)}`, state: cell.atp > 15 ? 'good' : 'bad' },
      { label: `Glucose Pool ${Math.round(glucosePool)}`, state: glucosePool > 12 ? 'good' : glucosePool > 2 ? 'warn' : 'bad' },
    ]
    : [
      { label: `ATP ${Math.round(cell.atp)}`, state: cell.atp > 15 ? 'good' : 'bad' },
      { label: `Amino Acids ${Math.round(cell.aminoAcids)}`, state: cell.aminoAcids > 12 ? 'good' : 'bad' },
      { label: `ROS ${Math.round(cell.ros)}`, state: cell.ros < 35 ? 'good' : cell.ros > 45 ? 'bad' : 'warn' },
    ];
  for (const impact of impacts) {
    const chip = document.createElement('span');
    chip.dataset.impact = impact.state;
    chip.textContent = impact.label;
    element.appendChild(chip);
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

function configuredMetabolicRates(cell: Cell, complexity: number): MetabolicRates {
  return previewCellMetabolism(cell, complexity);
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

function setGlycolysisReadout(container: HTMLElement | null, value: number, complexity: number): void {
  if (complexity <= 1) {
    setStaticProcessReadout(container, `${formatValue(value)}/tick`);
    return;
  }
  setProcessReadout(container, value);
}

function setStaticProcessReadout(container: HTMLElement | null, value: string): void {
  if (!container) {
    return;
  }
  const valueElement = container.querySelector<HTMLElement>('.resource-value');
  if (valueElement) {
    valueElement.textContent = value;
  } else {
    container.textContent = value;
  }
  const deltaElement = container.querySelector<HTMLElement>('.resource-delta');
  if (deltaElement) {
    deltaElement.textContent = '';
    deltaElement.dataset.trend = 'flat';
  }
}

function setPhotosynthesis(element: HTMLElement | null, cell: Cell | null): void {
  if (!element) {
    return;
  }
  const intake = Math.max(0, cell?.lightFactor ?? 0);
  const valueElement = element.querySelector<HTMLElement>('.resource-value');
  const deltaElement = element.querySelector<HTMLElement>('.resource-delta');
  const previousCellId = element.dataset.lightCellId;
  const cellId = cell ? String(cell.id) : '';
  const previousLight = previousCellId === cellId ? Number(element.dataset.lightValue ?? intake) : intake;
  const lightDelta = intake - previousLight;
  if (valueElement) {
    valueElement.textContent = intake.toFixed(2);
  }
  if (deltaElement) {
    deltaElement.textContent = formatSigned(lightDelta);
    deltaElement.dataset.trend = trendFor(lightDelta);
  }
  element.dataset.lightCellId = cellId;
  element.dataset.lightValue = String(intake);
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

function formatCost(value: number): string {
  return value >= 1 ? value.toFixed(1) : value.toFixed(2);
}

function formatSignedCost(value: number): string {
  const magnitude = Math.abs(value);
  const formatted = magnitude >= 1 ? magnitude.toFixed(1) : magnitude.toFixed(2);
  return `${value > 0 ? '+' : value < 0 ? '-' : ''}${formatted}`;
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
