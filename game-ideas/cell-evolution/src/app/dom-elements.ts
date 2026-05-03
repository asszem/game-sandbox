export function queryAppElements(): AppElements {
  const dishLayer = document.querySelector<HTMLElement>('#dish-layer');
  if (!dishLayer) {
    throw new Error('Missing #dish-layer');
  }
  return {
    dishLayer,
    microscopeBackdrop: document.querySelector<HTMLCanvasElement>('#microscope-backdrop'),
    tickReadout: document.querySelector<HTMLElement>('#tick-readout'),
    populationReadout: document.querySelector<HTMLElement>('#population-readout'),
    stateReadout: document.querySelector<HTMLElement>('#state-readout'),
    zoomReadout: document.querySelector<HTMLElement>('#zoom-readout'),
    gameDishCount: document.querySelector<HTMLElement>('#game-dish-count'),
    gameCellCount: document.querySelector<HTMLElement>('#game-cell-count'),
    gameRunningCount: document.querySelector<HTMLElement>('#game-running-count'),
    tooltipToggle: document.querySelector<HTMLInputElement>('#tooltip-toggle'),
    tooltipStatus: document.querySelector<HTMLElement>('#tooltip-status'),
    dishWindowTitle: document.querySelector<HTMLElement>('#dish-window-title'),
    dishName: document.querySelector<HTMLElement>('#dish-name'),
    dishDetail: document.querySelector<HTMLElement>('#dish-detail'),
    dishList: document.querySelector<HTMLElement>('#dish-list'),
    entityWindowTitle: document.querySelector<HTMLElement>('#entity-window-title'),
    entityName: document.querySelector<HTMLElement>('#entity-name'),
    entityDetail: document.querySelector<HTMLElement>('#entity-detail'),
    directivesWindowTitle: document.querySelector<HTMLElement>('#directives-window-title'),
    hoverWindowTitle: document.querySelector<HTMLElement>('#hover-window-title'),
    hoverDetail: document.querySelector<HTMLElement>('#hover-detail'),
    directiveHeading: document.querySelector<HTMLElement>('#directive-heading'),
    directiveDetail: document.querySelector<HTMLElement>('#directive-detail'),
    metabolicDashboard: document.querySelector<HTMLElement>('.metabolic-dashboard'),
    directiveIntro: document.querySelector<HTMLElement>('.directives-panel .panel-head'),
    transportControlsPanel: document.querySelector<HTMLElement>('.transport-controls'),
    dnaButtonsPanel: document.querySelector<HTMLElement>('.dna-buttons'),
    energyMeter: document.querySelector<HTMLMeterElement>('#energy-meter'),
    massMeter: document.querySelector<HTMLMeterElement>('#mass-meter'),
    oxygenMeter: document.querySelector<HTMLMeterElement>('#oxygen-meter'),
    healthMeter: document.querySelector<HTMLMeterElement>('#health-meter'),
    dnaButtons: document.querySelectorAll<HTMLButtonElement>('[data-dna]'),
    transportControls: document.querySelectorAll<HTMLInputElement>('[data-control]'),
    transportOutputs: document.querySelectorAll<HTMLOutputElement>('[data-control-value]'),
    directiveSelects: document.querySelectorAll<HTMLSelectElement>('[data-cell-select]'),
    dishActionButtons: document.querySelectorAll<HTMLButtonElement>('[data-dish-action]'),
    addDishButton: document.querySelector<HTMLButtonElement>('[data-dish-action="add"]'),
    deleteDishButton: document.querySelector<HTMLButtonElement>('[data-dish-action="delete"]'),
    selectedDishActions: document.querySelector<HTMLElement>('.selected-dish-actions'),
    dropItemButtons: document.querySelectorAll<HTMLButtonElement>('[data-drop-item]'),
    atpCore: document.querySelector<HTMLElement>('#atp-core'),
    glucoseRate: document.querySelector<HTMLElement>('#glucose-rate'),
    glycogenRate: document.querySelector<HTMLElement>('#glycogen-rate'),
    aminoRate: document.querySelector<HTMLElement>('#amino-rate'),
    oxygenRate: document.querySelector<HTMLElement>('#oxygen-rate'),
    atpNodeDelta: document.querySelector<HTMLElement>('#atp-node-delta'),
    glucoseNodeDelta: document.querySelector<HTMLElement>('#glucose-node-delta'),
    glycogenNodeDelta: document.querySelector<HTMLElement>('#glycogen-node-delta'),
    aminoNodeDelta: document.querySelector<HTMLElement>('#amino-node-delta'),
    oxygenNodeDelta: document.querySelector<HTMLElement>('#oxygen-node-delta'),
    g6pRate: document.querySelector<HTMLElement>('#g6p-rate'),
    g6pNodeDelta: document.querySelector<HTMLElement>('#g6p-node-delta'),
    pyruvateRate: document.querySelector<HTMLElement>('#pyruvate-rate'),
    pyruvateNodeDelta: document.querySelector<HTMLElement>('#pyruvate-node-delta'),
    lactateRate: document.querySelector<HTMLElement>('#lactate-rate'),
    lactateNodeDelta: document.querySelector<HTMLElement>('#lactate-node-delta'),
    proteinRate: document.querySelector<HTMLElement>('#protein-rate'),
    proteinNodeDelta: document.querySelector<HTMLElement>('#protein-node-delta'),
    stressSignalRate: document.querySelector<HTMLElement>('#stress-signal-rate'),
    damageNodeDelta: document.querySelector<HTMLElement>('#damage-node-delta'),
    lightFactor: document.querySelector<HTMLElement>('#light-factor'),
    rosDelta: document.querySelector<HTMLElement>('#ros-delta'),
    damageRate: document.querySelector<HTMLElement>('#damage-rate'),
    autophagyDelta: document.querySelector<HTMLElement>('#autophagy-delta'),
    balanceImpact: document.querySelector<HTMLElement>('#balance-impact'),
    positiveBalanceValue: document.querySelector<HTMLElement>('#positive-balance-value'),
    negativeBalanceValue: document.querySelector<HTMLElement>('#negative-balance-value'),
    overallHealthValue: document.querySelector<HTMLElement>('#overall-health-value'),
    overallHealthDelta: document.querySelector<HTMLElement>('#overall-health-delta'),
    cellGenerationValue: document.querySelector<HTMLElement>('#cell-generation-value'),
    cellSizeValue: document.querySelector<HTMLElement>('#cell-size-value'),
    toastRegion: document.querySelector<HTMLElement>('#toast-region'),
    tooltipLayer: document.querySelector<HTMLElement>('#tooltip-layer'),
    newDishModal: document.querySelector<HTMLElement>('#new-dish-modal'),
    newDishModalClose: document.querySelector<HTMLButtonElement>('#new-dish-modal-close'),
    newDishRadiusRange: document.querySelector<HTMLInputElement>('#new-dish-radius-range'),
    newDishCellCountRange: document.querySelector<HTMLInputElement>('#new-dish-cell-count-range'),
    newDishCellCountInput: document.querySelector<HTMLInputElement>('#new-dish-cell-count-input'),
    newDishResourceSliders: document.querySelectorAll<HTMLInputElement>('[data-new-dish-resource]'),
    newDishEnvironmentSliders: document.querySelectorAll<HTMLInputElement>('[data-new-dish-environment]'),
    newDishCancel: document.querySelector<HTMLButtonElement>('#new-dish-cancel'),
    newDishCreate: document.querySelector<HTMLButtonElement>('#new-dish-create'),
    tutorialWindow: document.querySelector<HTMLElement>('.tutorial-window'),
    tutorialTitle: document.querySelector<HTMLElement>('#tutorial-title'),
    tutorialProgress: document.querySelector<HTMLElement>('#tutorial-progress'),
    tutorialStepTitle: document.querySelector<HTMLElement>('#tutorial-step-title'),
    tutorialStepDetail: document.querySelector<HTMLElement>('#tutorial-step-detail'),
    tutorialGoal: document.querySelector<HTMLElement>('#tutorial-goal'),
    tutorialNext: document.querySelector<HTMLButtonElement>('#tutorial-next'),
    tutorialExit: document.querySelector<HTMLButtonElement>('#tutorial-exit'),
    saveModal: document.querySelector<HTMLElement>('#save-modal'),
    saveModalTitle: document.querySelector<HTMLElement>('#save-modal-title'),
    saveModalClose: document.querySelector<HTMLButtonElement>('#save-modal-close'),
    saveSlotList: document.querySelector<HTMLElement>('#save-slot-list'),
  };
}

