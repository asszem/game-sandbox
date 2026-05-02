import './styles/index.css';
import { drawMicroscopeBackdrop } from './app/backdrop';
import { addedDishPlacement, defaultDishPlacements, defaultDishSize, resizeDishCanvas, tutorialDishPlacement, updateFloatingDishLabel } from './app/dish-layout';
import { createDropController, type DropItemKind } from './app/drop-tools';
import { defaultNewDishCellCount, defaultNewDishSetup, readNewDishSetup as readNewDishSetupFromControls, resetNewDishRangeControls as resetNewDishRanges, setNewDishCellCount as setNewDishCellCountControls, syncRangeOutput, type NewDishSetup } from './app/new-dish';
import { SAVE_KEY, createSavePayload as createSavePayloadData, readSlot, renderSaveSlots as renderSaveSlotRows, saveToSlot as writeSaveSlot, type SaveData } from './app/save-load';
import { offsetTutorialPoint, prepareTutorialScenario } from './app/tutorial-scenarios';
import { isTutorialStepComplete as isTutorialStepCompleteForState, readCompletedTutorialMilestones, tutorialSteps, updateTutorialPanel as updateTutorialPanelContent, writeCompletedTutorialMilestones, type TutorialStep, type TutorialStepId } from './app/tutorial';
import { CellSimulation } from './core/simulation';
import type { Cell, DNAKey, ResourceKind, SimulationState, Vec2 } from './core/types';
import { clamp, distance } from './core/vector';
import { setDnaEnabled as setDnaEnabledControls, syncTransportControls as syncTransportControlValues } from './hud/directives-panel';
import { isRangeControlTarget, isTypingTarget, pulseButton } from './hud/dom';
import { currentDirective, describeCellDirective, formatCellState, scanDetections } from './hud/entity-panel';
import { syncGamePanelVisibility, syncGameStats } from './hud/game-panel';
import { describeHoverTarget, describeResource, formatHoverTarget, targetLabel } from './hud/hover-info';
import { syncMetabolicDashboard as syncMetabolicDashboardPanel } from './hud/metabolism-panel';
import { currentDishPickerSignature, formatDishPickerList, formatDishState, sanitizeDishName } from './hud/state-panel';
import { createToastRegion } from './hud/toasts';
import { hideTooltip, setupTooltips, syncTooltipToggle } from './hud/tooltips';
import { createWindowSystem } from './hud/windows';
import { MapPick, PetriDishRenderer, RendererView } from './render/PetriDishRenderer';

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
let saveModalMode: 'save' | 'load' = 'save';
let fittedEntityTargetKey = '';
let dishPickerSignature = '';
let tutorialMode = false;
let tutorialStepIndex = 0;
let tutorialEnteredStep: TutorialStepId | null = null;
let tutorialGoalMet = false;
let tutorialCompleted = readCompletedTutorialMilestones();
let tutorialPreparedSteps = new Set<TutorialStepId>();

const dropController = createDropController({
  buttons: dropItemButtons,
  onBegin: () => hideTooltip(tooltipLayer),
  onDrop: handleDropItem,
});

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
  dishPickerSignature = currentDishPickerSignature(dishes);
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
  dishPickerSignature = currentDishPickerSignature(dishes);
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

drawMicroscopeBackdrop(microscopeBackdrop);
window.addEventListener('resize', () => drawMicroscopeBackdrop(microscopeBackdrop));
createDefaultDishes();
setupTooltips(tooltipLayer, () => tooltipsEnabled);
updateHud();
requestAnimationFrame(animate);

function createDefaultDishes(): void {
  const size = defaultDishSize(window.innerWidth);
  const positions = defaultDishPlacements(size, window.innerWidth, window.innerHeight);
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
  const size = options.size ?? defaultDishSize(window.innerWidth);
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
  if (!resizeDishCanvas(dish.canvas, factor)) {
    return;
  }
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
  updateFloatingDishLabel(dish.label, dish.canvas, dish.name, dish.zIndex);
}

