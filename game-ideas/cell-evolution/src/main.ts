import './styles/index.css';
import { bindDishActionButtons, bindDishLayerClear, bindDishList, bindDnaButtons, bindGlobalShortcuts, bindNewDishModal, bindSaveModal, bindTooltipToggle, bindTransportControls, bindTutorialControls } from './app/app-events';
import { drawMicroscopeBackdrop } from './app/backdrop';
import { DishManager } from './app/dish-manager';
import { addedDishPlacement, defaultDishSize, tutorialDishPlacement } from './app/dish-layout';
import type { DishInstance } from './app/dish-types';
import { queryAppElements } from './app/dom-elements';
import { handleDishItemDrop } from './app/drop-handler';
import { createDropController, type DropItemKind } from './app/drop-tools';
import { createGameLoop } from './app/game-loop';
import { defaultNewDishCellCount, defaultNewDishSetup, readNewDishSetup as readNewDishSetupFromControls, resetNewDishRangeControls as resetNewDishRanges, setNewDishCellCount as setNewDishCellCountControls, type NewDishSetup } from './app/new-dish';
import { SAVE_KEY, createSavePayload as createSavePayloadData, readSlot, renderSaveSlots as renderSaveSlotRows, restoreTutorialState, savedDishesFromPayload, saveToSlot as writeSaveSlot, type SaveData } from './app/save-load';
import { offsetTutorialPoint, prepareTutorialScenario } from './app/tutorial-scenarios';
import { isTutorialStepComplete as isTutorialStepCompleteForState, readCompletedTutorialMilestones, tutorialSteps, updateTutorialPanel as updateTutorialPanelContent, writeCompletedTutorialMilestones, type TutorialStep, type TutorialStepId } from './app/tutorial';
import type { Cell, ResourceKind, Vec2 } from './core/types';
import { clamp } from './core/vector';
import { setDnaEnabled as setDnaEnabledControls, syncTransportControls as syncTransportControlValues } from './hud/directives-panel';
import { currentDirective, describeCellDirective, formatCellState, scanDetections } from './hud/entity-panel';
import { syncGamePanelVisibility, syncGameStats } from './hud/game-panel';
import { describeHoverTarget, describeResource, formatHoverTarget, targetLabel } from './hud/hover-info';
import { syncMetabolicDashboard as syncMetabolicDashboardPanel } from './hud/metabolism-panel';
import { currentDishPickerSignature, formatDishPickerList, formatDishState, sanitizeDishName } from './hud/state-panel';
import { createToastRegion } from './hud/toasts';
import { hideTooltip, setupTooltips, syncTooltipToggle } from './hud/tooltips';
import { createWindowSystem } from './hud/windows';
import { PetriDishRenderer } from './render/PetriDishRenderer';
import type { MapPick } from './render/types';

let activeDish: DishInstance | null = null;
let simulation: DishInstance['simulation'];
let renderer: PetriDishRenderer;

const {
  dishLayer: dishLayerElement,
  microscopeBackdrop,
  tickReadout,
  populationReadout,
  stateReadout,
  zoomReadout,
  gameDishCount,
  gameCellCount,
  gameRunningCount,
  tooltipToggle,
  tooltipStatus,
  dishWindowTitle,
  dishName,
  dishDetail,
  dishList,
  entityWindowTitle,
  entityName,
  entityDetail,
  directivesWindowTitle,
  hoverWindowTitle,
  hoverDetail,
  directiveHeading,
  directiveDetail,
  metabolicDashboard,
  directiveIntro,
  transportControlsPanel,
  dnaButtonsPanel,
  energyMeter,
  massMeter,
  oxygenMeter,
  healthMeter,
  dnaButtons,
  transportControls,
  transportOutputs,
  dishActionButtons,
  addDishButton,
  deleteDishButton,
  selectedDishActions,
  dropItemButtons,
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
  toastRegion,
  tooltipLayer,
  newDishModal,
  newDishModalClose,
  newDishCellCountRange,
  newDishCellCountInput,
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
  tutorialNext,
  tutorialExit,
  saveModal,
  saveModalTitle,
  saveModalClose,
  saveSlotList,
} = queryAppElements();
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

