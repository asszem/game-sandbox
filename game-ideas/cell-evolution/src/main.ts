import './styles/index.css';
import { bindDirectiveSelects, bindDishActionButtons, bindDishLayerClear, bindDishList, bindDishStateControls, bindDnaButtons, bindGlobalShortcuts, bindNewDishModal, bindSaveModal, bindTooltipToggle, bindTransportControls, bindTutorialControls } from './app/app-events';
import { drawMicroscopeBackdrop } from './app/backdrop';
import { DishManager, MAX_DISH_COUNT } from './app/dish-manager';
import { addedDishPlacement, defaultDishSize } from './app/dish-layout';
import type { DishInstance } from './app/dish-types';
import { queryAppElements } from './app/dom-elements';
import { handleDishItemDrop } from './app/drop-handler';
import { createDropController, type DropItemKind } from './app/drop-tools';
import { createGameLoop } from './app/game-loop';
import { syncMainHud } from './app/hud-sync';
import { defaultNewDishBoardRadius, defaultNewDishCellCount, defaultNewDishComplexity, defaultNewDishSetup, readNewDishSetup as readNewDishSetupFromControls, resetNewDishRangeControls as resetNewDishRanges, setNewDishBoardRadius as setNewDishBoardRadiusControl, setNewDishCellCount as setNewDishCellCountControls, type NewDishSetup } from './app/new-dish';
import { applySavedWorld } from './app/save-apply';
import { SAVE_KEY, createSavePayload as createSavePayloadData, type SaveData } from './app/save-load';
import { createSaveModalController } from './app/save-modal';
import { createTutorialController } from './app/tutorial-controller';
import type { TutorialStepId } from './app/tutorial';
import { currentDishPickerSignature, sanitizeDishName } from './hud/state-panel';
import { createToastRegion } from './hud/toasts';
import { hideTooltip, setupTooltips, syncTooltipToggle } from './hud/tooltips';
import { createWindowSystem } from './hud/windows';
import { PetriDishRenderer } from './render/PetriDishRenderer';
import type { MapPick } from './render/types';

let activeDish: DishInstance | null = null;
let simulation: DishInstance['simulation'];
let renderer: PetriDishRenderer;

const appElements = queryAppElements();
const {
  dishLayer: dishLayerElement,
  microscopeBackdrop,
  tooltipToggle,
  tooltipStatus,
  dishDetail,
  dishList,
  dnaButtons,
  transportControls,
  directiveSelects,
  dishActionButtons,
  dropItemButtons,
  toastRegion,
  tooltipLayer,
  newDishModal,
  newDishModalClose,
  newDishRadiusRange,
  newDishCellCountRange,
  newDishCellCountInput,
  newDishComplexitySelect,
  newDishResourceSliders,
  newDishEnvironmentSliders,
  newDishCancel,
  newDishCreate,
  tutorialWindow,
  tutorialTitle,
  tutorialProgress,
  tutorialStepTitle,
  tutorialStepDetail,
  tutorialGoal,
  tutorialRestart,
  tutorialNext,
  tutorialExit,
  saveModal,
  saveModalTitle,
  saveModalClose,
  saveSlotList,
} = appElements;
const showToast = createToastRegion(toastRegion);
const windowSystem = createWindowSystem();
const dishManager = new DishManager(dishLayerElement, {
  selectDish: setActiveDish,
  updateHud,
  isHoveredDish: (dish) => hoveredDish === dish,
  setHoveredDishTarget: (dish, target) => {
    hoveredDish = dish;
    hoveredTarget = target;
  },
});
const dishes = dishManager.dishes;

const tickMs = 150;
let inspectedTarget: MapPick = { kind: 'dish', id: null };
let hoveredTarget: MapPick | null = { kind: 'dish', id: null };
let hoveredDish: DishInstance | null = null;
let tooltipsEnabled = true;
let fittedEntityTargetKey = '';
let dishPickerSignature = '';

const dropController = createDropController({
  buttons: dropItemButtons,
  onBegin: () => hideTooltip(tooltipLayer),
  onDrop: handleDropItem,
});
const saveModalController = createSaveModalController<TutorialStepId>({
  modal: saveModal,
  slotList: saveSlotList,
  title: saveModalTitle,
}, {
  createPayload: createSavePayload,
  applyPayload: applySaveData,
  showToast,
});
const tutorialController = createTutorialController({
  elements: {
    window: tutorialWindow,
    title: tutorialTitle,
    progress: tutorialProgress,
    stepTitle: tutorialStepTitle,
    stepDetail: tutorialStepDetail,
    goal: tutorialGoal,
    next: tutorialNext,
  },
  dishManager,
  dropController,
  dnaButtons,
  getActiveDish: () => activeDish,
  getInspectedTarget: () => inspectedTarget,
  setActiveDish,
  updateHud,
  showToast,
});

