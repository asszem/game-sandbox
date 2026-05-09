import type { DishInstance } from './dish-types';
import type { AppElements } from './dom-elements';
import {
  syncDirectivePanel,
  syncDishStatePanel,
  syncHoverInfoPanel,
  syncSelectedCellMeters,
  syncSelectedEntityPanel,
  syncTopReadouts,
  syncWindowTitles,
} from '../hud/app-hud';
import { setDnaEnabled, syncDirectiveSelectsForComplexity, syncTransportControls } from '../hud/directives-panel';
import { syncGamePanelVisibility, syncGameStats } from '../hud/game-panel';
import { syncMetabolicDashboard } from '../hud/metabolism-panel';
import { syncTooltipToggle } from '../hud/tooltips';
import type { MapPick } from '../render/types';

export function syncMainHud(context: {
  elements: AppElements;
  dishes: DishInstance[];
  activeDish: DishInstance | null;
  inspectedTarget: MapPick;
  hoveredDish: DishInstance | null;
  hoveredTarget: MapPick | null;
  zoomPercent: number | null;
  tooltipsEnabled: boolean;
  dishPickerSignature: string;
  fittedEntityTargetKey: string;
  activeElement: Element | null;
  fitEntityWindow: () => void;
}): {
  dishPickerSignature: string;
  fittedEntityTargetKey: string;
} {
  const { elements, activeDish, inspectedTarget } = context;
  let dishPickerSignature = context.dishPickerSignature;
  let fittedEntityTargetKey = context.fittedEntityTargetKey;

  syncGameStats({
    dishCount: elements.gameDishCount,
    cellCount: elements.gameCellCount,
    runningCount: elements.gameRunningCount,
  }, context.dishes);
  syncTopReadouts({
    tickReadout: elements.tickReadout,
    populationReadout: elements.populationReadout,
    stateReadout: elements.stateReadout,
    zoomReadout: elements.zoomReadout,
  }, activeDish, context.zoomPercent);
  syncTooltipToggle(elements.tooltipToggle, elements.tooltipStatus, context.tooltipsEnabled);
  syncHoverInfoPanel({
    hoverWindowTitle: elements.hoverWindowTitle,
    hoverDetail: elements.hoverDetail,
  }, context.hoveredDish, context.hoveredTarget, activeDish);
  syncWindowTitles({
    dishWindowTitle: elements.dishWindowTitle,
    entityWindowTitle: elements.entityWindowTitle,
    directivesWindowTitle: elements.directivesWindowTitle,
  }, activeDish, inspectedTarget);
  dishPickerSignature = syncDishStatePanel({
    dishName: elements.dishName,
    dishDetail: elements.dishDetail,
    dishList: elements.dishList,
    energyMeter: elements.energyMeter,
    massMeter: elements.massMeter,
    oxygenMeter: elements.oxygenMeter,
    healthMeter: elements.healthMeter,
  }, activeDish, context.dishes, dishPickerSignature, context.activeElement);
  syncSelectedCellMeters({
    energyMeter: elements.energyMeter,
    massMeter: elements.massMeter,
    oxygenMeter: elements.oxygenMeter,
    healthMeter: elements.healthMeter,
  }, null);

  if (!activeDish) {
    syncCellOnlyPanels(elements, false, false);
    syncDirectiveSelectsForComplexity(elements.directiveSelects, null, 1);
    syncSelectedEntityPanel({ entityName: elements.entityName, entityDetail: elements.entityDetail }, null, inspectedTarget, null);
    syncDirectivePanel({ directiveHeading: elements.directiveHeading, directiveDetail: elements.directiveDetail }, null, null);
    return {
      dishPickerSignature,
      fittedEntityTargetKey: fitEntityWindowIfNeeded(context, fittedEntityTargetKey),
    };
  }

  const selected = inspectedTarget.kind === 'cell' ? activeDish.simulation.selectedCell : null;
  syncCellOnlyPanels(elements, true, Boolean(selected));
  if (selected) {
    syncSelectedEntityPanel({ entityName: elements.entityName, entityDetail: elements.entityDetail }, activeDish, inspectedTarget, selected);
    syncDirectivePanel({ directiveHeading: elements.directiveHeading, directiveDetail: elements.directiveDetail }, activeDish, selected);
    syncSelectedCellMeters({
      energyMeter: elements.energyMeter,
      massMeter: elements.massMeter,
      oxygenMeter: elements.oxygenMeter,
      healthMeter: elements.healthMeter,
    }, selected);
    syncMetabolism(elements, selected, activeDish.simulation.state.running, activeDish.simulation.state.cellComplexity, activeDish.simulation.state);
    syncTransportControls(elements.transportControls, elements.transportOutputs, selected, activeDish.simulation.state.cellComplexity);
    syncDirectiveSelectsForComplexity(elements.directiveSelects, selected, activeDish.simulation.state.cellComplexity);
    setDnaEnabled(elements.dnaButtons, elements.transportControls, true);
    return {
      dishPickerSignature,
      fittedEntityTargetKey: fitEntityWindowIfNeeded(context, fittedEntityTargetKey),
    };
  }

  setDnaEnabled(elements.dnaButtons, elements.transportControls, false);
  syncMetabolism(elements, null, activeDish.simulation.state.running, activeDish.simulation.state.cellComplexity, activeDish.simulation.state);
  syncTransportControls(elements.transportControls, elements.transportOutputs, null, activeDish.simulation.state.cellComplexity);
  syncDirectiveSelectsForComplexity(elements.directiveSelects, null, activeDish.simulation.state.cellComplexity);
  syncSelectedEntityPanel({ entityName: elements.entityName, entityDetail: elements.entityDetail }, activeDish, inspectedTarget, null);
  syncDirectivePanel({ directiveHeading: elements.directiveHeading, directiveDetail: elements.directiveDetail }, activeDish, null);
  return {
    dishPickerSignature,
    fittedEntityTargetKey: fitEntityWindowIfNeeded(context, fittedEntityTargetKey),
  };
}

