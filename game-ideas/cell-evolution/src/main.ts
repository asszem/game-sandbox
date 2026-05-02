import './styles.css';
import { CellSimulation } from './core/simulation';
import type { Cell, DNAKey, ResourceKind, SimulationState, Vec2 } from './core/types';
import { isRangeControlTarget, isTypingTarget, pulseButton } from './hud/dom';
import { createToastRegion } from './hud/toasts';
import { hideTooltip, setupTooltips, syncTooltipToggle } from './hud/tooltips';
import { createWindowSystem, type WindowLayout } from './hud/windows';
import { MapPick, PetriDishRenderer, RendererView } from './render/PetriDishRenderer';

type SaveData = {
  version: 1 | 2;
  savedAt: number;
  simulation?: SimulationState;
  inspectedTarget?: MapPick;
  dishes?: DishSaveData[];
  activeDishId?: number | null;
  tutorial?: TutorialSaveData;
  windowLayout: WindowLayout;
  tooltipsEnabled?: boolean;
};

type TutorialSaveData = {
  mode: boolean;
  stepIndex: number;
  goalMet: boolean;
  completed: TutorialStepId[];
  prepared: TutorialStepId[];
};

type DishSaveData = {
  id: number;
  name?: string;
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
  name: string;
  canvas: HTMLCanvasElement;
  label: HTMLElement;
  simulation: CellSimulation;
  renderer: PetriDishRenderer;
  inspectedTarget: MapPick;
  hoveredTarget: MapPick | null;
  accumulator: number;
  worldTime: number;
  zIndex: number;
  dragStart: {
    pointerId: number;
    x: number;
    y: number;
    mode: 'move' | 'pan';
    left: number;
    top: number;
    view: RendererView;
  } | null;
  dragMoved: boolean;
};

type SaveSlot = {
  name: string;
  savedAt: number | null;
  data: SaveData | null;
};

type DropItemKind = 'cotton-candy' | 'cat-pawn';
type NewDishResourceKey = 'glucose' | 'amino-acid' | 'oxygen' | 'light';
type NewDishSetup = {
  cellCount?: number;
  resourceCounts?: Partial<Record<NewDishResourceKey, number>>;
  hazardCount?: number;
  blockCount?: number;
};
type TutorialStepId = 'atp' | 'glucose' | 'amino' | 'light' | 'poison' | 'rock' | 'directives';
type TutorialStep = {
  id: TutorialStepId;
  title: string;
  detail: string;
  goal: string;
};

const SAVE_KEY = 'cell-evolution-save-v1';
const SAVE_SLOTS_KEY = 'cell-evolution-save-slots-v1';
const TUTORIAL_PROGRESS_KEY = 'cell-evolution-tutorial-progress-v1';
const SAVE_SLOT_COUNT = 5;
const MIN_DISH_SIZE = 320;
const MAX_DISH_SIZE = 760;
const NEW_DISH_DEFAULT_CELL_COUNT = 10;
const NEW_DISH_MIN_CELL_COUNT = 1;
const NEW_DISH_MAX_CELL_COUNT = 40;

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
const gameDishCount = document.querySelector<HTMLElement>('#game-dish-count');
const gameCellCount = document.querySelector<HTMLElement>('#game-cell-count');
const gameRunningCount = document.querySelector<HTMLElement>('#game-running-count');
const tooltipToggle = document.querySelector<HTMLInputElement>('#tooltip-toggle');
const tooltipStatus = document.querySelector<HTMLElement>('#tooltip-status');
const dishWindowTitle = document.querySelector<HTMLElement>('#dish-window-title');
const dishName = document.querySelector<HTMLElement>('#dish-name');
const dishDetail = document.querySelector<HTMLElement>('#dish-detail');
const dishList = document.querySelector<HTMLElement>('#dish-list');
const entityWindowTitle = document.querySelector<HTMLElement>('#entity-window-title');
const entityName = document.querySelector<HTMLElement>('#entity-name');
const entityDetail = document.querySelector<HTMLElement>('#entity-detail');
const directivesWindowTitle = document.querySelector<HTMLElement>('#directives-window-title');
const hoverWindowTitle = document.querySelector<HTMLElement>('#hover-window-title');
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
const dishActionButtons = document.querySelectorAll<HTMLButtonElement>('[data-dish-action]');
const addDishButton = document.querySelector<HTMLButtonElement>('[data-dish-action="add"]');
const deleteDishButton = document.querySelector<HTMLButtonElement>('[data-dish-action="delete"]');
const selectedDishActions = document.querySelector<HTMLElement>('.selected-dish-actions');
const dropItemButtons = document.querySelectorAll<HTMLButtonElement>('[data-drop-item]');
const atpCore = document.querySelector<HTMLElement>('#atp-core');
const glucoseRate = document.querySelector<HTMLElement>('#glucose-rate');
const glycogenRate = document.querySelector<HTMLElement>('#glycogen-rate');
const aminoRate = document.querySelector<HTMLElement>('#amino-rate');
const oxygenRate = document.querySelector<HTMLElement>('#oxygen-rate');
const atpNodeDelta = document.querySelector<HTMLElement>('#atp-node-delta');
const glucoseNodeDelta = document.querySelector<HTMLElement>('#glucose-node-delta');
const glycogenNodeDelta = document.querySelector<HTMLElement>('#glycogen-node-delta');
const aminoNodeDelta = document.querySelector<HTMLElement>('#amino-node-delta');
const oxygenNodeDelta = document.querySelector<HTMLElement>('#oxygen-node-delta');
const lightFactor = document.querySelector<HTMLElement>('#light-factor');
const rosDelta = document.querySelector<HTMLElement>('#ros-delta');
const autophagyDelta = document.querySelector<HTMLElement>('#autophagy-delta');
const toastRegion = document.querySelector<HTMLElement>('#toast-region');
const tooltipLayer = document.querySelector<HTMLElement>('#tooltip-layer');
const showToast = createToastRegion(toastRegion);
const newDishModal = document.querySelector<HTMLElement>('#new-dish-modal');
const newDishModalClose = document.querySelector<HTMLButtonElement>('#new-dish-modal-close');
const newDishCellCountRange = document.querySelector<HTMLInputElement>('#new-dish-cell-count-range');
const newDishCellCountInput = document.querySelector<HTMLInputElement>('#new-dish-cell-count-input');
const newDishResourceSliders = document.querySelectorAll<HTMLInputElement>('[data-new-dish-resource]');
const newDishEnvironmentSliders = document.querySelectorAll<HTMLInputElement>('[data-new-dish-environment]');
const newDishCancel = document.querySelector<HTMLButtonElement>('#new-dish-cancel');
const newDishCreate = document.querySelector<HTMLButtonElement>('#new-dish-create');
const tutorialWindow = document.querySelector<HTMLElement>('.tutorial-window');
const tutorialTitle = document.querySelector<HTMLElement>('#tutorial-title');
const tutorialProgress = document.querySelector<HTMLElement>('#tutorial-progress');
const tutorialStepTitle = document.querySelector<HTMLElement>('#tutorial-step-title');
const tutorialStepDetail = document.querySelector<HTMLElement>('#tutorial-step-detail');
const tutorialGoal = document.querySelector<HTMLElement>('#tutorial-goal');
const tutorialNext = document.querySelector<HTMLButtonElement>('#tutorial-next');
const tutorialExit = document.querySelector<HTMLButtonElement>('#tutorial-exit');
const saveModal = document.querySelector<HTMLElement>('#save-modal');
const saveModalTitle = document.querySelector<HTMLElement>('#save-modal-title');
const saveModalClose = document.querySelector<HTMLButtonElement>('#save-modal-close');
const saveSlotList = document.querySelector<HTMLElement>('#save-slot-list');
const windowSystem = createWindowSystem();

