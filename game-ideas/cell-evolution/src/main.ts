import './styles.css';
import { CellSimulation } from './core/simulation';
import type { Cell, DNAKey, SimulationState } from './core/types';
import { MapPick, PetriDishRenderer } from './render/PetriDishRenderer';

type WindowLayout = Record<string, { left: number; top: number; width: number; height: number; collapsed: boolean }>;

type SaveData = {
  version: 1;
  savedAt: number;
  simulation: SimulationState;
  inspectedTarget: MapPick;
  windowLayout: WindowLayout;
  tooltipsEnabled?: boolean;
};

type GameWindow = {
  id: string;
  element: HTMLElement;
  body: HTMLElement | null;
  collapseButton: HTMLButtonElement | null;
};

const SAVE_KEY = 'cell-evolution-save-v1';

const canvas = document.querySelector<HTMLCanvasElement>('#dish');
if (!canvas) {
  throw new Error('Missing #dish canvas');
}

const simulation = new CellSimulation();
const renderer = new PetriDishRenderer(canvas);

const tickReadout = document.querySelector<HTMLElement>('#tick-readout');
const populationReadout = document.querySelector<HTMLElement>('#population-readout');
const stateReadout = document.querySelector<HTMLElement>('#state-readout');
const zoomReadout = document.querySelector<HTMLElement>('#zoom-readout');
const selectedTitleTargets = document.querySelectorAll<HTMLElement>('[data-selected-title]');
const selectedName = document.querySelector<HTMLElement>('#selected-name');
const selectedDetail = document.querySelector<HTMLElement>('#selected-detail');
const hoverName = document.querySelector<HTMLElement>('#hover-name');
const hoverDetail = document.querySelector<HTMLElement>('#hover-detail');
const directiveHeading = document.querySelector<HTMLElement>('#directive-heading');
const directiveDetail = document.querySelector<HTMLElement>('#directive-detail');
const energyMeter = document.querySelector<HTMLMeterElement>('#energy-meter');
const massMeter = document.querySelector<HTMLMeterElement>('#mass-meter');
const oxygenMeter = document.querySelector<HTMLMeterElement>('#oxygen-meter');
const healthMeter = document.querySelector<HTMLMeterElement>('#health-meter');
const dnaButtons = document.querySelectorAll<HTMLButtonElement>('[data-dna]');
const transportControls = document.querySelectorAll<HTMLInputElement>('[data-control]');
const transportOutputs = document.querySelectorAll<HTMLOutputElement>('[data-control-value]');
const atpCore = document.querySelector<HTMLElement>('#atp-core');
const glucoseRate = document.querySelector<HTMLElement>('#glucose-rate');
const aminoRate = document.querySelector<HTMLElement>('#amino-rate');
const oxygenRate = document.querySelector<HTMLElement>('#oxygen-rate');
const atpDelta = document.querySelector<HTMLElement>('#atp-delta');
const aminoDelta = document.querySelector<HTMLElement>('#amino-delta');
const oxygenDelta = document.querySelector<HTMLElement>('#oxygen-delta');
const rosDelta = document.querySelector<HTMLElement>('#ros-delta');
const toastRegion = document.querySelector<HTMLElement>('#toast-region');
const tooltipLayer = document.querySelector<HTMLElement>('#tooltip-layer');
const windowSystem = createWindowSystem();

let accumulator = 0;
let lastTime = performance.now();
let worldTime = 0;
const tickMs = 150;
let inspectedTarget: MapPick = { kind: 'dish', id: null };
let hoveredTarget: MapPick | null = { kind: 'dish', id: null };
let tooltipsEnabled = true;

canvas.addEventListener('click', (event) => {
  const pick = renderer.onPointerPick(event, simulation.state);
  if (!pick.dragged) {
    inspectedTarget = pick.target;
    simulation.selectCell(pick.target.kind === 'cell' ? pick.target.id : null);
    updateHud();
  }
});