function syncCellOnlyPanels(elements: AppElements, hasActiveDish: boolean, hasSelectedCell: boolean): void {
  syncGamePanelVisibility({
    metabolicDashboard: elements.metabolicDashboard,
    directiveIntro: elements.directiveIntro,
    transportControlsPanel: elements.transportControlsPanel,
    dnaButtonsPanel: elements.dnaButtonsPanel,
    selectedDishActions: elements.selectedDishActions,
    addDishButton: elements.addDishButton,
    deleteDishButton: elements.deleteDishButton,
    dishActionButtons: elements.dishActionButtons,
  }, hasActiveDish, hasSelectedCell);
}

function syncMetabolism(
  elements: AppElements,
  cell: Parameters<typeof syncMetabolicDashboard>[1],
  running: boolean,
  complexity: number,
  state: Parameters<typeof syncMetabolicDashboard>[4] = null,
): void {
  syncMetabolicDashboard({
    root: elements.metabolicDashboard,
    sensorAtpCost: elements.sensorAtpCost,
    sensorRangeValue: elements.sensorRangeValue,
    sensorDetections: elements.sensorDetections,
    movementAtpCost: elements.movementAtpCost,
    metabolismAtpCost: elements.metabolismAtpCost,
    healthAtpCost: elements.healthAtpCost,
    externalGlucoseInput: elements.externalGlucoseInput,
    glucosePoolValue: elements.glucosePoolValue,
    glucosePoolDelta: elements.glucosePoolDelta,
    glycolysisProcessValue: elements.glycolysisProcessValue,
    atpPoolValue: elements.atpPoolValue,
    atpPoolDelta: elements.atpPoolDelta,
    healthUpkeepFactor: elements.healthUpkeepFactor,
    cellHealthValue: elements.cellHealthValue,
    cellHealthDelta: elements.cellHealthDelta,
    atpCore: elements.atpCore,
    glucoseRate: elements.glucoseRate,
    glycogenRate: elements.glycogenRate,
    aminoRate: elements.aminoRate,
    oxygenRate: elements.oxygenRate,
    atpNodeDelta: elements.atpNodeDelta,
    glucoseNodeDelta: elements.glucoseNodeDelta,
    glycogenNodeDelta: elements.glycogenNodeDelta,
    aminoNodeDelta: elements.aminoNodeDelta,
    oxygenNodeDelta: elements.oxygenNodeDelta,
    g6pRate: elements.g6pRate,
    g6pNodeDelta: elements.g6pNodeDelta,
    glycolysisRate: elements.glycolysisRate,
    pyruvateRate: elements.pyruvateRate,
    pyruvateNodeDelta: elements.pyruvateNodeDelta,
    respirationRate: elements.respirationRate,
    lactateRate: elements.lactateRate,
    lactateNodeDelta: elements.lactateNodeDelta,
    proteinRate: elements.proteinRate,
    proteinNodeDelta: elements.proteinNodeDelta,
    stressSignalRate: elements.stressSignalRate,
    damageNodeDelta: elements.damageNodeDelta,
    lightFactor: elements.lightFactor,
    rosDelta: elements.rosDelta,
    damageRate: elements.damageRate,
    autophagyDelta: elements.autophagyDelta,
    balanceImpact: elements.balanceImpact,
    positiveBalanceValue: elements.positiveBalanceValue,
    negativeBalanceValue: elements.negativeBalanceValue,
    overallHealthValue: elements.overallHealthValue,
    overallHealthDelta: elements.overallHealthDelta,
    metabolicHealthImpactList: elements.metabolicHealthImpactList,
    cellGenerationValue: elements.cellGenerationValue,
    cellSizeValue: elements.cellSizeValue,
  }, cell, running, complexity, state);
}

function fitEntityWindowIfNeeded(context: {
  activeDish: DishInstance | null;
  inspectedTarget: MapPick;
  fitEntityWindow: () => void;
}, currentKey: string): string {
  const nextKey = context.activeDish
    ? `${context.activeDish.id}:${context.inspectedTarget.kind}:${context.inspectedTarget.id ?? 'dish'}`
    : 'none';
  if (nextKey !== currentKey) {
    context.fitEntityWindow();
  }
  return nextKey;
}