bindDishLayerClear(dishLayerElement, clearActiveDish);
bindGlobalShortcuts({
  saveModal,
  newDishModal,
}, {
  hasActiveDish: () => Boolean(activeDish),
  canToggleRunning: () => tutorialController.canRunSimulation(),
  toggleActiveDishRunning: () => {
    simulation.toggleRunning();
    updateHud();
  },
  toggleAllDishesRunning,
  restartScenario,
  startTutorial: tutorialController.start,
  saveGame,
  loadGame,
  resetActiveDishZoom: () => {
    renderer.resetZoom();
    updateHud();
  },
  selectDishByNumber: selectDishByNumber,
  toggleTooltips: () => setTooltipsEnabled(!tooltipsEnabled, true),
  closeSaveModal: saveModalController.close,
  closeNewDishModal,
  showToast,
});

function selectDishByNumber(id: number): void {
  const dish = dishes.find((item) => item.id === id);
  if (dish) {
    setActiveDish(dish, dish.inspectedTarget);
  }
}

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

bindTooltipToggle(tooltipToggle, (enabled) => setTooltipsEnabled(enabled, true));
bindDnaButtons(dnaButtons, {
  selectedCell: () => simulation.selectedCell,
  infuseDNA: (key) => simulation.infuseDNA(key),
  isTutorialMode: tutorialController.isMode,
  updateHud,
});
bindTransportControls(transportControls, {
  selectedCell: () => simulation.selectedCell,
  updateHud,
});
bindDirectiveSelects(directiveSelects, {
  selectedCell: () => simulation.selectedCell,
  updateHud,
});
bindDishActionButtons(dishActionButtons, {
  add: openNewDishModal,
  delete: deleteActiveDish,
  tutorial: tutorialController.start,
  restart: restartScenario,
  random: randomScenario,
  save: () => saveModalController.open('save'),
  load: () => saveModalController.open('load'),
});
bindNewDishModal({
  modal: newDishModal,
  close: newDishModalClose,
  cancel: newDishCancel,
  create: newDishCreate,
  radiusRange: newDishRadiusRange,
  cellCountRange: newDishCellCountRange,
  cellCountInput: newDishCellCountInput,
  complexitySelect: newDishComplexitySelect,
  resourceSliders: newDishResourceSliders,
  environmentSliders: newDishEnvironmentSliders,
}, {
  close: closeNewDishModal,
  create: () => addDish(readNewDishSetup()),
  setRadius: setNewDishBoardRadius,
  setCellCount: setNewDishCellCount,
});
bindDishList<DishInstance>(dishList, {
  findDish: (id) => dishes.find((item) => item.id === id) ?? null,
  selectDish: (dish) => setActiveDish(dish, dish.inspectedTarget),
  renameDishDraft: (dish, name) => {
    dish.name = name.slice(0, 32);
    updateDishLabel(dish);
    dishPickerSignature = currentDishPickerSignature(dishes);
  },
  renameDishCommit: (dish, input) => {
    dish.name = sanitizeDishName(input.value, dish.id);
    input.value = dish.name;
    updateDishLabel(dish);
    dishPickerSignature = currentDishPickerSignature(dishes);
  },
});
bindDishStateControls(dishDetail, {
  setRadius: (radius) => {
    const dish = requireActiveDish();
    if (!dish) {
      return null;
    }
    dish.simulation.setBoardRadius(radius);
    return dish.simulation.state.boardRadius;
  },
});
bindTutorialControls({
  restart: tutorialRestart,
  next: tutorialNext,
  exit: tutorialExit,
}, {
  canAdvance: tutorialController.canAdvance,
  restart: tutorialController.restart,
  advance: tutorialController.advance,
  exit: tutorialController.exit,
});
bindSaveModal({
  modal: saveModal,
  close: saveModalClose,
}, saveModalController.close);

drawMicroscopeBackdrop(microscopeBackdrop);
window.addEventListener('resize', () => drawMicroscopeBackdrop(microscopeBackdrop));
setupTooltips(tooltipLayer, () => tooltipsEnabled);
tutorialController.start();
const animate = createGameLoop({
  dishes: () => dishes,
  tickMs,
  updateTutorialProgress: tutorialController.updateProgress,
  updateHud,
});
requestAnimationFrame(animate);

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
  dishManager.bringToFront(dish);
  dishManager.syncSelectionClasses(activeDish);
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
  dishManager.syncSelectionClasses(activeDish);
  updateHud();
}

