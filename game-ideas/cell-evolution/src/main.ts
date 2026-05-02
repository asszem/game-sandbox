import './styles.css';
import { CellSimulation } from './core/simulation';
import type { Cell, DNAKey, SimulationState } from './core/types';
import { MapPick, PetriDishRenderer, RendererView } from './render/PetriDishRenderer';

type WindowLayout = Record<string, { left: number; top: number; width: number; height: number; collapsed: boolean }>;

type SaveData = {
  version: 1 | 2;
  savedAt: number;
  simulation?: SimulationState;
  inspectedTarget?: MapPick;
  dishes?: DishSaveData[];
  activeDishId?: number | null;
  windowLayout: WindowLayout;
  tooltipsEnabled?: boolean;
};

type DishSaveData = {
  id: number;
  state: SimulationState;
  inspectedTarget: MapPick;
  view: RendererView;
  left: number;
  top: number;
  size: number;
  zIndex: number;
};

type DishInstance = {
  id: number;
  canvas: HTMLCanvasElement;
  simulation: CellSimulation;
  renderer: PetriDishRenderer;
  inspectedTarget: MapPick;
  hoveredTarget: MapPick | null;
  accumulator: number;
  worldTime: number;
  zIndex: number;
  dragStart: { pointerId: number; x: number; y: number; left: number; top: number } | null;
  dragMoved: boolean;
};

type SaveSlot = {
  name: string;
  savedAt: number | null;
  data: SaveData | null;
};

type GameWindow = {
  id: string;
  element: HTMLElement;
  body: HTMLElement | null;
  collapseButton: HTMLButtonElement | null;
};

type DropItemKind = 'cotton-candy' | 'cat-pawn';

const SAVE_KEY = 'cell-evolution-save-v1';
const SAVE_SLOTS_KEY = 'cell-evolution-save-slots-v1';
const SAVE_SLOT_COUNT = 5;
const MIN_DISH_SIZE = 320;
const MAX_DISH_SIZE = 760;

const dishLayer = document.querySelector<HTMLElement>('#dish-layer');
if (!dishLayer) {
  throw new Error('Missing #dish-layer');
}
const dishLayerElement = dishLayer;
const microscopeBackdrop = document.querySelector<HTMLCanvasElement>('#microscope-backdrop');

let dishes: DishInstance[] = [];
let activeDish: DishInstance | null = null;
let nextDishId = 1;
let nextDishZ = 1;
let simulation: CellSimulation;
let renderer: PetriDishRenderer;

const tickReadout = document.querySelector<HTMLElement>('#tick-readout');
const populationReadout = document.querySelector<HTMLElement>('#population-readout');
const stateReadout = document.querySelector<HTMLElement>('#state-readout');
const zoomReadout = document.querySelector<HTMLElement>('#zoom-readout');
const tooltipToggle = document.querySelector<HTMLInputElement>('#tooltip-toggle');
const tooltipStatus = document.querySelector<HTMLElement>('#tooltip-status');
const selectedTitleTargets = document.querySelectorAll<HTMLElement>('[data-selected-title]');
const selectedName = document.querySelector<HTMLElement>('#selected-name');
const selectedDetail = document.querySelector<HTMLElement>('#selected-detail');
const hoverName = document.querySelector<HTMLElement>('#hover-name');
const hoverDetail = document.querySelector<HTMLElement>('#hover-detail');
const directiveHeading = document.querySelector<HTMLElement>('#directive-heading');
const directiveDetail = document.querySelector<HTMLElement>('#directive-detail');
const metabolicDashboard = document.querySelector<HTMLElement>('.metabolic-dashboard');
const directiveIntro = document.querySelector<HTMLElement>('.directives-panel .panel-head');
const transportControlsPanel = document.querySelector<HTMLElement>('.transport-controls');
const dnaButtonsPanel = document.querySelector<HTMLElement>('.dna-buttons');
const energyMeter = document.querySelector<HTMLMeterElement>('#energy-meter');
const massMeter = document.querySelector<HTMLMeterElement>('#mass-meter');
const oxygenMeter = document.querySelector<HTMLMeterElement>('#oxygen-meter');
const healthMeter = document.querySelector<HTMLMeterElement>('#health-meter');
const dnaButtons = document.querySelectorAll<HTMLButtonElement>('[data-dna]');
const transportControls = document.querySelectorAll<HTMLInputElement>('[data-control]');
const transportOutputs = document.querySelectorAll<HTMLOutputElement>('[data-control-value]');
const dishActions = document.querySelector<HTMLElement>('.dish-actions');
const dishActionButtons = document.querySelectorAll<HTMLButtonElement>('[data-dish-action]');
const addDishButton = document.querySelector<HTMLButtonElement>('[data-dish-action="add"]');
const deleteDishButton = document.querySelector<HTMLButtonElement>('[data-dish-action="delete"]');
const dropItemButtons = document.querySelectorAll<HTMLButtonElement>('[data-drop-item]');
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
const saveModal = document.querySelector<HTMLElement>('#save-modal');
const saveModalTitle = document.querySelector<HTMLElement>('#save-modal-title');
const saveModalClose = document.querySelector<HTMLButtonElement>('#save-modal-close');
const saveSlotList = document.querySelector<HTMLElement>('#save-slot-list');
const windowSystem = createWindowSystem();