canvas.addEventListener('dblclick', (event) => {
  const target = renderer.pickAtScreenPosition(event.clientX, event.clientY, simulation.state);
  if (target.kind !== 'cell') {
    return;
  }
  const cell = simulation.state.cells.find((item) => item.id === target.id);
  if (!cell) {
    return;
  }
  inspectedTarget = target;
  simulation.selectCell(cell.id);
  renderer.centerOnCell(cell);
  updateHud();
});

canvas.addEventListener('pointermove', (event) => {
  const target = renderer.pickAtScreenPosition(event.clientX, event.clientY, simulation.state);
  if (!sameTarget(hoveredTarget, target)) {
    hoveredTarget = target;
    updateHud();
  }
});

canvas.addEventListener('pointerleave', () => {
  hoveredTarget = null;
  updateHud();
});

window.addEventListener('keydown', (event) => {
  if (isTypingTarget(event.target)) {
    return;
  }
  if (event.code === 'Space') {
    event.preventDefault();
    simulation.toggleRunning();
    updateHud();
  }
  if (event.code === 'KeyR') {
    event.preventDefault();
    restartScenario();
  }
  if (event.code === 'F5') {
    event.preventDefault();
    saveGame();
  }
  if (event.code === 'F9') {
    event.preventDefault();
    loadGame();
  }
  if (event.code === 'Numpad0') {
    event.preventDefault();
    renderer.resetZoom();
    updateHud();
  }
  if (event.code === 'KeyT') {
    event.preventDefault();
    tooltipsEnabled = !tooltipsEnabled;
    hideTooltip();
    showToast(`Tooltips ${tooltipsEnabled ? 'on' : 'off'}`);
  }
});

dnaButtons.forEach((button) => {
  button.addEventListener('click', () => {
    if (!simulation.selectedCell) {
      return;
    }
    simulation.infuseDNA(button.dataset.dna as DNAKey);
    pulseButton(button);
    updateHud();
  });
});

transportControls.forEach((control) => {
  control.addEventListener('input', () => {
    const cell = simulation.selectedCell;
    const key = control.dataset.control as 'glucoseTransport' | 'aminoTransport' | 'oxygenMetabolism' | 'ribosomeActivity';
    if (!cell || !key) {
      return;
    }
    cell[key] = Number(control.value) / 100;
    updateHud();
  });
});

setupTooltips();

function animate(time: number): void {
  const delta = Math.min(80, time - lastTime);
  lastTime = time;

  if (simulation.state.running) {
    worldTime += delta;
    accumulator += delta;
    while (accumulator >= tickMs) {
      simulation.step();
      accumulator -= tickMs;
    }
  }

  renderer.render(simulation.state, worldTime, simulation.drainEvents());
  updateHud();
  requestAnimationFrame(animate);
}

function updateHud(): void {
  if (tickReadout) {
    tickReadout.textContent = `Tick ${simulation.state.tick}`;
  }
  if (populationReadout) {
    populationReadout.textContent = `${simulation.state.cells.length} cells`;
  }
  if (stateReadout) {
    stateReadout.textContent = simulation.state.running ? 'Running' : 'Paused';
    stateReadout.dataset.state = simulation.state.running ? 'running' : 'paused';
  }
  if (zoomReadout) {
    zoomReadout.textContent = `Zoom ${renderer.getZoomPercent()}%`;
  }
  updateHoverInfo();

  const selected = inspectedTarget.kind === 'cell' ? simulation.selectedCell : null;
  syncSelectedEntityTitles(selectedEntityLabel());
  if (selected) {
    const awareness = simulation.awarenessRadius(selected);
    const detections = scanDetections(selected, awareness);
    const directive = currentDirective(selected, detections);
    if (selectedName) {
      selectedName.textContent = `Cell ${selected.id}`;
    }
    if (selectedDetail) {
      selectedDetail.textContent = describeCellState(selected, detections, awareness);
    }
    if (directiveHeading) {
      directiveHeading.textContent = directive;
    }
    if (directiveDetail) {
      directiveDetail.textContent = describeCellDirective(selected, detections, awareness);
    }
    setMeter(energyMeter, selected.atp / 130);
    setMeter(massMeter, selected.aminoAcids / 130);
    setMeter(oxygenMeter, selected.oxygen / 100);
    setMeter(healthMeter, selected.health);
    syncMetabolicDashboard(selected);
    syncTransportControls(selected);
    setDnaEnabled(true);
    return;
  }

  setDnaEnabled(false);
  syncMetabolicDashboard(null);
  syncTransportControls(null);
  updateInspectionHud();
  updateDirectiveForNonCell();
}