let lastTime = performance.now();
const tickMs = 150;
let inspectedTarget: MapPick = { kind: 'dish', id: null };
let hoveredTarget: MapPick | null = { kind: 'dish', id: null };
let hoveredDish: DishInstance | null = null;
let tooltipsEnabled = true;
let activeDrop: { pointerId: number | null; kind: DropItemKind; ghost: HTMLElement } | null = null;
let suppressDropClick = false;
let saveModalMode: 'save' | 'load' = 'save';
let fittedEntityTargetKey = '';
let dishPickerSignature = '';
let tutorialMode = false;
let tutorialStepIndex = 0;
let tutorialEnteredStep: TutorialStepId | null = null;
let tutorialGoalMet = false;
let tutorialCompleted = readCompletedTutorialMilestones();
let tutorialPreparedSteps = new Set<TutorialStepId>();

const tutorialSteps: TutorialStep[] = [
  {
    id: 'atp',
    title: 'Milestone 1: ATP, glucose, oxygen',
    detail: 'ATP is the cell energy currency. Glucose is fuel. Oxygen makes glucose produce more ATP, but aggressive ATP production also creates ROS waste.',
    goal: 'Select the cell, raise ATP production rate to at least 75%, and reach 92 ATP.',
  },
  {
    id: 'glucose',
    title: 'Milestone 2: harvest glucose',
    detail: 'Glucose molecules are yellow board markers. Fuel uptake controls how fast the membrane imports glucose when the cell touches it.',
    goal: 'Harvest the dropped glucose until cell glucose reaches 45.',
  },
  {
    id: 'amino',
    title: 'Milestone 3: harvest amino acids',
    detail: 'Amino acids are green protein material. They repair damage, support receptors, and let cells grow or divide later.',
    goal: 'Harvest the dropped amino-acid cluster until amino acids reach 45.',
  },
  {
    id: 'light',
    title: 'Milestone 4: use light',
    detail: 'Light blooms are environmental energy fields. Sitting in light gives a light intake factor that slowly supports glucose and oxygen.',
    goal: 'Move into the light bloom and get light intake above 0.20.',
  },
  {
    id: 'poison',
    title: 'Milestone 5: avoid poison',
    detail: 'Poison damages health, drains ATP, and raises ROS. Caution DNA strengthens avoidance and makes the cell react sooner.',
    goal: 'Add Caution DNA and keep the cell outside the poison cloud.',
  },
  {
    id: 'rock',
    title: 'Milestone 6: avoid rock',
    detail: 'Rocks are mineral blocks. They cannot be harvested, and cells must route around them instead of overlapping them.',
    goal: 'Add Motility DNA and keep the cell clear of the rock.',
  },
  {
    id: 'directives',
    title: 'Milestone 7: read directives',
    detail: 'Directives summarize what a selected cell is trying to do based on internal state, nearby signals, DNA, and transport settings.',
    goal: 'Spawn neighbors, select a cell, then add any DNA directive.',
  },
];

dishLayerElement.addEventListener('pointerdown', (event) => {
  if (event.target === dishLayerElement) {
    clearActiveDish();
  }
});

window.addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    if (isTypingTarget(event.target) && !isRangeControlTarget(event.target)) {
      return;
    }
    event.preventDefault();
    if (event.shiftKey) {
      toggleAllDishesRunning();
      return;
    }
    if (!activeDish) {
      showToast('Select a petri dish first');
      return;
    }
    simulation.toggleRunning();
    updateHud();
    return;
  }
  if (isTypingTarget(event.target)) {
    return;
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
  if (event.code === 'Escape' && newDishModal && !newDishModal.hidden) {
    event.preventDefault();
    closeNewDishModal();
  }
});

function toggleAllDishesRunning(): void {
  if (dishes.length === 0) {
    showToast('No petri dishes to pause');
    return;
  }
  const shouldRun = !dishes.every((dish) => dish.simulation.state.running);
  for (const dish of dishes) {
    dish.simulation.state.running = shouldRun;
  }
  showToast(shouldRun ? 'All cell ticks resumed' : 'All cell ticks paused');
  updateHud();
}

tooltipToggle?.addEventListener('change', () => {
  setTooltipsEnabled(tooltipToggle.checked, true);
});

dnaButtons.forEach((button) => {
  button.addEventListener('click', () => {
    if (!simulation.selectedCell) {
      return;
    }
    simulation.infuseDNA(button.dataset.dna as DNAKey);
    if (tutorialMode) {
      button.dataset.tutorialUsed = 'true';
    }
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
      openNewDishModal();
    }
    if (action === 'delete') {
      deleteActiveDish();
    }
    if (action === 'tutorial') {
      startTutorial(0);
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

newDishModalClose?.addEventListener('click', closeNewDishModal);
newDishCancel?.addEventListener('click', closeNewDishModal);
newDishCreate?.addEventListener('click', () => {
  addDish(readNewDishSetup());
  closeNewDishModal();
});
newDishModal?.addEventListener('click', (event) => {
  if (event.target === newDishModal) {
    closeNewDishModal();
  }
});
newDishCellCountRange?.addEventListener('input', () => {
  setNewDishCellCount(Number(newDishCellCountRange.value));
});
newDishCellCountInput?.addEventListener('input', () => {
  setNewDishCellCount(Number(newDishCellCountInput.value));
});
newDishResourceSliders.forEach((slider) => {
  slider.addEventListener('input', () => {
    syncRangeOutput(slider);
  });
});
newDishEnvironmentSliders.forEach((slider) => {
  slider.addEventListener('input', () => {
    syncRangeOutput(slider);
  });
});
dishList?.addEventListener('pointerdown', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }
  const selectButton = target.closest<HTMLButtonElement>('[data-select-dish]');
  if (selectButton) {
    event.preventDefault();
    const dish = dishes.find((item) => item.id === Number(selectButton.dataset.selectDish));
    if (dish) {
      setActiveDish(dish, dish.inspectedTarget);
    }
  }
});
dishList?.addEventListener('input', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || !target.dataset.renameDish) {
    return;
  }
  const dish = dishes.find((item) => item.id === Number(target.dataset.renameDish));
  if (!dish) {
    return;
  }
  dish.name = target.value.slice(0, 32);
  updateDishLabel(dish);
  dishPickerSignature = currentDishPickerSignature();
});
dishList?.addEventListener('change', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || !target.dataset.renameDish) {
    return;
  }
  const dish = dishes.find((item) => item.id === Number(target.dataset.renameDish));
  if (!dish) {
    return;
  }
  dish.name = sanitizeDishName(target.value, dish.id);
  target.value = dish.name;
  updateDishLabel(dish);
  dishPickerSignature = currentDishPickerSignature();
});
dishList?.addEventListener('keydown', (event) => {
  const target = event.target;
  if (event.code === 'Enter' && target instanceof HTMLInputElement && target.dataset.renameDish) {
    event.preventDefault();
    target.blur();
  }
});
tutorialNext?.addEventListener('click', () => {
  if (tutorialGoalMet) {
    goToTutorialStep(Math.min(tutorialStepIndex + 1, tutorialSteps.length - 1), false);
  }
});
tutorialExit?.addEventListener('click', exitTutorial);

saveModalClose?.addEventListener('click', closeSaveModal);
saveModal?.addEventListener('click', (event) => {
  if (event.target === saveModal) {
    closeSaveModal();
  }
});