let lastTime = performance.now();
const tickMs = 150;
let inspectedTarget: MapPick = { kind: 'dish', id: null };
let hoveredTarget: MapPick | null = { kind: 'dish', id: null };
let tooltipsEnabled = true;
let activeDrop: { pointerId: number | null; kind: DropItemKind; ghost: HTMLElement } | null = null;
let suppressDropClick = false;
let saveModalMode: 'save' | 'load' = 'save';

dishLayerElement.addEventListener('pointerdown', (event) => {
  if (event.target === dishLayerElement) {
    clearActiveDish();
  }
});

window.addEventListener('keydown', (event) => {
  if (isTypingTarget(event.target)) {
    return;
  }
  if (event.code === 'Space') {
    event.preventDefault();
    if (!activeDish) {
      showToast('Select a petri dish first');
      return;
    }
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
    if (!activeDish) {
      showToast('Select a petri dish first');
      return;
    }
    renderer.resetZoom();
    updateHud();
  }
  if (event.code === 'KeyH') {
    event.preventDefault();
    setTooltipsEnabled(!tooltipsEnabled, true);
  }
  if (event.code === 'Escape' && saveModal && !saveModal.hidden) {
    event.preventDefault();
    closeSaveModal();
  }
});

tooltipToggle?.addEventListener('change', () => {
  setTooltipsEnabled(tooltipToggle.checked, true);
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

dropItemButtons.forEach((button) => {
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    const kind = button.dataset.dropItem as DropItemKind | undefined;
    if (!kind) {
      return;
    }
    suppressDropClick = true;
    beginDropItem(kind, event.clientX, event.clientY, event.pointerId);
  });
  button.addEventListener('click', () => {
    if (suppressDropClick) {
      suppressDropClick = false;
      return;
    }
    const kind = button.dataset.dropItem as DropItemKind | undefined;
    if (!kind || activeDrop) {
      return;
    }
    const rect = button.getBoundingClientRect();
    beginDropItem(kind, rect.left + rect.width / 2, rect.top + rect.height / 2, null);
  });
});

dishActionButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const action = button.dataset.dishAction;
    if (action === 'add') {
      addDish();
    }
    if (action === 'delete') {
      deleteActiveDish();
    }
    if (action === 'tutorial') {
      showToast('Tutorial placeholder');
    }
    if (action === 'restart') {
      restartScenario();
    }
    if (action === 'random') {
      randomScenario();
    }
    if (action === 'save') {
      openSaveModal('save');
    }
    if (action === 'load') {
      openSaveModal('load');
    }
  });
});

saveModalClose?.addEventListener('click', closeSaveModal);
saveModal?.addEventListener('click', (event) => {
  if (event.target === saveModal) {
    closeSaveModal();
  }
});