function describeCellState(
  cell: Cell,
  detections: { resources: number; hazards: number; prey: number; rivals: number; nearestResource: number; nearestHazard: number },
  awareness: number,
): string {
  const strongest = Object.entries(cell.genome).sort((a, b) => b[1] - a[1])[0];
  return `ATP ${Math.round(cell.atp)} · amino acids ${Math.round(cell.aminoAcids)} · oxygen ${Math.round(cell.oxygen)} · ROS ${Math.round(cell.ros)} · Gen ${cell.generation} · dominant DNA ${strongest[0]} ${strongest[1].toFixed(2)} · sensor range ${awareness.toFixed(1)} · detected ${detections.resources} molecules, ${detections.hazards} poison, ${detections.prey} prey, ${detections.rivals} rivals · size ${cell.radius.toFixed(1)}`;
}

function describeCellDirective(
  cell: Cell,
  detections: { resources: number; hazards: number; prey: number; rivals: number; nearestResource: number; nearestHazard: number },
  awareness: number,
): string {
  return `Current directive is inferred from ATP, amino acids, oxygen, ROS, nearby echoes, and DNA traits. Transport settings: glucose ${Math.round(cell.glucoseTransport * 100)}%, amino acids ${Math.round(cell.aminoTransport * 100)}%, mitochondria ${Math.round(cell.oxygenMetabolism * 100)}%, ribosome repair ${Math.round(cell.ribosomeActivity * 100)}%. Sensor range ${awareness.toFixed(1)} sees ${detections.resources} molecules, ${detections.hazards} hazards, ${detections.prey} prey, and ${detections.rivals} rivals.`;
}

function currentDirective(
  cell: Cell,
  detections: { resources: number; hazards: number; prey: number; rivals: number; nearestResource: number; nearestHazard: number },
): string {
  if (cell.ros > 55) {
    return 'neutralize oxidative stress';
  }
  if (cell.aminoAcids < 12) {
    return detections.resources > 0 ? 'seek amino acids for repair' : 'preserve membrane proteins';
  }
  if (cell.health < 0.35 || cell.atp < 14) {
    return detections.resources > 0 ? 'transport glucose for emergency ATP' : 'starve slowly and consume internal structure';
  }
  if (detections.hazards > 0 && detections.nearestHazard < simulation.awarenessRadius(cell) * 0.55) {
    return 'evade poison echo';
  }
  if (cell.atp > 92 && cell.aminoAcids > 55 && cell.mass > 1.12 && cell.genome.split > 0.4) {
    return 'prepare mitosis';
  }
  if (detections.prey > 0 && cell.genome.predator > 0.55) {
    return 'hunt smaller cell';
  }
  if (detections.resources > 0 && cell.genome.harvest >= cell.genome.predator) {
    return 'seek strongest molecule signal';
  }
  if (detections.rivals > 0 && cell.genome.caution > 0.7) {
    return 'keep distance from rival cells';
  }
  return 'explore and map surroundings';
}