bindDishLayerClear(dishLayerElement, clearActiveDish);
bindGlobalShortcuts({
  saveModal,
  newDishModal,
}, {
  hasActiveDish: () => Boolean(activeDish),
  toggleActiveDishRunning: () => {
    simulation.toggleRunning();
    updateHud();
  },
  toggleAllDishesRunning,
  restartScenario,
  saveGame,
  loadGame,
  resetActiveDishZoom: () => {
    renderer.resetZoom();
    updateHud();
  },
  toggleTooltips: () => setTooltipsEnabled(!tooltipsEnabled, true),
  closeSaveModal,
  closeNewDishModal,
  showToast,
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

bindTooltipToggle(tooltipToggle, (enabled) => setTooltipsEnabled(enabled, true));
bindDnaButtons(dnaButtons, {
  selectedCell: () => simulation.selectedCell,
  infuseDNA: (key) => simulation.infuseDNA(key),
  isTutorialMode: () => tutorialMode,
  updateHud,
});
bindTransportControls(transportControls, {
  selectedCell: () => simulation.selectedCell,
  updateHud,
});
bindDishActionButtons(dishActionButtons, {
  add: openNewDishModal,
  delete: deleteActiveDish,
  tutorial: () => startTutorial(0),
  restart: restartScenario,
  random: randomScenario,
  save: () => openSaveModal('save'),
  load: () => openSaveModal('load'),
});
bindNewDishModal({
  modal: newDishModal,
  close: newDishModalClose,
  cancel: newDishCancel,
  create: newDishCreate,
  cellCountRange: newDishCellCountRange,
  cellCountInput: newDishCellCountInput,
  resourceSliders: newDishResourceSliders,
  environmentSliders: newDishEnvironmentSliders,
}, {
  close: closeNewDishModal,
  create: () => addDish(readNewDishSetup()),
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
bindTutorialControls({
  next: tutorialNext,
  exit: tutorialExit,
}, {
  canAdvance: () => tutorialGoalMet,
  advance: () => goToTutorialStep(Math.min(tutorialStepIndex + 1, tutorialSteps.length - 1), false),
  exit: exitTutorial,
});
bindSaveModal({
  modal: saveModal,
  close: saveModalClose,
}, closeSaveModal);

drawMicroscopeBackdrop(microscopeBackdrop);
window.addEventListener('resize', () => drawMicroscopeBackdrop(microscopeBackdrop));
dishManager.createDefaultDishes();
clearActiveDish();
setupTooltips(tooltipLayer, () => tooltipsEnabled);
updateHud();
const animate = createGameLoop({
  dishes: () => dishes,
  tickMs,
  updateTutorialProgress,
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
  dishManager.deleteDish(dish);
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
  const dish = dishManager.createDish({
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
  dishManager.clearDishes();
  activeDish = null;
  inspectedTarget = { kind: 'dish', id: null };
  hoveredDish = null;
  hoveredTarget = null;
  const tutorial = restoreTutorialState(payload, tutorialSteps.length, tutorialCompleted);
  tutorialMode = tutorial.mode;
  tutorialStepIndex = tutorial.stepIndex;
  tutorialGoalMet = tutorial.goalMet;
  tutorialCompleted = tutorial.completed;
  tutorialPreparedSteps = tutorial.prepared;
  tutorialEnteredStep = null;

  for (const savedDish of savedDishesFromPayload(payload, window.innerWidth, window.innerHeight)) {
    dishManager.createDish({
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
  const handled = handleDishItemDrop(dishes, kind, clientX, clientY, showToast);
  if (!handled) {
    return false;
  }
  updateHud();
  return true;
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