drawMicroscopeBackdrop();
window.addEventListener('resize', drawMicroscopeBackdrop);
createDefaultDishes();
setupTooltips();
updateHud();
requestAnimationFrame(animate);

function drawMicroscopeBackdrop(): void {
  if (!microscopeBackdrop) {
    return;
  }
  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);
  microscopeBackdrop.width = Math.round(width * pixelRatio);
  microscopeBackdrop.height = Math.round(height * pixelRatio);
  microscopeBackdrop.style.width = `${width}px`;
  microscopeBackdrop.style.height = `${height}px`;

  const ctx = microscopeBackdrop.getContext('2d');
  if (!ctx) {
    return;
  }
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(62, 110, 105, 0.18)';
  ctx.fillRect(0, 0, width, height);

  let seed = 1138;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let index = 0; index < 95; index += 1) {
    const hue = 150 + random() * 58;
    ctx.strokeStyle = `hsla(${hue}, 40%, 72%, ${0.035 + random() * 0.045})`;
    ctx.lineWidth = 1 + random() * 2.4;
    ctx.beginPath();
    const x = random() * width;
    const y = random() * height;
    ctx.ellipse(x, y, 90 + random() * 290, 5 + random() * 26, random() * Math.PI, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (let index = 0; index < 34; index += 1) {
    ctx.strokeStyle = `rgba(180, 225, 206, ${0.025 + random() * 0.035})`;
    ctx.lineWidth = 1 + random() * 1.8;
    ctx.beginPath();
    const startX = random() * width;
    const startY = random() * height;
    ctx.moveTo(startX, startY);
    ctx.lineTo(startX + (random() - 0.5) * width * 1.4, startY + (random() - 0.5) * height * 1.4);
    ctx.stroke();
  }
}

function createDefaultDishes(): void {
  const size = Math.min(560, Math.max(400, Math.round(window.innerWidth * 0.32)));
  const positions = [
    { left: window.innerWidth - size - 46, top: Math.max(120, window.innerHeight - size - 24) },
    { left: Math.max(430, window.innerWidth - size * 1.7), top: Math.max(130, window.innerHeight - size - 84) },
  ];
  positions.forEach((position) => createDish({ ...position, size, select: false }));
  clearActiveDish();
}

function createDish(options: {
  state?: SimulationState;
  inspectedTarget?: MapPick;
  view?: RendererView;
  left?: number;
  top?: number;
  size?: number;
  zIndex?: number;
  id?: number;
  select?: boolean;
} = {}): DishInstance {
  const canvas = document.createElement('canvas');
  canvas.className = 'dish-canvas';
  canvas.dataset.dishId = String(options.id ?? nextDishId);
  const size = options.size ?? Math.min(560, Math.max(400, Math.round(window.innerWidth * 0.32)));
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  canvas.style.left = `${options.left ?? window.innerWidth - size - 48}px`;
  canvas.style.top = `${options.top ?? window.innerHeight - size - 32}px`;
  dishLayerElement.appendChild(canvas);

  const dishSimulation = new CellSimulation();
  if (options.state) {
    dishSimulation.importState(options.state);
  } else {
    dishSimulation.randomScenario();
  }
  const dishRenderer = new PetriDishRenderer(canvas, {
    renderBackground: false,
    cameraControls: false,
    defaultCameraX: 0,
    defaultCameraY: 0,
  });
  dishRenderer.applyView(options.view);
  const dish: DishInstance = {
    id: options.id ?? nextDishId,
    canvas,
    simulation: dishSimulation,
    renderer: dishRenderer,
    inspectedTarget: options.inspectedTarget ?? { kind: 'dish', id: null },
    hoveredTarget: { kind: 'dish', id: null },
    accumulator: 0,
    worldTime: 0,
    zIndex: options.zIndex ?? nextDishZ,
    dragStart: null,
    dragMoved: false,
  };
  nextDishId = Math.max(nextDishId, dish.id + 1);
  nextDishZ = Math.max(nextDishZ, dish.zIndex + 1);
  canvas.style.zIndex = String(dish.zIndex);
  bindDishEvents(dish);
  dishes.push(dish);
  dishRenderer.applyView(options.view);
  if (options.select) {
    setActiveDish(dish, dish.inspectedTarget);
  }
  return dish;
}

function bindDishEvents(dish: DishInstance): void {
  dish.canvas.addEventListener('wheel', (event) => {
    if (!event.shiftKey) {
      return;
    }
    event.preventDefault();
    setActiveDish(dish, dish.inspectedTarget);
    resizeDish(dish, event.deltaY > 0 ? 0.94 : 1.06);
  }, { passive: false });

  dish.canvas.addEventListener('pointerdown', (event) => {
    setActiveDish(dish, dish.inspectedTarget);
    const rect = dish.canvas.getBoundingClientRect();
    dish.dragStart = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
    dish.dragMoved = false;
    dish.canvas.setPointerCapture(event.pointerId);
  });

  dish.canvas.addEventListener('pointermove', (event) => {
    if (dish.dragStart?.pointerId === event.pointerId) {
      const dx = event.clientX - dish.dragStart.x;
      const dy = event.clientY - dish.dragStart.y;
      if (Math.hypot(dx, dy) > 4) {
        dish.dragMoved = true;
      }
      dish.canvas.style.left = `${dish.dragStart.left + dx}px`;
      dish.canvas.style.top = `${dish.dragStart.top + dy}px`;
    }
  });

  dish.canvas.addEventListener('pointerup', (event) => {
    if (dish.dragStart?.pointerId === event.pointerId) {
      dish.dragStart = null;
    }
  });

  dish.canvas.addEventListener('click', (event) => {
    if (dish.dragMoved) {
      dish.dragMoved = false;
      return;
    }
    const pick = dish.renderer.onPointerPick(event, dish.simulation.state);
    if (!pick.dragged) {
      setActiveDish(dish, pick.target);
    }
  });

  dish.canvas.addEventListener('dblclick', (event) => {
    const target = dish.renderer.pickAtScreenPosition(event.clientX, event.clientY, dish.simulation.state);
    if (target.kind !== 'cell') {
      setActiveDish(dish, target);
      return;
    }
    const cell = dish.simulation.state.cells.find((item) => item.id === target.id);
    if (!cell) {
      return;
    }
    setActiveDish(dish, target);
    dish.renderer.centerOnCell(cell);
  });

  dish.canvas.addEventListener('pointermove', (event) => {
    if (dish.dragStart) {
      return;
    }
    const target = dish.renderer.pickAtScreenPosition(event.clientX, event.clientY, dish.simulation.state);
    if (!sameTarget(dish.hoveredTarget, target)) {
      dish.hoveredTarget = target;
      if (activeDish === dish) {
        hoveredTarget = target;
        updateHud();
      }
    }
  });

  dish.canvas.addEventListener('pointerleave', () => {
    dish.hoveredTarget = null;
    if (activeDish === dish) {
      hoveredTarget = null;
      updateHud();
    }
  });
}

function resizeDish(dish: DishInstance, factor: number): void {
  const rect = dish.canvas.getBoundingClientRect();
  const nextSize = clamp(rect.width * factor, MIN_DISH_SIZE, MAX_DISH_SIZE);
  if (Math.abs(nextSize - rect.width) < 0.5) {
    return;
  }
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  dish.canvas.style.width = `${nextSize}px`;
  dish.canvas.style.height = `${nextSize}px`;
  dish.canvas.style.left = `${centerX - nextSize / 2}px`;
  dish.canvas.style.top = `${centerY - nextSize / 2}px`;
  dish.renderer.applyView(dish.renderer.exportView());
  updateHud();
}

function setActiveDish(dish: DishInstance, target: MapPick = { kind: 'dish', id: null }): void {
  activeDish = dish;
  simulation = dish.simulation;
  renderer = dish.renderer;
  inspectedTarget = target;
  hoveredTarget = dish.hoveredTarget;
  dish.inspectedTarget = target;
  dish.simulation.selectCell(target.kind === 'cell' ? target.id : null);
  dish.zIndex = nextDishZ;
  dish.canvas.style.zIndex = String(nextDishZ);
  nextDishZ += 1;
  syncDishSelectionClasses();
  updateHud();
}

function clearActiveDish(): void {
  activeDish = null;
  inspectedTarget = { kind: 'dish', id: null };
  hoveredTarget = null;
  for (const dish of dishes) {
    dish.simulation.selectCell(null);
    dish.inspectedTarget = { kind: 'dish', id: null };
  }
  syncDishSelectionClasses();
  updateHud();
}

function syncDishSelectionClasses(): void {
  for (const dish of dishes) {
    dish.canvas.classList.toggle('is-selected', dish === activeDish);
  }
}

function requireActiveDish(): DishInstance | null {
  if (!activeDish) {
    showToast('Select a petri dish first');
    return null;
  }
  return activeDish;
}

function addDish(): void {
  const size = Math.min(560, Math.max(400, Math.round(window.innerWidth * 0.32)));
  const offset = (dishes.length % 5) * 34;
  const dish = createDish({
    left: clamp(window.innerWidth - size - 64 - offset, 24, Math.max(24, window.innerWidth - size - 24)),
    top: clamp(window.innerHeight - size - 40 - offset, 88, Math.max(88, window.innerHeight - size - 24)),
    size,
    select: true,
  });
  setActiveDish(dish, { kind: 'dish', id: null });
  showToast('Petri dish added');
}

function deleteActiveDish(): void {
  const dish = activeDish;
  if (!dish) {
    showToast('No dish selected');
    return;
  }
  dish.renderer.dispose();
  dish.canvas.remove();
  dishes = dishes.filter((item) => item !== dish);
  clearActiveDish();
  showToast('Petri dish deleted');
}

function animate(time: number): void {
  const delta = Math.min(80, time - lastTime);
  lastTime = time;

  for (const dish of dishes) {
    if (dish.simulation.state.running) {
      dish.worldTime += delta;
      dish.accumulator += delta;
      while (dish.accumulator >= tickMs) {
        dish.simulation.step();
        dish.accumulator -= tickMs;
      }
    }
    dish.renderer.render(dish.simulation.state, dish.worldTime, dish.simulation.drainEvents(), dish.inspectedTarget);
  }

  updateHud();
  requestAnimationFrame(animate);
}

function updateHud(): void {
  if (!activeDish) {
    const totalCells = dishes.reduce((total, dish) => total + dish.simulation.state.cells.length, 0);
    const runningCount = dishes.filter((dish) => dish.simulation.state.running).length;
    if (tickReadout) {
      tickReadout.textContent = `${dishes.length} dishes`;
    }
    if (populationReadout) {
      populationReadout.textContent = `${totalCells} cells`;
    }
    if (stateReadout) {
      stateReadout.textContent = runningCount > 0 ? `${runningCount} running` : 'Paused';
      stateReadout.dataset.state = runningCount > 0 ? 'running' : 'paused';
    }
    if (zoomReadout) {
      zoomReadout.textContent = 'No dish selected';
    }
    syncTooltipToggle();
    updateHoverInfo();
    syncCellOnlyPanels(false);
    syncSelectedEntityTitles('No dish selected');
    if (selectedName) selectedName.textContent = 'No dish selected';
    if (selectedDetail) selectedDetail.textContent = 'Add another dish, or click any petri dish to inspect and control it.';
    return;
  }

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
  syncTooltipToggle();
  updateHoverInfo();

  const selected = inspectedTarget.kind === 'cell' ? simulation.selectedCell : null;
  syncCellOnlyPanels(Boolean(selected));
  syncSelectedEntityTitles(selected ? selectedEntityLabel() : `Petri dish ${activeDish.id}`);
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
  updateDishStatsHud();
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

function updateDishStatsHud(): void {
  if (selectedName) selectedName.textContent = activeDish ? `Petri dish ${activeDish.id}` : 'No dish selected';
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

function syncCellOnlyPanels(hasSelectedCell: boolean): void {
  if (metabolicDashboard) {
    metabolicDashboard.hidden = !hasSelectedCell;
  }
  if (directiveIntro) {
    directiveIntro.hidden = !hasSelectedCell;
  }
  if (transportControlsPanel) {
    transportControlsPanel.hidden = !hasSelectedCell;
  }
  if (dnaButtonsPanel) {
    dnaButtonsPanel.hidden = !hasSelectedCell;
  }
  if (dishActions) {
    dishActions.hidden = hasSelectedCell;
  }
  if (addDishButton) {
    addDishButton.hidden = Boolean(activeDish);
  }
  if (deleteDishButton) {
    deleteDishButton.hidden = !activeDish;
  }
  dishActionButtons.forEach((button) => {
    const action = button.dataset.dishAction;
    if (action !== 'add' && action !== 'delete') {
      button.hidden = !activeDish;
    }
  });
}

function restartScenario(): void {
  const dish = requireActiveDish();
  if (!dish) {
    return;
  }
  simulation.restart();
  inspectedTarget = { kind: 'dish', id: null };
  dish.inspectedTarget = inspectedTarget;
  renderer.resetZoom();
  updateHud();
  showToast('Scenario restarted');
}

function randomScenario(): void {
  const dish = requireActiveDish();
  if (!dish) {
    return;
  }
  simulation.randomScenario();
  inspectedTarget = { kind: 'dish', id: null };
  dish.inspectedTarget = inspectedTarget;
  renderer.resetZoom();
  updateHud();
  showToast('Random scenario started');
}

function saveGame(): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify(createSavePayload()));
  showToast('Game saved');
}

function createSavePayload(): SaveData {
  return {
    version: 2,
    savedAt: Date.now(),
    dishes: dishes.map(exportDish),
    activeDishId: activeDish?.id ?? null,
    windowLayout: windowSystem.exportLayout(),
    tooltipsEnabled,
  };
}

function exportDish(dish: DishInstance): DishSaveData {
  const rect = dish.canvas.getBoundingClientRect();
  return {
    id: dish.id,
    state: dish.simulation.exportState(),
    inspectedTarget: dish.inspectedTarget,
    view: dish.renderer.exportView(),
    left: rect.left,
    top: rect.top,
    size: rect.width,
    zIndex: dish.zIndex,
  };
}

function loadGame(): void {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) {
    showToast('No saved game found');
    return;
  }

  try {
    const payload = JSON.parse(raw) as SaveData;
    applySaveData(payload, 'Game loaded');
  } catch {
    showToast('Could not load saved game');
  }
}