function scanDetections(cell: Cell, awareness: number): {
  resources: number;
  hazards: number;
  prey: number;
  rivals: number;
  nearestResource: number;
  nearestHazard: number;
} {
  let resources = 0;
  let hazards = 0;
  let prey = 0;
  let rivals = 0;
  let nearestResource = Infinity;
  let nearestHazard = Infinity;

  for (const resource of simulation.state.resources) {
    const d = distance(cell.position, resource.position);
    if (d <= awareness) {
      resources += 1;
      nearestResource = Math.min(nearestResource, d);
    }
  }
  for (const hazard of simulation.state.hazards) {
    const d = distance(cell.position, hazard.position);
    if (d <= awareness + hazard.radius) {
      hazards += 1;
      nearestHazard = Math.min(nearestHazard, d);
    }
  }
  for (const other of simulation.state.cells) {
    if (other.id === cell.id) {
      continue;
    }
    const d = distance(cell.position, other.position);
    if (d <= awareness) {
      if (cell.radius > other.radius * 1.08) {
        prey += 1;
      } else {
        rivals += 1;
      }
    }
  }

  return { resources, hazards, prey, rivals, nearestResource, nearestHazard };
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function setMeter(meter: HTMLMeterElement | null, value: number): void {
  if (meter) {
    meter.value = Math.max(0, Math.min(1, value));
  }
}

function updateInspectionHud(): void {
  const target = inspectedTarget;
  if (target.kind === 'resource') {
    const resource = simulation.state.resources.find((item) => item.id === target.id);
    if (resource) {
      const names = {
        glucose: 'Glucose',
        'amino-acid': 'Amino acids',
        oxygen: 'Oxygen pocket',
        light: 'Light bloom',
      };
      if (selectedName) selectedName.textContent = names[resource.kind];
      if (selectedDetail) selectedDetail.textContent = describeResource(resource.kind, resource.amount);
      setMeter(energyMeter, resource.amount);
      setMeter(massMeter, resource.radius / 8);
      setMeter(oxygenMeter, resource.kind === 'oxygen' ? resource.amount : 0);
      setMeter(healthMeter, resource.kind === 'oxygen' ? 0.65 : resource.kind === 'light' ? 0.85 : 0.35);
      return;
    }
  }

  if (target.kind === 'hazard') {
    const hazard = simulation.state.hazards.find((item) => item.id === target.id);
    if (hazard) {
      if (selectedName) selectedName.textContent = 'Poison cloud';
      if (selectedDetail) selectedDetail.textContent = `Toxic zone · potency ${hazard.potency.toFixed(2)} · cautious cells steer away.`;
      setMeter(energyMeter, 0);
      setMeter(massMeter, hazard.radius / 6);
      setMeter(oxygenMeter, 0);
      setMeter(healthMeter, hazard.potency);
      return;
    }
  }

  if (target.kind === 'block') {
    const block = simulation.state.blocks.find((item) => item.id === target.id);
    if (block) {
      if (selectedName) selectedName.textContent = 'Mineral block';
      if (selectedDetail) selectedDetail.textContent = `Non-living obstacle · ${Math.round(block.size.x)} x ${Math.round(block.size.y)} · cells must route around it.`;
      setMeter(energyMeter, 0);
      setMeter(massMeter, Math.min(1, (block.size.x * block.size.y) / 260));
      setMeter(oxygenMeter, 0);
      setMeter(healthMeter, 1);
      return;
    }
  }

  if (selectedName) selectedName.textContent = 'Petri dish medium';
  if (selectedDetail) selectedDetail.textContent = describeDishState();
  setMeter(energyMeter, 0);
  setMeter(massMeter, 0);
  setMeter(oxygenMeter, 0);
  setMeter(healthMeter, 0);
}

function describeDishState(): string {
  const resources = simulation.state.resources.reduce(
    (counts, resource) => {
      counts[resource.kind] += 1;
      counts.totalAmount += resource.amount;
      return counts;
    },
    { glucose: 0, 'amino-acid': 0, oxygen: 0, light: 0, totalAmount: 0 } as Record<'glucose' | 'amino-acid' | 'oxygen' | 'light', number> & { totalAmount: number },
  );
  const livingMass = simulation.state.cells.reduce((total, cell) => total + cell.mass, 0);
  const avgAtp = simulation.state.cells.length
    ? simulation.state.cells.reduce((total, cell) => total + cell.atp, 0) / simulation.state.cells.length
    : 0;
  return `Board radius ${simulation.state.boardRadius} · ${simulation.state.cells.length} cells · biomass ${livingMass.toFixed(1)} · average ATP ${avgAtp.toFixed(0)} · ${simulation.state.resources.length} resources (${resources.glucose} glucose, ${resources['amino-acid']} amino acids, ${resources.oxygen} oxygen, ${resources.light} light) · ${simulation.state.hazards.length} poison clouds · ${simulation.state.blocks.length} mineral blocks · tick ${simulation.state.tick}.`;
}

function updateHoverInfo(): void {
  if (!hoverName || !hoverDetail) {
    return;
  }
  if (!hoveredTarget) {
    hoverName.textContent = 'Nothing under pointer';
    hoverDetail.textContent = 'Move the cursor over the petri dish to inspect cells, resources, poison, blocks, and open agar.';
    return;
  }
  hoverName.textContent = targetLabel(hoveredTarget);
  hoverDetail.textContent = describeHoverTarget(hoveredTarget);
}

function describeHoverTarget(target: MapPick): string {
  if (target.kind === 'cell') {
    const cell = simulation.state.cells.find((item) => item.id === target.id);
    if (!cell) return 'Cell signal disappeared from the medium.';
    const awareness = simulation.awarenessRadius(cell);
    const detections = scanDetections(cell, awareness);
    return `${currentDirective(cell, detections)} · ATP ${Math.round(cell.atp)} · amino acids ${Math.round(cell.aminoAcids)} · oxygen ${Math.round(cell.oxygen)} · ROS ${Math.round(cell.ros)} · health ${Math.round(cell.health * 100)}% · size ${cell.radius.toFixed(1)} · sensor ${awareness.toFixed(1)}.`;
  }
  if (target.kind === 'resource') {
    const resource = simulation.state.resources.find((item) => item.id === target.id);
    if (!resource) return 'Resource was consumed or moved out of range.';
    return `${describeResource(resource.kind, resource.amount)} Size ${resource.radius.toFixed(1)} · position ${formatPosition(resource.position)}.`;
  }
  if (target.kind === 'hazard') {
    const hazard = simulation.state.hazards.find((item) => item.id === target.id);
    if (!hazard) return 'Poison signal faded.';
    return `Poison cloud · potency ${hazard.potency.toFixed(2)} · radius ${hazard.radius.toFixed(1)} · damages membrane integrity and raises avoidance pressure. Position ${formatPosition(hazard.position)}.`;
  }
  if (target.kind === 'block') {
    const block = simulation.state.blocks.find((item) => item.id === target.id);
    if (!block) return 'Mineral block is no longer present.';
    return `Mineral block · non-living obstacle · approximate body ${Math.round(block.size.x)} x ${Math.round(block.size.y)} · cells route around it. Position ${formatPosition(block.position)}.`;
  }
  return `Open agar medium · ${simulation.state.cells.length} cells, ${simulation.state.resources.length} resources, ${simulation.state.hazards.length} poison clouds · tick ${simulation.state.tick}.`;
}

function updateDirectiveForNonCell(): void {
  if (directiveHeading) {
    directiveHeading.textContent = inspectedTarget.kind === 'dish' ? 'No active directive' : selectedEntityLabel();
  }
  if (directiveDetail) {
    directiveDetail.textContent =
      inspectedTarget.kind === 'cell'
        ? directiveDetail.textContent ?? ''
        : 'Select a living cell to micromanage transporters, mitochondria, ribosomes, and DNA directive pressure.';
  }
}

function selectedEntityLabel(): string {
  return targetLabel(inspectedTarget);
}

function targetLabel(target: MapPick): string {
  if (target.kind === 'cell') {
    const cell = target.kind === 'cell' ? simulation.state.cells.find((item) => item.id === target.id) : null;
    return cell ? `Cell ${cell.id}` : 'Cell';
  }
  if (target.kind === 'resource') {
    const resource = simulation.state.resources.find((item) => item.id === target.id);
    if (!resource) return 'Resource';
    const labels = {
      glucose: 'Glucose',
      'amino-acid': 'Amino Acids',
      oxygen: 'Oxygen',
      light: 'Light',
    };
    return labels[resource.kind];
  }
  if (target.kind === 'hazard') return 'Poison';
  if (target.kind === 'block') return 'Mineral Block';
  return 'Petri dish';
}

function syncSelectedEntityTitles(label: string): void {
  selectedTitleTargets.forEach((target) => {
    target.textContent = label;
  });
}

function restartScenario(): void {
  simulation.restart();
  inspectedTarget = { kind: 'dish', id: null };
  renderer.resetZoom();
  updateHud();
  showToast('Scenario restarted');
}

function saveGame(): void {
  const payload: SaveData = {
    version: 1,
    savedAt: Date.now(),
    simulation: simulation.exportState(),
    inspectedTarget,
    windowLayout: windowSystem.exportLayout(),
    tooltipsEnabled,
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  showToast('Game saved');
}

function loadGame(): void {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) {
    showToast('No saved game found');
    return;
  }

  try {
    const payload = JSON.parse(raw) as SaveData;
    if (payload.version !== 1) {
      showToast('Save version not supported');
      return;
    }
    simulation.importState(payload.simulation);
    inspectedTarget = payload.inspectedTarget ?? { kind: 'dish', id: null };
    tooltipsEnabled = payload.tooltipsEnabled ?? true;
    hideTooltip();
    windowSystem.applyLayout(payload.windowLayout ?? {});
    updateHud();
    showToast('Game loaded');
  } catch {
    showToast('Could not load saved game');
  }
}

function showToast(message: string): void {
  if (!toastRegion) {
    return;
  }
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toastRegion.appendChild(toast);
  window.setTimeout(() => {
    toast.classList.add('toast-out');
    window.setTimeout(() => toast.remove(), 220);
  }, 1800);
}

function describeResource(kind: string, amount: number): string {
  if (kind === 'glucose') {
    return `Glucose molecule · amount ${amount.toFixed(2)} · transported into the cell and converted into ATP. Oxygen multiplies its yield.`;
  }
  if (kind === 'amino-acid') {
    return `Amino acid cluster · amount ${amount.toFixed(2)} · supports membrane repair, enzymes, growth, and division.`;
  }
  if (kind === 'oxygen') {
    return `Oxygen pocket · amount ${amount.toFixed(2)} · raises ATP yield from glucose but creates ROS damage.`;
  }
  return `Light bloom · intensity ${amount.toFixed(2)} · moving environmental energy field that slightly supports metabolism.`;
}

function sameTarget(left: MapPick | null, right: MapPick | null): boolean {
  return left?.kind === right?.kind && left?.id === right?.id;
}

function formatPosition(position: { x: number; y: number }): string {
  return `${position.x.toFixed(1)}, ${position.y.toFixed(1)}`;
}

function setDnaEnabled(enabled: boolean): void {
  dnaButtons.forEach((button) => {
    button.setAttribute('aria-disabled', String(!enabled));
  });
  transportControls.forEach((control) => {
    control.disabled = !enabled;
  });
}

function syncTransportControls(cell: Cell | null): void {
  transportControls.forEach((control) => {
    const key = control.dataset.control as 'glucoseTransport' | 'aminoTransport' | 'oxygenMetabolism' | 'ribosomeActivity';
    const value = cell ? Math.round((cell[key] ?? 0.5) * 100) : 0;
    control.value = String(value);
  });
  transportOutputs.forEach((output) => {
    const key = output.dataset.controlValue as 'glucoseTransport' | 'aminoTransport' | 'oxygenMetabolism' | 'ribosomeActivity';
    const value = cell ? Math.round((cell[key] ?? 0.5) * 100) : 0;
    output.textContent = `${value}%`;
  });
}

function syncMetabolicDashboard(cell: Cell | null): void {
  setText(atpCore, cell ? String(Math.round(cell.atp)) : '0');
  setText(glucoseRate, cell ? `${Math.round(cell.glucoseTransport * 100)}%` : '0');
  setText(aminoRate, cell ? `${Math.round(cell.aminoTransport * 100)}%` : '0');
  setText(oxygenRate, cell ? `${Math.round(cell.oxygenMetabolism * 100)}%` : '0');
  setDelta(atpDelta, cell?.atpRate ?? 0);
  setDelta(aminoDelta, cell?.aminoRate ?? 0);
  setDelta(oxygenDelta, cell?.oxygenRate ?? 0);
  setDelta(rosDelta, cell?.rosRate ?? 0, true);

  const root = document.querySelector<HTMLElement>('.metabolic-dashboard');
  if (root && cell) {
    root.style.setProperty('--glucose-flow', `${2 + cell.glucoseTransport * 7}px`);
    root.style.setProperty('--amino-flow', `${2 + cell.aminoTransport * 6}px`);
    root.style.setProperty('--oxygen-flow', `${2 + cell.oxygenMetabolism * 7}px`);
    root.style.setProperty('--glucose-speed', `${Math.round(1200 - cell.glucoseTransport * 650)}ms`);
    root.style.setProperty('--amino-speed', `${Math.round(1250 - cell.aminoTransport * 560)}ms`);
    root.style.setProperty('--oxygen-speed', `${Math.round(1200 - cell.oxygenMetabolism * 650)}ms`);
    root.classList.toggle('is-toxic', cell.ros > 45);
  } else if (root) {
    root.style.setProperty('--glucose-flow', '2px');
    root.style.setProperty('--amino-flow', '2px');
    root.style.setProperty('--oxygen-flow', '2px');
    root.style.setProperty('--glucose-speed', '1100ms');
    root.style.setProperty('--amino-speed', '1100ms');
    root.style.setProperty('--oxygen-speed', '1100ms');
    root.classList.remove('is-toxic');
  }
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

function setText(element: HTMLElement | null, value: string): void {
  if (element) {
    element.textContent = value;
  }
}

function pulseButton(button: HTMLButtonElement): void {
  button.classList.remove('pulsed');
  requestAnimationFrame(() => {
    button.classList.add('pulsed');
  });
}

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}

function setupTooltips(): void {
  const targets = document.querySelectorAll<HTMLElement>('[data-tooltip]');
  targets.forEach((target) => {
    target.addEventListener('pointerenter', () => showTooltip(target));
    target.addEventListener('pointermove', () => positionTooltip(target));
    target.addEventListener('pointerleave', hideTooltip);
    target.addEventListener('focus', () => showTooltip(target));
    target.addEventListener('blur', hideTooltip);
  });
  window.addEventListener('scroll', hideTooltip, true);
  window.addEventListener('resize', hideTooltip);
}

function showTooltip(target: HTMLElement): void {
  if (!tooltipLayer) {
    return;
  }
  if (!tooltipsEnabled) {
    hideTooltip();
    return;
  }
  const text = target.dataset.tooltip;
  if (!text) {
    return;
  }
  tooltipLayer.textContent = text;
  tooltipLayer.hidden = false;
  positionTooltip(target);
}

function positionTooltip(target: HTMLElement): void {
  if (!tooltipLayer || tooltipLayer.hidden) {
    return;
  }
  const gap = 8;
  const targetRect = target.getBoundingClientRect();
  const tooltipRect = tooltipLayer.getBoundingClientRect();
  const maxLeft = window.innerWidth - tooltipRect.width - 8;
  let left = clamp(targetRect.left, 8, Math.max(8, maxLeft));
  let top = targetRect.top - tooltipRect.height - gap;
  if (top < 8) {
    top = targetRect.bottom + gap;
  }
  if (top + tooltipRect.height > window.innerHeight - 8) {
    top = Math.max(8, window.innerHeight - tooltipRect.height - 8);
  }
  tooltipLayer.style.left = `${left}px`;
  tooltipLayer.style.top = `${top}px`;
}

function hideTooltip(): void {
  if (tooltipLayer) {
    tooltipLayer.hidden = true;
  }
}

function createWindowSystem() {
  const windows: GameWindow[] = Array.from(document.querySelectorAll<HTMLElement>('.game-window')).map((element) => ({
    id: element.dataset.windowId ?? '',
    element,
    body: element.querySelector<HTMLElement>('.window-body'),
    collapseButton: element.querySelector<HTMLButtonElement>('.window-collapse'),
  }));

  for (const gameWindow of windows) {
    setupWindow(gameWindow);
    setCollapsed(gameWindow, gameWindow.element.classList.contains('is-collapsed'));
  }

  return {
    exportLayout(): WindowLayout {
      const layout: WindowLayout = {};
      for (const gameWindow of windows) {
        const rect = gameWindow.element.getBoundingClientRect();
        layout[gameWindow.id] = {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          collapsed: gameWindow.element.classList.contains('is-collapsed'),
        };
      }
      return layout;
    },
    applyLayout(layout: WindowLayout): void {
      for (const gameWindow of windows) {
        const saved = layout[gameWindow.id];
        if (!saved) {
          continue;
        }
        gameWindow.element.style.left = `${clamp(saved.left, 8, window.innerWidth - 80)}px`;
        gameWindow.element.style.top = `${clamp(saved.top, 8, window.innerHeight - 32)}px`;
        gameWindow.element.style.width = `${Math.max(180, saved.width)}px`;
        gameWindow.element.style.height = saved.collapsed ? 'auto' : `${Math.max(44, saved.height)}px`;
        setCollapsed(gameWindow, saved.collapsed);
      }
    },
  };
}

function setupWindow(gameWindow: GameWindow): void {
  const { element } = gameWindow;
  const titlebar = element.querySelector<HTMLElement>('.window-titlebar');
  const resizeHandle = element.querySelector<HTMLElement>('.window-resize');
  let drag: { pointerId: number; startX: number; startY: number; left: number; top: number } | null = null;
  let resize: { pointerId: number; startX: number; startY: number; width: number; height: number } | null = null;

  gameWindow.collapseButton?.addEventListener('click', (event) => {
    event.stopPropagation();
    setCollapsed(gameWindow, !element.classList.contains('is-collapsed'));
  });

  titlebar?.addEventListener('pointerdown', (event) => {
    if (event.target instanceof HTMLButtonElement) {
      return;
    }
    const rect = element.getBoundingClientRect();
    drag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, left: rect.left, top: rect.top };
    element.setPointerCapture(event.pointerId);
  });

  element.addEventListener('pointermove', (event) => {
    if (drag?.pointerId === event.pointerId) {
      const rect = element.getBoundingClientRect();
      const nextLeft = clamp(drag.left + event.clientX - drag.startX, 8, window.innerWidth - rect.width - 8);
      const nextTop = clamp(drag.top + event.clientY - drag.startY, 8, window.innerHeight - rect.height - 8);
      element.style.left = `${nextLeft}px`;
      element.style.top = `${nextTop}px`;
    }
    if (resize?.pointerId === event.pointerId && !element.classList.contains('is-collapsed')) {
      element.style.width = `${Math.max(180, resize.width + event.clientX - resize.startX)}px`;
      element.style.height = `${Math.max(72, resize.height + event.clientY - resize.startY)}px`;
    }
  });

  element.addEventListener('pointerup', (event) => {
    if (drag?.pointerId === event.pointerId) {
      drag = null;
    }
    if (resize?.pointerId === event.pointerId) {
      resize = null;
    }
  });

  resizeHandle?.addEventListener('pointerdown', (event) => {
    event.stopPropagation();
    const rect = element.getBoundingClientRect();
    resize = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, width: rect.width, height: rect.height };
    element.setPointerCapture(event.pointerId);
  });
}

function setCollapsed(gameWindow: GameWindow, collapsed: boolean): void {
  gameWindow.element.classList.toggle('is-collapsed', collapsed);
  if (gameWindow.collapseButton) {
    gameWindow.collapseButton.textContent = collapsed ? '▸' : '▾';
    gameWindow.collapseButton.setAttribute('aria-expanded', String(!collapsed));
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

requestAnimationFrame(animate);