function updateDishLabel(dish: DishInstance): void {
  dishManager.updateDishLabel(dish);
}

function requireActiveDish(): DishInstance | null {
  if (!activeDish) {
    showToast('Select a petri dish first');
    return null;
  }
  return activeDish;
}

function addDish(setup: NewDishSetup = {}): void {
  if (dishes.length >= MAX_DISH_COUNT) {
    showToast(`Maximum ${MAX_DISH_COUNT} dishes reached`);
    return;
  }
  const size = defaultDishSize(window.innerWidth);
  const placement = addedDishPlacement(dishes.length, size, window.innerWidth, window.innerHeight);
  const dish = dishManager.createDish({
    ...placement,
    size,
    select: true,
    setup,
  });
  setActiveDish(dish, { kind: 'dish', id: null });
  showToast('New dish added');
}

function openNewDishModal(): void {
  if (dishes.length >= MAX_DISH_COUNT) {
    showToast(`Maximum ${MAX_DISH_COUNT} dishes reached`);
    return;
  }
  if (!newDishModal) {
    addDish(defaultNewDishSetup());
    return;
  }
  setNewDishBoardRadius(defaultNewDishBoardRadius());
  setNewDishCellCount(defaultNewDishCellCount());
  setNewDishComplexity(defaultNewDishComplexity());
  resetNewDishRangeControls();
  newDishModal.hidden = false;
  newDishRadiusRange?.focus();
}

function closeNewDishModal(): void {
  if (newDishModal) {
    newDishModal.hidden = true;
  }
}

function setNewDishCellCount(value: number): number {
  return setNewDishCellCountControls(newDishCellCountRange, newDishCellCountInput, value);
}

function setNewDishBoardRadius(value: number): number {
  return setNewDishBoardRadiusControl(newDishRadiusRange, value);
}

function resetNewDishRangeControls(): void {
  resetNewDishRanges(newDishResourceSliders, newDishEnvironmentSliders);
}

function readNewDishSetup(): NewDishSetup {
  return readNewDishSetupFromControls(newDishRadiusRange, newDishCellCountRange, newDishCellCountInput, newDishComplexitySelect, newDishResourceSliders, newDishEnvironmentSliders);
}

function setNewDishComplexity(value: number): void {
  if (!newDishComplexitySelect) {
    return;
  }
  newDishComplexitySelect.value = String(value);
  const output = newDishComplexitySelect.closest('label')?.querySelector('output');
  if (output) {
    output.textContent = newDishComplexitySelect.value;
  }
}

function deleteActiveDish(): void {
  const dish = activeDish;
  if (!dish) {
    showToast('No dish selected');
    return;
  }
  dishManager.deleteDish(dish);
  clearActiveDish();
  showToast('Petri dish deleted');
}

function updateHud(): void {
  const next = syncMainHud({
    elements: appElements,
    dishes,
    activeDish,
    inspectedTarget,
    hoveredDish,
    hoveredTarget,
    zoomPercent: activeDish ? renderer.getZoomPercent() : null,
    tooltipsEnabled,
    dishPickerSignature,
    fittedEntityTargetKey,
    activeElement: document.activeElement,
    fitEntityWindow: () => windowSystem.fitHeight('entity'),
  });
  dishPickerSignature = next.dishPickerSignature;
  fittedEntityTargetKey = next.fittedEntityTargetKey;
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
    tutorial: tutorialController.exportState(),
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

function applySaveData(payload: SaveData<TutorialStepId>, message: string): void {
  const restored = applySavedWorld(payload, {
    dishManager,
    dishes,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    tutorialStepCount: tutorialController.stepCount(),
    tutorialCompleted: tutorialController.completed(),
  });
  if (!restored) {
    showToast('Save version not supported');
    return;
  }

  activeDish = null;
  inspectedTarget = { kind: 'dish', id: null };
  hoveredDish = null;
  hoveredTarget = null;
  tutorialController.restore(restored.tutorial);

  if (restored.activeDish) {
    setActiveDish(restored.activeDish, restored.activeDish.inspectedTarget);
  } else {
    clearActiveDish();
  }
  setTooltipsEnabled(payload.tooltipsEnabled ?? true, false);
  windowSystem.applyLayout(payload.windowLayout ?? {});
  if (tutorialController.isMode()) {
    tutorialController.enterStep();
    tutorialController.updatePanel();
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
  const handled = handleDishItemDrop(dishes, kind, clientX, clientY, showToast);
  if (!handled) {
    return false;
  }
  updateHud();
  return true;
}