function openSaveModal(mode: 'save' | 'load'): void {
  if (!saveModal || !saveSlotList || !saveModalTitle) {
    showToast('Save slots unavailable');
    return;
  }
  saveModalMode = mode;
  saveModalTitle.textContent = mode === 'save' ? 'Save game' : 'Load game';
  renderSaveSlots();
  saveModal.hidden = false;
}

function closeSaveModal(): void {
  if (saveModal) {
    saveModal.hidden = true;
  }
}

function renderSaveSlots(): void {
  if (!saveSlotList) {
    return;
  }
  const slots = readSaveSlots();
  saveSlotList.textContent = '';
  slots.forEach((slot, index) => {
    const row = document.createElement('div');
    row.className = 'save-slot-row';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = slot.name;
    nameInput.maxLength = 32;
    nameInput.ariaLabel = `Save slot ${index + 1} name`;
    nameInput.addEventListener('change', () => {
      const next = readSaveSlots();
      next[index].name = nameInput.value.trim() || `Slot ${index + 1}`;
      writeSaveSlots(next);
    });

    const meta = document.createElement('span');
    meta.className = 'save-slot-meta';
    meta.textContent = slot.savedAt ? new Date(slot.savedAt).toLocaleString() : 'Empty';

    const action = document.createElement('button');
    action.type = 'button';
    action.textContent = saveModalMode === 'save' ? 'Save' : 'Load';
    action.disabled = saveModalMode === 'load' && !slot.data;
    action.addEventListener('click', () => {
      if (saveModalMode === 'save') {
        saveToSlot(index, nameInput.value);
      } else {
        loadFromSlot(index);
      }
    });

    row.append(nameInput, meta, action);
    saveSlotList.appendChild(row);
  });
}