export type AppElements = {
  dishLayer: HTMLElement;
  microscopeBackdrop: HTMLCanvasElement | null;
  tickReadout: HTMLElement | null;
  populationReadout: HTMLElement | null;
  stateReadout: HTMLElement | null;
  zoomReadout: HTMLElement | null;
  gameDishCount: HTMLElement | null;
  gameCellCount: HTMLElement | null;
  gameRunningCount: HTMLElement | null;
  tooltipToggle: HTMLInputElement | null;
  tooltipStatus: HTMLElement | null;
  dishWindowTitle: HTMLElement | null;
  dishName: HTMLElement | null;
  dishDetail: HTMLElement | null;
  dishList: HTMLElement | null;
  entityWindowTitle: HTMLElement | null;
  entityName: HTMLElement | null;
  entityDetail: HTMLElement | null;
  directivesWindowTitle: HTMLElement | null;
  hoverWindowTitle: HTMLElement | null;
  hoverDetail: HTMLElement | null;
  directiveHeading: HTMLElement | null;
  directiveDetail: HTMLElement | null;
  metabolicDashboard: HTMLElement | null;
  directiveIntro: HTMLElement | null;
  transportControlsPanel: HTMLElement | null;
  dnaButtonsPanel: HTMLElement | null;
  energyMeter: HTMLMeterElement | null;
  massMeter: HTMLMeterElement | null;
  oxygenMeter: HTMLMeterElement | null;
  healthMeter: HTMLMeterElement | null;
  dnaButtons: NodeListOf<HTMLButtonElement>;
  transportControls: NodeListOf<HTMLInputElement>;
  transportOutputs: NodeListOf<HTMLOutputElement>;
  directiveSelects: NodeListOf<HTMLSelectElement>;
  dishActionButtons: NodeListOf<HTMLButtonElement>;
  addDishButton: HTMLButtonElement | null;
  deleteDishButton: HTMLButtonElement | null;
  selectedDishActions: HTMLElement | null;
  dropItemButtons: NodeListOf<HTMLButtonElement>;
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
  pyruvateRate: HTMLElement | null;
  pyruvateNodeDelta: HTMLElement | null;
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
  toastRegion: HTMLElement | null;
  tooltipLayer: HTMLElement | null;
  newDishModal: HTMLElement | null;
  newDishModalClose: HTMLButtonElement | null;
  newDishRadiusRange: HTMLInputElement | null;
  newDishCellCountRange: HTMLInputElement | null;
  newDishCellCountInput: HTMLInputElement | null;
  newDishResourceSliders: NodeListOf<HTMLInputElement>;
  newDishEnvironmentSliders: NodeListOf<HTMLInputElement>;
  newDishCancel: HTMLButtonElement | null;
  newDishCreate: HTMLButtonElement | null;
  tutorialWindow: HTMLElement | null;
  tutorialTitle: HTMLElement | null;
  tutorialProgress: HTMLElement | null;
  tutorialStepTitle: HTMLElement | null;
  tutorialStepDetail: HTMLElement | null;
  tutorialGoal: HTMLElement | null;
  tutorialNext: HTMLButtonElement | null;
  tutorialExit: HTMLButtonElement | null;
  saveModal: HTMLElement | null;
  saveModalTitle: HTMLElement | null;
  saveModalClose: HTMLButtonElement | null;
  saveSlotList: HTMLElement | null;
};