drawMicroscopeBackdrop();
window.addEventListener('resize', drawMicroscopeBackdrop);
createDefaultDishes();
setupTooltips(tooltipLayer, () => tooltipsEnabled);
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
  name?: string;
  select?: boolean;
  setup?: NewDishSetup;
} = {}): DishInstance {
  const canvas = document.createElement('canvas');
  canvas.className = 'dish-canvas';
  canvas.dataset.dishId = String(options.id ?? nextDishId);
  const label = document.createElement('button');
  label.className = 'dish-label';
  label.type = 'button';
  label.dataset.dishId = String(options.id ?? nextDishId);
  const size = options.size ?? Math.min(560, Math.max(400, Math.round(window.innerWidth * 0.32)));
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  canvas.style.left = `${options.left ?? window.innerWidth - size - 48}px`;
  canvas.style.top = `${options.top ?? window.innerHeight - size - 32}px`;
  dishLayerElement.appendChild(canvas);
  dishLayerElement.appendChild(label);

  const dishSimulation = new CellSimulation();
  if (options.state) {
    dishSimulation.importState(options.state);
  } else {
    dishSimulation.randomScenario(options.setup);
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
    name: options.name ?? `Dish ${options.id ?? nextDishId}`,
    canvas,
    label,
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
  updateDishLabel(dish);
  bindDishEvents(dish);
  dishes.push(dish);
  dishRenderer.applyView(options.view);
  if (options.select) {
    setActiveDish(dish, dish.inspectedTarget);
  }
  return dish;
}

function bindDishEvents(dish: DishInstance): void {
  dish.label.addEventListener('click', () => {
    setActiveDish(dish, dish.inspectedTarget);
  });

  dish.label.addEventListener('dblclick', (event) => {
    event.preventDefault();
    setActiveDish(dish, dish.inspectedTarget);
    dish.renderer.resetZoom();
    updateHud();
  });

  dish.canvas.addEventListener('contextmenu', (event) => {
    event.preventDefault();
  });

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
    const view = dish.renderer.exportView();
    dish.dragStart = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      mode: view.zoom > 1.001 ? 'pan' : 'move',
      left: rect.left,
      top: rect.top,
      view,
    };
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
      if (dish.dragStart.mode === 'pan') {
        dish.renderer.panFromView(dish.dragStart.view, dx, dy);
        updateHud();
        return;
      }
      dish.canvas.style.left = `${dish.dragStart.left + dx}px`;
      dish.canvas.style.top = `${dish.dragStart.top + dy}px`;
      updateDishLabel(dish);
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
    if (!sameTarget(dish.hoveredTarget, target) || hoveredDish !== dish) {
      dish.hoveredTarget = target;
      hoveredDish = dish;
      hoveredTarget = target;
      updateHud();
    }
  });

  dish.canvas.addEventListener('pointerleave', () => {
    dish.hoveredTarget = null;
    if (hoveredDish === dish) {
      hoveredDish = null;
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
  updateDishLabel(dish);
  dish.renderer.applyView(dish.renderer.exportView());
  updateHud();
}

function setActiveDish(dish: DishInstance, target: MapPick = { kind: 'dish', id: null }): void {
  activeDish = dish;
  simulation = dish.simulation;
  renderer = dish.renderer;
  inspectedTarget = target;
  if (!hoveredDish || hoveredDish === dish) {
    hoveredDish = dish;
    hoveredTarget = dish.hoveredTarget;
  }
  dish.inspectedTarget = target;
  dish.simulation.selectCell(target.kind === 'cell' ? target.id : null);
  dish.zIndex = nextDishZ;
  dish.canvas.style.zIndex = String(nextDishZ);
  updateDishLabel(dish);
  nextDishZ += 1;
  syncDishSelectionClasses();
  updateHud();
}

function clearActiveDish(): void {
  activeDish = null;
  inspectedTarget = { kind: 'dish', id: null };
  hoveredDish = null;
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
    dish.label.classList.toggle('is-selected', dish === activeDish);
  }
}

function updateDishLabel(dish: DishInstance): void {
  const rect = dish.canvas.getBoundingClientRect();
  dish.label.textContent = dish.name;
  dish.label.style.left = `${rect.left + rect.width / 2}px`;
  dish.label.style.top = `${Math.max(10, rect.top - 15)}px`;
  dish.label.style.zIndex = String(dish.zIndex + 1);
}

function requireActiveDish(): DishInstance | null {
  if (!activeDish) {
    showToast('Select a petri dish first');
    return null;
  }
  return activeDish;
}

function addDish(setup: NewDishSetup = {}): void {
  const size = Math.min(560, Math.max(400, Math.round(window.innerWidth * 0.32)));
  const offset = (dishes.length % 5) * 34;
  const dish = createDish({
    left: clamp(window.innerWidth - size - 64 - offset, 24, Math.max(24, window.innerWidth - size - 24)),
    top: clamp(window.innerHeight - size - 40 - offset, 88, Math.max(88, window.innerHeight - size - 24)),
    size,
    select: true,
    setup,
  });
  setActiveDish(dish, { kind: 'dish', id: null });
  showToast('New dish added');
}

function openNewDishModal(): void {
  if (!newDishModal) {
    addDish(defaultNewDishSetup());
    return;
  }
  setNewDishCellCount(NEW_DISH_DEFAULT_CELL_COUNT);
  resetNewDishRangeControls();
  newDishModal.hidden = false;
  newDishCellCountRange?.focus();
}

function closeNewDishModal(): void {
  if (newDishModal) {
    newDishModal.hidden = true;
  }
}

function setNewDishCellCount(value: number): number {
  const next = clamp(Math.round(Number.isFinite(value) ? value : NEW_DISH_DEFAULT_CELL_COUNT), NEW_DISH_MIN_CELL_COUNT, NEW_DISH_MAX_CELL_COUNT);
  if (newDishCellCountRange) {
    newDishCellCountRange.value = String(next);
  }
  if (newDishCellCountInput) {
    newDishCellCountInput.value = String(next);
  }
  return next;
}

function readNewDishCellCount(): number {
  const source = newDishCellCountInput?.value || newDishCellCountRange?.value || String(NEW_DISH_DEFAULT_CELL_COUNT);
  return setNewDishCellCount(Number(source));
}

function defaultNewDishSetup(): NewDishSetup {
  return {
    cellCount: NEW_DISH_DEFAULT_CELL_COUNT,
    resourceCounts: {
      glucose: 20,
      'amino-acid': 20,
      oxygen: 20,
      light: 20,
    },
    hazardCount: 0,
    blockCount: 0,
  };
}

function resetNewDishRangeControls(): void {
  newDishResourceSliders.forEach((slider) => {
    slider.value = '20';
    syncRangeOutput(slider);
  });
  newDishEnvironmentSliders.forEach((slider) => {
    slider.value = '0';
    syncRangeOutput(slider);
  });
}

function readNewDishSetup(): NewDishSetup {
  const setup = defaultNewDishSetup();
  setup.cellCount = readNewDishCellCount();
  setup.resourceCounts = {};
  newDishResourceSliders.forEach((slider) => {
    const key = slider.dataset.newDishResource as NewDishResourceKey | undefined;
    if (key) {
      setup.resourceCounts![key] = clamp(Math.round(Number(slider.value)), Number(slider.min || 0), Number(slider.max || 100));
    }
  });
  newDishEnvironmentSliders.forEach((slider) => {
    const count = clamp(Math.round(Number(slider.value)), Number(slider.min || 0), Number(slider.max || 100));
    if (slider.dataset.newDishEnvironment === 'poison') {
      setup.hazardCount = count;
    }
    if (slider.dataset.newDishEnvironment === 'rock') {
      setup.blockCount = count;
    }
  });
  return setup;
}

function syncRangeOutput(slider: HTMLInputElement): void {
  const output = slider.closest('label')?.querySelector('output');
  if (output) {
    output.textContent = slider.value;
  }
}

function deleteActiveDish(): void {
  const dish = activeDish;
  if (!dish) {
    showToast('No dish selected');
    return;
  }
  dish.renderer.dispose();
  dish.canvas.remove();
  dish.label.remove();
  dishes = dishes.filter((item) => item !== dish);
  clearActiveDish();
  showToast('Petri dish deleted');
}

function startTutorial(_stepIndex = 0): void {
  tutorialMode = true;
  if (tutorialWindow) {
    tutorialWindow.hidden = false;
  }
  tutorialPreparedSteps = new Set<TutorialStepId>();
  goToTutorialStep(0, true);
  showToast('Tutorial started');
}

function exitTutorial(): void {
  tutorialMode = false;
  tutorialEnteredStep = null;
  tutorialGoalMet = false;
  if (tutorialWindow) {
    tutorialWindow.hidden = true;
  }
  updateTutorialPanel();
  showToast('Tutorial closed');
}

function goToTutorialStep(stepIndex: number, rebuildWorld: boolean): void {
  tutorialStepIndex = clamp(stepIndex, 0, tutorialSteps.length - 1);
  tutorialGoalMet = false;
  tutorialEnteredStep = null;
  dnaButtons.forEach((button) => {
    delete button.dataset.tutorialUsed;
  });
  if (rebuildWorld || !activeDish) {
    createTutorialWorld();
  }
  enterTutorialStep();
  updateTutorialPanel();
}

function createTutorialWorld(): void {
  cancelActiveDrop();
  tutorialPreparedSteps = new Set<TutorialStepId>();
  const size = Math.min(560, Math.max(430, Math.round(window.innerWidth * 0.36)));
  const offset = (dishes.length % 5) * 34;
  const dish = createDish({
    name: 'Tutorial Dish',
    left: clamp(window.innerWidth - size - 64 - offset, 350, Math.max(350, window.innerWidth - size - 24)),
    top: clamp(window.innerHeight - size - 44 - offset, 106, Math.max(106, window.innerHeight - size - 24)),
    size,
    select: true,
    setup: {
      cellCount: 1,
      resourceCounts: { glucose: 0, 'amino-acid': 0, oxygen: 0, light: 0 },
      hazardCount: 0,
      blockCount: 0,
    },
  });
  const cell = dish.simulation.state.cells[0];
  if (cell) {
    Object.assign(cell, {
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      atp: 72,
      energy: 72,
      glucose: 92,
      oxygen: 88,
      aminoAcids: 76,
      glycogen: 18,
      ros: 5,
      health: 1,
      glucoseTransport: 0.35,
      aminoTransport: 0.35,
      oxygenMetabolism: 0.35,
      ribosomeActivity: 0.5,
    });
    setActiveDish(dish, { kind: 'cell', id: cell.id });
  } else {
    setActiveDish(dish, { kind: 'dish', id: null });
  }
  dish.renderer.resetZoom();
  updateHud();
}

function enterTutorialStep(): void {
  const step = tutorialSteps[tutorialStepIndex];
  if (!tutorialMode || tutorialEnteredStep === step.id) {
    return;
  }
  tutorialEnteredStep = step.id;
  const cell = tutorialCell();
  if (!activeDish || !cell) {
    return;
  }

  const shouldPrepareStep = !tutorialPreparedSteps.has(step.id);
  simulation.state.running = true;
  activeDish.accumulator = 0;
  setActiveDish(activeDish, { kind: 'cell', id: cell.id });
  if (!shouldPrepareStep) {
    return;
  }
  tutorialPreparedSteps.add(step.id);

  if (step.id === 'atp') {
    Object.assign(cell, { position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, atp: 72, glucose: 92, oxygen: 88, aminoAcids: 76, ros: 5, oxygenMetabolism: 0.35 });
  }
  if (step.id === 'glucose') {
    Object.assign(cell, { velocity: { x: 0, y: 0 }, atp: Math.max(cell.atp, 82), glucose: Math.min(cell.glucose, 18), oxygen: Math.max(cell.oxygen, 75), aminoAcids: Math.max(cell.aminoAcids, 70), glucoseTransport: 0.35 });
    spawnTutorialResource('glucose', offsetTutorialPoint(cell.position, 24, 0), 'Glucose dropped');
  }
  if (step.id === 'amino') {
    Object.assign(cell, { velocity: { x: 0, y: 0 }, atp: Math.max(cell.atp, 86), glucose: Math.max(cell.glucose, 72), oxygen: Math.max(cell.oxygen, 70), aminoAcids: Math.min(cell.aminoAcids, 18), aminoTransport: 0.35 });
    spawnTutorialResource('amino-acid', offsetTutorialPoint(cell.position, 24, 8), 'Amino-acid cluster dropped');
  }
  if (step.id === 'light') {
    Object.assign(cell, { velocity: { x: 0, y: 0 }, atp: Math.max(cell.atp, 80), glucose: Math.max(cell.glucose, 45), oxygen: Math.max(cell.oxygen, 55), aminoAcids: Math.max(cell.aminoAcids, 65) });
    spawnTutorialResource('light', offsetTutorialPoint(cell.position, 20, -8), 'Light source dropped');
  }
  if (step.id === 'poison') {
    Object.assign(cell, { velocity: { x: 0, y: 0 }, atp: Math.max(cell.atp, 84), glucose: Math.max(cell.glucose, 70), oxygen: Math.max(cell.oxygen, 70), aminoAcids: Math.max(cell.aminoAcids, 72) });
    simulation.spawnHazard(offsetTutorialPoint(cell.position, 28, 0), 0.7);
    showToast('Poison cloud dropped');
  }
  if (step.id === 'rock') {
    Object.assign(cell, { velocity: { x: 0, y: 0 }, atp: Math.max(cell.atp, 86), glucose: Math.max(cell.glucose, 72), oxygen: Math.max(cell.oxygen, 70), aminoAcids: Math.max(cell.aminoAcids, 72) });
    simulation.spawnBlock(offsetTutorialPoint(cell.position, 24, 0), 8, 7);
    spawnTutorialResource('glucose', offsetTutorialPoint(cell.position, 42, 0), 'Rock and glucose dropped');
  }
  if (step.id === 'directives') {
    Object.assign(cell, { velocity: { x: 0, y: 0 }, atp: Math.max(cell.atp, 88), glucose: Math.max(cell.glucose, 75), oxygen: Math.max(cell.oxygen, 70), aminoAcids: Math.max(cell.aminoAcids, 74) });
    const neighbor = simulation.spawnCell(offsetTutorialPoint(cell.position, 20, -10), 0);
    neighbor.radius = Math.max(2.4, cell.radius * 0.82);
    const rival = simulation.spawnCell(offsetTutorialPoint(cell.position, 31, 9), 0);
    rival.radius = Math.max(cell.radius * 1.02, 3.2);
    showToast('Neighbor cells dropped');
  }
}

function spawnTutorialResource(kind: ResourceKind, position: Vec2, message: string): void {
  simulation.spawnResource(kind, position, 1);
  showToast(message);
}

function offsetTutorialPoint(origin: Vec2, dx: number, dy: number): Vec2 {
  const point = { x: origin.x + dx, y: origin.y + dy };
  const max = Math.max(0, simulation.state.boardRadius - 8);
  const d = distance(point, { x: 0, y: 0 });
  return d > max ? { x: (point.x / d) * max, y: (point.y / d) * max } : point;
}

function tutorialCell(): Cell | null {
  return activeDish?.simulation.state.cells[0] ?? null;
}

function updateTutorialProgress(): void {
  if (!tutorialMode) {
    return;
  }
  enterTutorialStep();
  const step = tutorialSteps[tutorialStepIndex];
  const complete = isTutorialStepComplete(step);
  if (complete && !tutorialGoalMet) {
    tutorialGoalMet = true;
    tutorialCompleted.add(step.id);
    writeCompletedTutorialMilestones();
    showToast(`${step.title} complete`);
  }
  updateTutorialPanel();
}

function isTutorialStepComplete(step: TutorialStep): boolean {
  const cell = tutorialCell();
  if (!cell || !activeDish) {
    return false;
  }
  if (step.id === 'atp') {
    return cell.oxygenMetabolism >= 0.75 && cell.atp >= 92;
  }
  if (step.id === 'glucose') {
    return cell.glucose >= 45;
  }
  if (step.id === 'amino') {
    return cell.aminoAcids >= 45;
  }
  if (step.id === 'light') {
    return cell.lightFactor > 0.2;
  }
  if (step.id === 'poison') {
    const hazard = simulation.state.hazards[0];
    return Boolean(hazard)
      && cell.genome.caution > 0.55
      && distance(cell.position, hazard.position) > cell.radius + hazard.radius + 1;
  }
  if (step.id === 'rock') {
    const block = simulation.state.blocks[0];
    return Boolean(block)
      && cell.genome.motility > 0.55
      && distance(cell.position, block.position) > cell.radius + block.radius + 1;
  }
  return inspectedTarget.kind === 'cell' && Array.from(dnaButtons).some((button) => button.dataset.tutorialUsed === 'true');
}

function updateTutorialPanel(): void {
  if (!tutorialWindow || !tutorialMode) {
    return;
  }
  const step = tutorialSteps[tutorialStepIndex];
  if (tutorialTitle) {
    tutorialTitle.textContent = `Tutorial | ${tutorialStepIndex + 1}/${tutorialSteps.length}`;
  }
  if (tutorialStepTitle) {
    tutorialStepTitle.textContent = step.title;
  }
  if (tutorialStepDetail) {
    tutorialStepDetail.textContent = step.detail;
  }
  if (tutorialGoal) {
    tutorialGoal.textContent = `${tutorialGoalMet ? 'Complete' : 'Goal'}: ${step.goal}`;
    tutorialGoal.dataset.state = tutorialGoalMet ? 'complete' : 'active';
  }
  if (tutorialNext) {
    tutorialNext.disabled = !tutorialGoalMet || tutorialStepIndex >= tutorialSteps.length - 1;
    tutorialNext.textContent = tutorialStepIndex >= tutorialSteps.length - 1 ? 'Done' : 'Next';
  }
  renderTutorialMilestones();
}

function renderTutorialMilestones(): void {
  if (!tutorialProgress) {
    return;
  }
  tutorialProgress.textContent = '';
  tutorialSteps.forEach((step, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = String(index + 1);
    button.title = step.title;
    button.className = index === tutorialStepIndex
      ? 'is-current'
      : index < tutorialStepIndex && tutorialCompleted.has(step.id)
        ? 'is-complete'
        : '';
    button.disabled = index !== tutorialStepIndex && !tutorialCompleted.has(step.id);
    button.addEventListener('click', () => {
      if (!button.disabled) {
        goToTutorialStep(index, false);
      }
    });
    tutorialProgress.appendChild(button);
  });
}

function readCompletedTutorialMilestones(): Set<TutorialStepId> {
  try {
    const parsed = JSON.parse(localStorage.getItem(TUTORIAL_PROGRESS_KEY) ?? '[]') as TutorialStepId[];
    return new Set(parsed);
  } catch {
    return new Set();
  }
}

function writeCompletedTutorialMilestones(): void {
  localStorage.setItem(TUTORIAL_PROGRESS_KEY, JSON.stringify([...tutorialCompleted]));
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

  updateTutorialProgress();
  updateHud();
  requestAnimationFrame(animate);
}

function updateHud(): void {
  updateGameStatsHud();
  if (!activeDish) {
    if (tickReadout) {
      tickReadout.textContent = 'No dish';
    }
    if (populationReadout) {
      populationReadout.textContent = '0 cells';
    }
    if (stateReadout) {
      stateReadout.textContent = 'Paused';
      stateReadout.dataset.state = 'paused';
    }
    if (zoomReadout) {
      zoomReadout.textContent = 'No dish selected';
    }
    syncTooltipToggle(tooltipToggle, tooltipStatus, tooltipsEnabled);
    updateHoverInfo();
    syncCellOnlyPanels(false);
    updateDishStatsHud();
    updateSelectedEntityHud(null);
    if (directiveHeading) {
      directiveHeading.textContent = 'No cell selected';
    }
    if (directiveDetail) {
      directiveDetail.textContent = 'Select a dish, then select a cell to influence membrane transport and DNA directives.';
    }
    fitEntityWindowForSelection();
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
  syncTooltipToggle(tooltipToggle, tooltipStatus, tooltipsEnabled);
  updateHoverInfo();

  const selected = inspectedTarget.kind === 'cell' ? simulation.selectedCell : null;
  syncCellOnlyPanels(Boolean(selected));
  syncWindowTitles(selectedEntityLabel());
  updateDishStatsHud();
  if (selected) {
    const awareness = simulation.awarenessRadius(selected);
    const detections = scanDetections(selected, awareness);
    const directive = currentDirective(selected, detections, awareness);
    updateSelectedEntityHud(selected);
    if (directiveHeading) {
      directiveHeading.textContent = directive;
    }
    if (directiveDetail) {
      directiveDetail.textContent = describeCellDirective(selected, detections, awareness);
    }
    setMeter(energyMeter, selected.atp / 100);
    setMeter(massMeter, selected.aminoAcids / 100);
    setMeter(oxygenMeter, selected.oxygen / 100);
    setMeter(healthMeter, selected.health);
    syncMetabolicDashboard(selected);
    syncTransportControls(selected);
    setDnaEnabled(true);
    fitEntityWindowForSelection();
    return;
  }

  setDnaEnabled(false);
  syncMetabolicDashboard(null);
  syncTransportControls(null);
  updateSelectedEntityHud(null);
  if (directiveHeading) {
    directiveHeading.textContent = 'No cell selected';
  }
  if (directiveDetail) {
    directiveDetail.textContent = activeDish
      ? `Select a cell in dish ${activeDish.id} to influence membrane transport and DNA directives.`
      : 'Select a dish, then select a cell to influence membrane transport and DNA directives.';
  }
  fitEntityWindowForSelection();
}

function updateGameStatsHud(): void {
  const totalCells = dishes.reduce((total, dish) => total + dish.simulation.state.cells.length, 0);
  const runningCount = dishes.filter((dish) => dish.simulation.state.running).length;
  if (gameDishCount) {
    gameDishCount.textContent = String(dishes.length);
  }
  if (gameCellCount) {
    gameCellCount.textContent = String(totalCells);
  }
  if (gameRunningCount) {
    gameRunningCount.textContent = String(runningCount);
  }
}

function describeCellState(
  cell: Cell,
  detections: { resources: number; hazards: number; prey: number; rivals: number; nearestResource: number; nearestHazard: number },
  awareness: number,
): string {
  const strongest = Object.entries(cell.genome).sort((a, b) => b[1] - a[1])[0];
  return [
    `ATP ${Math.round(cell.atp)}`,
    `glucose ${Math.round(cell.glucose)}`,
    `glycogen ${Math.round(cell.glycogen)}`,
    `amino acids ${Math.round(cell.aminoAcids)}`,
    `oxygen ${Math.round(cell.oxygen)}`,
    `ROS ${Math.round(cell.ros)}`,
    cell.autophagyRate > 0 ? `autophagy ${cell.autophagyRate.toFixed(2)}/tick` : 'autophagy off',
    `Gen ${cell.generation}`,
    `dominant DNA ${strongest[0]} ${strongest[1].toFixed(2)}`,
    `sensor range ${awareness.toFixed(1)}`,
    `detected ${detections.resources} molecules, ${detections.hazards} poison, ${detections.prey} prey, ${detections.rivals} rivals`,
    `size ${cell.radius.toFixed(1)}`,
  ].join(' · ');
}

function formatCellState(
  cell: Cell,
  detections: { resources: number; hazards: number; prey: number; rivals: number; nearestResource: number; nearestHazard: number },
  awareness: number,
): string {
  const strongest = Object.entries(cell.genome).sort((a, b) => b[1] - a[1])[0];
  const healthPercent = Math.round(cell.health * 100);
  const healthState = cell.health <= 0.25 || cell.atp <= 5 || cell.mass <= 0.28
    ? 'danger'
    : cell.health <= 0.45 || cell.atp <= 15 || cell.ros >= 45
      ? 'warning'
      : 'stable';
  const stats = [
    [
      'Health',
      `${healthPercent}%`,
      'Health is normalized from 0% to 100%. A cell dies when health reaches 0%, ATP falls below -10, or mass falls below 0.16. To save it: avoid poison, lower ROS by reducing mitochondria if needed, import amino acids for repair, and refill glucose or glycogen for ATP.',
      healthState,
    ],
    ['Autophagy', `${cell.autophagyRate.toFixed(2)}/tick`, 'Autophagy is emergency self-eating: when glucose and glycogen are empty, the cell breaks down amino acids and mass for fuel, hurting health.', cell.autophagyRate > 0 ? 'danger' : undefined],
    ['Gen', cell.generation.toString(), 'Generation counts how many divisions separate this cell from the starting population.'],
    ['Size', cell.radius.toFixed(1), 'Cell size affects collision area, food intake, vulnerability, and whether the cell is ready to divide.'],
    [
      'Sensing',
      `${awareness.toFixed(1)} · ${Math.round(simulation.sensingProfile(cell).clarity * 100)}%`,
      'Sensing depends on signal transduction. ATP powers receptor resolution, amino acids maintain receptor proteins, oxygen supports processing speed, and ROS or damage reduce clarity.',
    ],
    ['DNA', `${strongest[0]} ${strongest[1].toFixed(2)}`, 'Dominant DNA is the strongest current trait shaping behavior, metabolism, sensing, and division priorities.'],
    ['Nearby', `${detections.resources} molecules · ${detections.hazards} poison · ${detections.prey} prey · ${detections.rivals} rivals`, 'Nearby signals are what the cell can currently sense and use for movement, feeding, avoidance, or hunting decisions.'],
  ];
  return `<span class="cell-stat-grid">${stats.map(([label, value, tooltip, state]) => `<span class="cell-stat${state ? ` cell-stat-${state}` : ''}" data-tooltip="${tooltip}"><span>${label}</span><strong>${value}</strong></span>`).join('')}</span>`;
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
  awareness = simulation.awarenessRadius(cell),
): string {
  if (cell.ros > 55) {
    return 'Neutralize oxidative stress';
  }
  if (cell.aminoAcids < 12) {
    return detections.resources > 0 ? 'Seek amino acids for repair' : 'Preserve membrane proteins';
  }
  if (cell.health < 0.35 || cell.atp < 14) {
    return detections.resources > 0 ? 'Transport glucose for emergency ATP' : 'Starve slowly and consume internal structure';
  }
  if (detections.hazards > 0 && detections.nearestHazard < awareness * 0.55) {
    return 'Evade poison echo';
  }
  if (cell.atp > 92 && cell.aminoAcids > 55 && cell.mass > 1.12 && cell.genome.split > 0.4) {
    return 'Prepare mitosis';
  }
  if (detections.prey > 0 && cell.genome.predator > 0.55) {
    return 'Hunt smaller cells';
  }
  if (detections.resources > 0 && cell.genome.harvest >= cell.genome.predator) {
    return 'Seek strongest molecule signal';
  }
  if (detections.rivals > 0 && cell.genome.caution > 0.7) {
    return 'Keep distance from rival cells';
  }
  return 'Explore and map surroundings';
}

function scanDetections(cell: Cell, awareness: number, state: SimulationState = simulation.state): {
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

  for (const resource of state.resources) {
    const d = distance(cell.position, resource.position);
    if (d <= awareness) {
      resources += 1;
      nearestResource = Math.min(nearestResource, d);
    }
  }
  for (const hazard of state.hazards) {
    const d = distance(cell.position, hazard.position);
    if (d <= awareness + hazard.radius) {
      hazards += 1;
      nearestHazard = Math.min(nearestHazard, d);
    }
  }
  for (const other of state.cells) {
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
  syncWindowTitles(selectedEntityLabel());
  if (dishName) {
    dishName.hidden = Boolean(activeDish);
    dishName.textContent = activeDish ? '' : 'No dish selected';
  }
  if (dishDetail) dishDetail.innerHTML = formatDishState();
  if (dishList) {
    dishList.hidden = false;
    if (!dishList.contains(document.activeElement)) {
      const signature = currentDishPickerSignature();
      if (signature !== dishPickerSignature) {
        dishList.innerHTML = formatDishPickerList();
        dishPickerSignature = signature;
      }
    }
  }
  setMeter(energyMeter, 0);
  setMeter(massMeter, 0);
  setMeter(oxygenMeter, 0);
  setMeter(healthMeter, 0);
}

function formatDishState(): string {
  if (!activeDish) {
    return '<div class="dish-picker-empty">Select a dish from the Game window or click any petri dish to inspect it.</div>';
  }
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
  const stats = [
    ['Biomass', livingMass.toFixed(1)],
    ['Avg ATP', avgAtp.toFixed(0)],
    ['Resources', simulation.state.resources.length.toString()],
    ['Glucose', resources.glucose.toString()],
    ['Amino', resources['amino-acid'].toString()],
    ['Oxygen', resources.oxygen.toString()],
    ['Light', resources.light.toString()],
    ['Poison', simulation.state.hazards.length.toString()],
    ['Blocks', simulation.state.blocks.length.toString()],
    ['Radius', simulation.state.boardRadius.toFixed(1)],
  ];
  return `<span class="dish-stat-grid">${stats.map(([label, value]) => `<span class="dish-stat"><span>${label}</span><strong>${value}</strong></span>`).join('')}</span>`;
}

function formatDishPickerList(): string {
  if (dishes.length === 0) {
    return '<div class="dish-picker-empty">No dishes yet.</div>';
  }
  return dishes.map((dish) => `
    <div class="dish-picker-row">
      <button type="button" class="dish-picker-icon" data-select-dish="${dish.id}" aria-label="Select ${escapeHtml(dish.name)}">◯</button>
      <input type="text" data-rename-dish="${dish.id}" value="${escapeHtml(dish.name)}" aria-label="Rename ${escapeHtml(dish.name)}" />
      <span>${dish.simulation.state.cells.length} cells</span>
      <span>${dish.simulation.state.running ? 'Running' : 'Paused'}</span>
    </div>
  `).join('');
}

function currentDishPickerSignature(): string {
  return dishes
    .map((dish) => `${dish.id}:${dish.name}:${dish.simulation.state.cells.length}:${dish.simulation.state.running ? 1 : 0}`)
    .join('|');
}

function sanitizeDishName(value: string, id: number): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, 32) || `Dish ${id}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function updateSelectedEntityHud(selectedCell: Cell | null): void {
  if (!activeDish) {
    if (entityName) {
      entityName.hidden = false;
      entityName.textContent = 'No entity selected';
    }
    if (entityDetail) entityDetail.textContent = 'Select a dish, then click a cell, resource, poison cloud, or mineral block.';
    return;
  }
  if (selectedCell) {
    const awareness = simulation.awarenessRadius(selectedCell);
    const detections = scanDetections(selectedCell, awareness);
    if (entityName) {
      entityName.hidden = true;
    }
    if (entityDetail) entityDetail.innerHTML = formatCellState(selectedCell, detections, awareness);
    return;
  }
  if (entityName) {
    entityName.hidden = false;
  }
  if (inspectedTarget.kind === 'dish') {
    if (entityName) entityName.textContent = 'No entity selected';
    if (entityDetail) entityDetail.textContent = `Dish ${activeDish.id} is selected. Click an entity inside this dish to inspect it.`;
    return;
  }
  if (entityName) entityName.hidden = true;
  if (entityDetail) entityDetail.innerHTML = formatHoverTarget(inspectedTarget, activeDish);
}

function fitEntityWindowForSelection(): void {
  const key = activeDish ? `${activeDish.id}:${inspectedTarget.kind}:${inspectedTarget.id ?? 'dish'}` : 'none';
  if (key === fittedEntityTargetKey) {
    return;
  }
  fittedEntityTargetKey = key;
  windowSystem.fitHeight('entity');
}

function updateHoverInfo(): void {
  if (!hoverWindowTitle || !hoverDetail) {
    return;
  }
  const sourceDish = hoveredDish ?? activeDish;
  if (!hoveredTarget || !sourceDish) {
    hoverWindowTitle.textContent = 'Hover Info | No dish | Nothing';
    hoverDetail.innerHTML = '<div class="hover-fact-grid"><span class="hover-fact" data-tooltip="Move over any dish item to see a compact breakdown here."><span>Hint</span><strong>Hover a dish entity</strong></span></div>';
    return;
  }
  const label = targetLabel(hoveredTarget, sourceDish);
  hoverWindowTitle.textContent = `Hover Info | ${sourceDish.name} | ${label}`;
  hoverDetail.innerHTML = formatHoverTarget(hoveredTarget, sourceDish);
}

function formatHoverTarget(target: MapPick, dish: DishInstance): string {
  const sourceSimulation = dish.simulation;
  const state = sourceSimulation.state;
  if (target.kind === 'cell') {
    const cell = state.cells.find((item) => item.id === target.id);
    if (!cell) return hoverFacts([['Status', 'Signal lost', 'The hovered cell no longer exists in this dish.']]);
    const awareness = sourceSimulation.awarenessRadius(cell);
    const detections = scanDetections(cell, awareness, state);
    return hoverFacts([
      ['Directive', currentDirective(cell, detections, awareness), 'What this cell is currently trying to do based on internal state, DNA, and nearby signals.'],
      ['ATP', Math.round(cell.atp).toString(), 'Immediate energy used for movement, transport, repair, growth, and division.'],
      ['Health', `${Math.round(cell.health * 100)}%`, 'Cell survival condition. Poison, starvation, ROS, and low materials lower it.'],
      ['Sensing', awareness.toFixed(1), 'How far this cell can detect resources, poison, prey, and rivals.'],
    ]);
  }
  if (target.kind === 'resource') {
    const resource = state.resources.find((item) => item.id === target.id);
    if (!resource) return hoverFacts([['Status', 'Consumed', 'This resource was consumed or moved out of range.']]);
    return hoverFacts([
      ['Kind', resourceLabel(resource.kind), 'The resource type determines which internal store it can refill.'],
      ['Amount', resource.amount.toFixed(2), 'Remaining usable material in this marker.'],
      ['Use', resourceUse(resource.kind), 'How cells benefit from this resource.'],
      ['Size', resource.radius.toFixed(1), 'Larger markers are easier to see but may require enough cell size to ingest.'],
    ]);
  }
  if (target.kind === 'hazard') {
    const hazard = state.hazards.find((item) => item.id === target.id);
    if (!hazard) return hoverFacts([['Status', 'Faded', 'This poison cloud is no longer present.']]);
    return hoverFacts([
      ['Kind', 'Poison cloud', 'Hazards damage cells that overlap them.'],
      ['Potency', hazard.potency.toFixed(2), 'Higher potency drains more ATP, adds more ROS, and hurts health faster.'],
      ['Radius', hazard.radius.toFixed(1), 'Cells are affected when their membrane overlaps this radius.'],
      ['Counter', 'Caution DNA', 'Caution improves avoidance behavior around poison.'],
    ]);
  }
  if (target.kind === 'block') {
    const block = state.blocks.find((item) => item.id === target.id);
    if (!block) return hoverFacts([['Status', 'Gone', 'This mineral block is no longer present.']]);
    return hoverFacts([
      ['Kind', 'Mineral block', 'A solid obstacle. Cells cannot overlap or harvest it.'],
      ['Body', `${Math.round(block.size.x)} x ${Math.round(block.size.y)}`, 'Approximate obstacle width and height.'],
      ['Radius', block.radius.toFixed(1), 'Collision radius used for keeping cells outside the rock.'],
      ['Counter', 'Motility DNA', 'Motility helps cells steer around obstacles.'],
    ]);
  }
  return hoverFacts([
    ['Medium', dish.name, 'Open agar medium inside this petri dish.'],
    ['Cells', state.cells.length.toString(), 'Living cells currently in this dish.'],
    ['Resources', state.resources.length.toString(), 'Glucose, amino acid, oxygen, and light markers in this dish.'],
    ['Poison', state.hazards.length.toString(), 'Hazard clouds currently in this dish.'],
  ]);
}

function hoverFacts(facts: Array<[string, string, string]>): string {
  return `<div class="hover-fact-grid">${facts.map(([label, value, tooltip]) => `<span class="hover-fact" data-tooltip="${escapeHtml(tooltip)}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></span>`).join('')}</div>`;
}

function resourceLabel(kind: ResourceKind): string {
  if (kind === 'amino-acid') return 'Amino acids';
  return kind[0].toUpperCase() + kind.slice(1);
}

function resourceUse(kind: ResourceKind): string {
  if (kind === 'glucose') return 'Refills fuel';
  if (kind === 'amino-acid') return 'Repair and growth';
  if (kind === 'oxygen') return 'ATP production';
  return 'Light intake';
}

function describeHoverTarget(target: MapPick, dish: DishInstance | null = activeDish ?? hoveredDish): string {
  if (!dish) {
    return 'No dish under pointer.';
  }
  const sourceSimulation = dish.simulation;
  const state = sourceSimulation.state;
  if (target.kind === 'cell') {
    const cell = state.cells.find((item) => item.id === target.id);
    if (!cell) return 'Cell signal disappeared from the medium.';
    const awareness = sourceSimulation.awarenessRadius(cell);
    const detections = scanDetections(cell, awareness, state);
    return `${currentDirective(cell, detections, awareness)} · ATP ${Math.round(cell.atp)} · amino acids ${Math.round(cell.aminoAcids)} · oxygen ${Math.round(cell.oxygen)} · ROS ${Math.round(cell.ros)} · health ${Math.round(cell.health * 100)}% · size ${cell.radius.toFixed(1)} · sensor ${awareness.toFixed(1)}.`;
  }
  if (target.kind === 'resource') {
    const resource = state.resources.find((item) => item.id === target.id);
    if (!resource) return 'Resource was consumed or moved out of range.';
    return `${describeResource(resource.kind, resource.amount)} Size ${resource.radius.toFixed(1)} · position ${formatPosition(resource.position)}.`;
  }
  if (target.kind === 'hazard') {
    const hazard = state.hazards.find((item) => item.id === target.id);
    if (!hazard) return 'Poison signal faded.';
    return `Poison cloud · potency ${hazard.potency.toFixed(2)} · radius ${hazard.radius.toFixed(1)} · damages membrane integrity and raises avoidance pressure. Position ${formatPosition(hazard.position)}.`;
  }
  if (target.kind === 'block') {
    const block = state.blocks.find((item) => item.id === target.id);
    if (!block) return 'Mineral block is no longer present.';
    return `Mineral block · non-living obstacle · approximate body ${Math.round(block.size.x)} x ${Math.round(block.size.y)} · cells route around it. Position ${formatPosition(block.position)}.`;
  }
  return `Open agar medium · ${state.cells.length} cells, ${state.resources.length} resources, ${state.hazards.length} poison clouds · tick ${state.tick}.`;
}

function selectedEntityLabel(): string {
  if (!activeDish) {
    return 'Entity';
  }
  if (inspectedTarget.kind === 'dish') {
    return 'No entity selected';
  }
  return targetLabel(inspectedTarget, activeDish);
}

function targetLabel(target: MapPick, dish: DishInstance | null = activeDish): string {
  const state = dish?.simulation.state ?? simulation.state;
  if (target.kind === 'cell') {
    const cell = target.kind === 'cell' ? state.cells.find((item) => item.id === target.id) : null;
    return cell ? `Cell ${cell.id}` : 'Cell';
  }
  if (target.kind === 'resource') {
    const resource = state.resources.find((item) => item.id === target.id);
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

function syncWindowTitles(entityLabel: string): void {
  const dishLabel = activeDish ? activeDish.name : 'No dish';
  if (dishWindowTitle) {
    dishWindowTitle.textContent = `${dishLabel} | State`;
  }
  if (entityWindowTitle) {
    entityWindowTitle.textContent = activeDish && inspectedTarget.kind === 'cell'
      ? `${dishLabel} | ${entityLabel} | Metabolism`
      : activeDish
        ? `${dishLabel} | ${entityLabel}`
        : 'No dish | Entity';
  }
  if (directivesWindowTitle) {
    directivesWindowTitle.textContent = activeDish && inspectedTarget.kind === 'cell'
      ? `${dishLabel} | ${entityLabel} | Directives`
      : `${dishLabel} | Directives`;
  }
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
  if (selectedDishActions) {
    selectedDishActions.hidden = !activeDish;
  }
  if (addDishButton) {
    addDishButton.hidden = false;
  }
  if (deleteDishButton) {
    deleteDishButton.hidden = !activeDish;
  }
  dishActionButtons.forEach((button) => {
    const action = button.dataset.dishAction;
    if (action === 'tutorial') {
      button.hidden = false;
    }
    const requiresDish = action === 'restart' || action === 'random';
    if (requiresDish) {
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
    tutorial: {
      mode: tutorialMode,
      stepIndex: tutorialStepIndex,
      goalMet: tutorialGoalMet,
      completed: [...tutorialCompleted],
      prepared: [...tutorialPreparedSteps],
    },
    windowLayout: windowSystem.exportLayout(),
    tooltipsEnabled,
  };
}

function exportDish(dish: DishInstance): DishSaveData {
  const rect = dish.canvas.getBoundingClientRect();
  return {
    id: dish.id,
    name: dish.name,
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
    dish.label.remove();
  }
  dishes = [];
  activeDish = null;
  inspectedTarget = { kind: 'dish', id: null };
  hoveredDish = null;
  hoveredTarget = null;
  tutorialMode = payload.tutorial?.mode ?? false;
  tutorialStepIndex = clamp(payload.tutorial?.stepIndex ?? 0, 0, tutorialSteps.length - 1);
  tutorialGoalMet = payload.tutorial?.goalMet ?? false;
  tutorialCompleted = new Set(payload.tutorial?.completed ?? [...tutorialCompleted]);
  tutorialPreparedSteps = new Set(payload.tutorial?.prepared ?? []);
  tutorialEnteredStep = null;
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
      name: savedDish.name,
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
  if (tutorialWindow) {
    tutorialWindow.hidden = !tutorialMode;
  }
  windowSystem.applyLayout(payload.windowLayout ?? {});
  if (tutorialMode) {
    enterTutorialStep();
    updateTutorialPanel();
  }
  updateHud();
  showToast(message);
}

function setTooltipsEnabled(enabled: boolean, announce: boolean): void {
  tooltipsEnabled = enabled;
  if (!enabled) {
    hideTooltip(tooltipLayer);
  }
  syncTooltipToggle(tooltipToggle, tooltipStatus, tooltipsEnabled);
  if (announce) {
    showToast(`Hover tooltips ${tooltipsEnabled ? 'on' : 'off'}`);
  }
}

function beginDropItem(kind: DropItemKind, clientX: number, clientY: number, pointerId: number | null): void {
  cancelActiveDrop();
  hideTooltip(tooltipLayer);
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
  const rates = cell ? configuredMetabolicRates(cell) : null;
  setResourceReadout(atpCore, atpNodeDelta, cell?.atp ?? 0, rates?.atp ?? 0);
  setResourceReadout(glucoseRate, glucoseNodeDelta, cell?.glucose ?? 0, rates?.glucose ?? 0);
  setResourceReadout(glycogenRate, glycogenNodeDelta, cell?.glycogen ?? 0, rates?.glycogen ?? 0);
  setResourceReadout(aminoRate, aminoNodeDelta, cell?.aminoAcids ?? 0, rates?.amino ?? 0);
  setResourceReadout(oxygenRate, oxygenNodeDelta, cell?.oxygen ?? 0, rates?.oxygen ?? 0);
  setLightFactor(lightFactor, cell?.lightFactor ?? 0);
  setDelta(rosDelta, rates?.ros ?? 0, true);
  setDelta(autophagyDelta, rates?.autophagy ?? 0, true);

  const root = document.querySelector<HTMLElement>('.metabolic-dashboard');
  if (root && cell) {
    root.style.setProperty('--glucose-flow', `${3 + cell.glucoseTransport * 5}px`);
    root.style.setProperty('--amino-flow', `${3 + cell.aminoTransport * 5}px`);
    root.style.setProperty('--oxygen-flow', `${3 + cell.oxygenMetabolism * 5}px`);
    root.style.setProperty('--glucose-speed', `${Math.round(1200 - cell.glucoseTransport * 650)}ms`);
    root.style.setProperty('--amino-speed', `${Math.round(1250 - cell.aminoTransport * 560)}ms`);
    root.style.setProperty('--oxygen-speed', `${Math.round(1200 - cell.oxygenMetabolism * 650)}ms`);
    root.classList.toggle('is-toxic', cell.ros > 45);
    root.classList.toggle('is-autophagy', cell.autophagyRate > 0);
    root.classList.toggle('is-paused', !simulation.state.running);
  } else if (root) {
    root.style.setProperty('--glucose-flow', '3px');
    root.style.setProperty('--amino-flow', '3px');
    root.style.setProperty('--oxygen-flow', '3px');
    root.style.setProperty('--glucose-speed', '1100ms');
    root.style.setProperty('--amino-speed', '1100ms');
    root.style.setProperty('--oxygen-speed', '1100ms');
    root.classList.remove('is-toxic');
    root.classList.remove('is-autophagy');
    root.classList.add('is-paused');
  }
}

function configuredMetabolicRates(cell: Cell): {
  atp: number;
  glucose: number;
  glycogen: number;
  amino: number;
  oxygen: number;
  ros: number;
  autophagy: number;
} {
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

  if (glucose > 80 && glycogen < 200 && atp > 1) {
    const glucoseToPack = Math.min(glucose - 80, (200 - glycogen) * 2);
    glucose -= glucoseToPack;
    glycogen += glucoseToPack / 2;
    atp -= glucoseToPack / 2;
  }

  if (glucose < 1 && glycogen > 0) {
    const glucoseNeeded = 1 - glucose;
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
    * (0.85 + cell.oxygenMetabolism * 0.35);
  atp -= movementCost;

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

function setLightFactor(element: HTMLElement | null, value: number): void {
  if (!element) {
    return;
  }
  element.textContent = value.toFixed(2);
  element.dataset.trend = value > 0.01 ? 'good' : 'flat';
  const parent = element.closest<HTMLElement>('.tri-gauge');
  if (parent) {
    parent.dataset.flow = value > 0.01 ? 'good' : 'flat';
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