function saveToSlot(index: number, name: string): void {
  const slots = readSaveSlots();
  slots[index] = {
    name: name.trim() || `Slot ${index + 1}`,
    savedAt: Date.now(),
    data: createSavePayload(),
  };
  writeSaveSlots(slots);
  renderSaveSlots();
  showToast(`Saved ${slots[index].name}`);
}

function loadFromSlot(index: number): void {
  const slot = readSaveSlots()[index];
  if (!slot.data) {
    showToast('Save slot is empty');
    return;
  }
  applySaveData(slot.data, `Loaded ${slot.name}`);
  closeSaveModal();
}

function readSaveSlots(): SaveSlot[] {
  const fallback: SaveSlot[] = Array.from({ length: SAVE_SLOT_COUNT }, (_, index) => ({
    name: `Slot ${index + 1}`,
    savedAt: null,
    data: null,
  }));
  const raw = localStorage.getItem(SAVE_SLOTS_KEY);
  if (!raw) {
    return fallback;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<SaveSlot>[];
    return fallback.map((slot, index) => ({
      name: parsed[index]?.name || slot.name,
      savedAt: parsed[index]?.savedAt ?? null,
      data: parsed[index]?.data ?? null,
    }));
  } catch {
    return fallback;
  }
}

function writeSaveSlots(slots: SaveSlot[]): void {
  localStorage.setItem(SAVE_SLOTS_KEY, JSON.stringify(slots.slice(0, SAVE_SLOT_COUNT)));
}