function requireActiveDish(): DishInstance | null {
  if (!activeDish) {
    showToast('Select a petri dish first');
    return null;
  }
  return activeDish;
}

function addDish(setup: NewDishSetup = {}): void {
  const size = defaultDishSize(window.innerWidth);
  const placement = addedDishPlacement(dishes.length, size, window.innerWidth, window.innerHeight);
  const dish = createDish({
    ...placement,
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
  setNewDishCellCount(defaultNewDishCellCount());
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
  return setNewDishCellCountControls(newDishCellCountRange, newDishCellCountInput, value);
}

function resetNewDishRangeControls(): void {
  resetNewDishRanges(newDishResourceSliders, newDishEnvironmentSliders);
}

function readNewDishSetup(): NewDishSetup {
  return readNewDishSetupFromControls(newDishCellCountRange, newDishCellCountInput, newDishResourceSliders, newDishEnvironmentSliders);
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
  dropController.cancel();
  tutorialPreparedSteps = new Set<TutorialStepId>();
  const size = defaultDishSize(window.innerWidth, 430);
  const placement = tutorialDishPlacement(dishes.length, size, window.innerWidth, window.innerHeight);
  const dish = createDish({
    name: 'Tutorial Dish',
    ...placement,
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

  prepareTutorialScenario(step, {
    cell,
    spawnResource: spawnTutorialResource,
    spawnHazard: (position, potency) => simulation.spawnHazard(position, potency),
    spawnBlock: (position, width, height) => simulation.spawnBlock(position, width, height),
    spawnCell: (position, generation) => simulation.spawnCell(position, generation),
    offsetPoint: (origin, dx, dy) => offsetTutorialPoint(simulation.state.boardRadius, origin, dx, dy),
    showToast,
  });
}

function spawnTutorialResource(kind: ResourceKind, position: Vec2, message: string): void {
  simulation.spawnResource(kind, position, 1);
  showToast(message);
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
    writeCompletedTutorialMilestones(tutorialCompleted);
    showToast(`${step.title} complete`);
  }
  updateTutorialPanel();
}

function isTutorialStepComplete(step: TutorialStep): boolean {
  return isTutorialStepCompleteForState({
    step,
    cell: tutorialCell(),
    state: activeDish?.simulation.state ?? null,
    inspectedTarget,
    dnaButtons,
  });
}

function updateTutorialPanel(): void {
  if (!tutorialWindow || !tutorialMode) {
    return;
  }
  updateTutorialPanelContent({
    elements: {
      title: tutorialTitle,
      progress: tutorialProgress,
      stepTitle: tutorialStepTitle,
      stepDetail: tutorialStepDetail,
      goal: tutorialGoal,
      next: tutorialNext,
    },
    stepIndex: tutorialStepIndex,
    goalMet: tutorialGoalMet,
    completed: tutorialCompleted,
    onJump: (index) => goToTutorialStep(index, false),
  });
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
    const detections = scanDetections(selected, awareness, simulation.state);
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
  syncGameStats({
    dishCount: gameDishCount,
    cellCount: gameCellCount,
    runningCount: gameRunningCount,
  }, dishes);
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
  if (dishDetail) dishDetail.innerHTML = formatDishState(activeDish);
  if (dishList) {
    dishList.hidden = false;
    if (!dishList.contains(document.activeElement)) {
      const signature = currentDishPickerSignature(dishes);
      if (signature !== dishPickerSignature) {
        dishList.innerHTML = formatDishPickerList(dishes);
        dishPickerSignature = signature;
      }
    }
  }
  setMeter(energyMeter, 0);
  setMeter(massMeter, 0);
  setMeter(oxygenMeter, 0);
  setMeter(healthMeter, 0);
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
    const detections = scanDetections(selectedCell, awareness, simulation.state);
    if (entityName) {
      entityName.hidden = true;
    }
    if (entityDetail) entityDetail.innerHTML = formatCellState(selectedCell, detections, awareness, simulation.sensingProfile(selectedCell).clarity);
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
  const label = targetLabel(hoveredTarget, sourceDish.simulation.state);
  hoverWindowTitle.textContent = `Hover Info | ${sourceDish.name} | ${label}`;
  hoverDetail.innerHTML = formatHoverTarget(hoveredTarget, sourceDish);
}

function selectedEntityLabel(): string {
  if (!activeDish) {
    return 'Entity';
  }
  if (inspectedTarget.kind === 'dish') {
    return 'No entity selected';
  }
  return targetLabel(inspectedTarget, activeDish.simulation.state);
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
  syncGamePanelVisibility({
    metabolicDashboard,
    directiveIntro,
    transportControlsPanel,
    dnaButtonsPanel,
    selectedDishActions,
    addDishButton,
    deleteDishButton,
    dishActionButtons,
  }, Boolean(activeDish), hasSelectedCell);
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

function createSavePayload(): SaveData<TutorialStepId> {
  return createSavePayloadData({
    dishes,
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
  });
}

function loadGame(): void {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) {
    showToast('No saved game found');
    return;
  }

  try {
    const payload = JSON.parse(raw) as SaveData<TutorialStepId>;
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
  renderSaveSlotRows(saveSlotList, saveModalMode, saveToSlot, loadFromSlot);
}

function saveToSlot(index: number, name: string): void {
  const slot = writeSaveSlot(index, name, createSavePayload());
  renderSaveSlots();
  showToast(`Saved ${slot.name}`);
}

function loadFromSlot(index: number): void {
  const slot = readSlot<TutorialStepId>(index);
  if (!slot.data) {
    showToast('Save slot is empty');
    return;
  }
  applySaveData(slot.data, `Loaded ${slot.name}`);
  closeSaveModal();
}

function applySaveData(payload: SaveData<TutorialStepId>, message: string): void {
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

function handleDropItem(kind: DropItemKind, clientX: number, clientY: number): boolean {
  const targetDish = dishAtPoint(clientX, clientY);
  if (!targetDish) {
    showToast('Drop inside a petri dish');
    return false;
  }
  const position = targetDish.renderer.screenToWorld(clientX, clientY);
  const insideDish = distance(position, { x: 0, y: 0 }) <= targetDish.simulation.state.boardRadius - 2;
  if (!insideDish) {
    showToast('Drop inside the petri dish');
    return false;
  }

  if (kind === 'cotton-candy') {
    targetDish.simulation.dropCottonCandy(position);
    showToast('Cotton candy dissolved into glucose');
  } else {
    targetDish.simulation.dropCatPawn(position);
    showToast('Cat-pawn dissolved into poison');
  }
  updateHud();
  return true;
}

function dishAtPoint(clientX: number, clientY: number): DishInstance | null {
  return [...dishes]
    .sort((left, right) => right.zIndex - left.zIndex)
    .find((dish) => {
      const rect = dish.canvas.getBoundingClientRect();
      return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
    }) ?? null;
}

function sameTarget(left: MapPick | null, right: MapPick | null): boolean {
  return left?.kind === right?.kind && left?.id === right?.id;
}

function setDnaEnabled(enabled: boolean): void {
  setDnaEnabledControls(dnaButtons, transportControls, enabled);
}

function syncTransportControls(cell: Cell | null): void {
  syncTransportControlValues(transportControls, transportOutputs, cell);
}

function syncMetabolicDashboard(cell: Cell | null): void {
  syncMetabolicDashboardPanel({
    root: metabolicDashboard,
    atpCore,
    glucoseRate,
    glycogenRate,
    aminoRate,
    oxygenRate,
    atpNodeDelta,
    glucoseNodeDelta,
    glycogenNodeDelta,
    aminoNodeDelta,
    oxygenNodeDelta,
    lightFactor,
    rosDelta,
    autophagyDelta,
  }, cell, simulation.state.running);
}