function applySaveData(payload: SaveData, message: string): void {
  if (payload.version !== 1 && payload.version !== 2) {
    showToast('Save version not supported');
    return;
  }
  for (const dish of dishes) {
    dish.renderer.dispose();
    dish.canvas.remove();
  }
  dishes = [];
  activeDish = null;
  inspectedTarget = { kind: 'dish', id: null };
  hoveredTarget = null;
  nextDishId = 1;
  nextDishZ = 1;

  const savedDishes = payload.version === 2 && payload.dishes?.length
    ? payload.dishes
    : payload.simulation
      ? [{
        id: 1,
        state: payload.simulation,
        inspectedTarget: payload.inspectedTarget ?? { kind: 'dish', id: null },
        view: { zoom: 1, cameraX: -48, cameraY: 0 },
        left: window.innerWidth - 560 - 48,
        top: window.innerHeight - 560 - 32,
        size: 560,
        zIndex: 1,
      }]
      : [];

  for (const savedDish of savedDishes) {
    createDish({
      id: savedDish.id,
      state: savedDish.state,
      inspectedTarget: savedDish.inspectedTarget,
      view: savedDish.view,
      left: savedDish.left,
      top: savedDish.top,
      size: savedDish.size,
      zIndex: savedDish.zIndex,
      select: false,
    });
  }

  const active = dishes.find((dish) => dish.id === payload.activeDishId) ?? null;
  if (active) {
    setActiveDish(active, active.inspectedTarget);
  } else {
    clearActiveDish();
  }
  setTooltipsEnabled(payload.tooltipsEnabled ?? true, false);
  windowSystem.applyLayout(payload.windowLayout ?? {});
  updateHud();
  showToast(message);
}

function setTooltipsEnabled(enabled: boolean, announce: boolean): void {
  tooltipsEnabled = enabled;
  if (!enabled) {
    hideTooltip();
  }
  syncTooltipToggle();
  if (announce) {
    showToast(`Hover tooltips ${tooltipsEnabled ? 'on' : 'off'}`);
  }
}

function syncTooltipToggle(): void {
  if (tooltipToggle) {
    tooltipToggle.checked = tooltipsEnabled;
  }
  if (tooltipStatus) {
    tooltipStatus.textContent = tooltipsEnabled ? 'On' : 'Off';
    tooltipStatus.dataset.state = tooltipsEnabled ? 'on' : 'off';
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

function beginDropItem(kind: DropItemKind, clientX: number, clientY: number, pointerId: number | null): void {
  cancelActiveDrop();
  hideTooltip();
  const ghost = document.createElement('div');
  ghost.className = `drop-ghost ${kind}`;
  ghost.setAttribute('aria-hidden', 'true');
  ghost.appendChild(createDropIcon(kind));
  document.body.appendChild(ghost);
  activeDrop = { pointerId, kind, ghost };
  positionDropGhost(clientX, clientY);
  window.addEventListener('pointermove', handleDropPointerMove);
  window.addEventListener('pointerup', handleDropPointerUp);
  window.addEventListener('keydown', handleDropKeyDown);
}

function handleDropPointerMove(event: PointerEvent): void {
  if (!activeDrop || (activeDrop.pointerId !== null && activeDrop.pointerId !== event.pointerId)) {
    return;
  }
  positionDropGhost(event.clientX, event.clientY);
}

function handleDropPointerUp(event: PointerEvent): void {
  if (!activeDrop || (activeDrop.pointerId !== null && activeDrop.pointerId !== event.pointerId)) {
    return;
  }
  finishDropItem(event.clientX, event.clientY);
}

function handleDropKeyDown(event: KeyboardEvent): void {
  if (event.code === 'Escape') {
    cancelActiveDrop();
  }
}

function finishDropItem(clientX: number, clientY: number): void {
  if (!activeDrop) {
    return;
  }
  const { kind, ghost } = activeDrop;
  const targetDish = dishAtPoint(clientX, clientY);
  if (!targetDish) {
    showToast('Drop inside a petri dish');
    cancelActiveDrop();
    return;
  }
  setActiveDish(targetDish, { kind: 'dish', id: null });
  const position = targetDish.renderer.screenToWorld(clientX, clientY);
  const insideDish = distance(position, { x: 0, y: 0 }) <= targetDish.simulation.state.boardRadius - 2;
  if (!insideDish) {
    showToast('Drop inside the petri dish');
    cancelActiveDrop();
    return;
  }

  ghost.classList.add('is-dissolving');
  window.setTimeout(() => ghost.remove(), 360);
  removeDropListeners();
  activeDrop = null;

  if (kind === 'cotton-candy') {
    targetDish.simulation.dropCottonCandy(position);
    showToast('Cotton candy dissolved into glucose');
  } else {
    targetDish.simulation.dropCatPawn(position);
    showToast('Cat-pawn dissolved into poison');
  }
  updateHud();
}

function dishAtPoint(clientX: number, clientY: number): DishInstance | null {
  return [...dishes]
    .sort((left, right) => right.zIndex - left.zIndex)
    .find((dish) => {
      const rect = dish.canvas.getBoundingClientRect();
      return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
    }) ?? null;
}

function cancelActiveDrop(): void {
  if (!activeDrop) {
    return;
  }
  activeDrop.ghost.remove();
  activeDrop = null;
  removeDropListeners();
}

function removeDropListeners(): void {
  window.removeEventListener('pointermove', handleDropPointerMove);
  window.removeEventListener('pointerup', handleDropPointerUp);
  window.removeEventListener('keydown', handleDropKeyDown);
}

function positionDropGhost(clientX: number, clientY: number): void {
  if (!activeDrop) {
    return;
  }
  activeDrop.ghost.style.left = `${clientX}px`;
  activeDrop.ghost.style.top = `${clientY}px`;
}

function createDropIcon(kind: DropItemKind): HTMLElement {
  const icon = document.createElement('span');
  icon.className = `drop-item-icon ${kind === 'cotton-candy' ? 'cotton-candy-icon' : 'cat-pawn-icon'}`;
  return icon;
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
