import type { DishInstance } from '../app/dish-types';
import type { Cell } from '../core/types';
import type { MapPick } from '../render/types';
import type { AppElements } from '../app/dom-elements';
import { currentDirective, formatCellState, formatNavigationState, scanDetections } from './entity-panel';
import { formatHoverTarget, targetLabel } from './hover-info';
import { currentDishPickerSignature, formatDishPickerList, formatDishState } from './state-panel';

type TopReadoutElements = Pick<AppElements, 'tickReadout' | 'populationReadout' | 'stateReadout' | 'zoomReadout'>;
type DishStateElements = Pick<AppElements, 'dishName' | 'dishDetail' | 'dishList' | 'energyMeter' | 'massMeter' | 'oxygenMeter' | 'healthMeter'>;
type EntityElements = Pick<AppElements, 'entityName' | 'entityDetail'>;
type DirectiveElements = Pick<AppElements, 'directiveHeading' | 'directiveDetail'>;
type HoverElements = Pick<AppElements, 'hoverWindowTitle' | 'hoverDetail'>;
type TitleElements = Pick<AppElements, 'dishWindowTitle' | 'entityWindowTitle' | 'directivesWindowTitle'>;
type MeterElements = Pick<AppElements, 'energyMeter' | 'massMeter' | 'oxygenMeter' | 'healthMeter'>;

export function syncTopReadouts(elements: TopReadoutElements, dish: DishInstance | null, zoomPercent: number | null): void {
  if (!dish) {
    if (elements.tickReadout) {
      elements.tickReadout.textContent = 'No dish';
    }
    if (elements.populationReadout) {
      elements.populationReadout.textContent = '0 cells';
    }
    if (elements.stateReadout) {
      elements.stateReadout.textContent = 'Paused';
      elements.stateReadout.dataset.state = 'paused';
    }
    if (elements.zoomReadout) {
      elements.zoomReadout.textContent = 'No dish selected';
    }
    return;
  }

  const state = dish.simulation.state;
  if (elements.tickReadout) {
    elements.tickReadout.textContent = `Tick ${state.tick}`;
  }
  if (elements.populationReadout) {
    elements.populationReadout.textContent = `${state.cells.length} cells`;
  }
  if (elements.stateReadout) {
    elements.stateReadout.textContent = state.running ? 'Running' : 'Paused';
    elements.stateReadout.dataset.state = state.running ? 'running' : 'paused';
  }
  if (elements.zoomReadout) {
    elements.zoomReadout.textContent = `Zoom ${zoomPercent ?? 100}%`;
  }
}

export function setMeter(meter: HTMLMeterElement | null, value: number): void {
  if (meter) {
    meter.value = Math.max(0, Math.min(1, value));
  }
}

export function syncSelectedCellMeters(elements: MeterElements, cell: Cell | null): void {
  if (!cell) {
    setMeter(elements.energyMeter, 0);
    setMeter(elements.massMeter, 0);
    setMeter(elements.oxygenMeter, 0);
    setMeter(elements.healthMeter, 0);
    return;
  }
  setMeter(elements.energyMeter, cell.atp / 100);
  setMeter(elements.massMeter, cell.aminoAcids / 100);
  setMeter(elements.oxygenMeter, cell.oxygen / 100);
  setMeter(elements.healthMeter, cell.health);
}

export function syncDishStatePanel(
  elements: DishStateElements,
  activeDish: DishInstance | null,
  dishes: DishInstance[],
  dishPickerSignature: string,
  activeElement: Element | null,
): string {
  if (elements.dishName) {
    elements.dishName.hidden = Boolean(activeDish);
    elements.dishName.textContent = activeDish ? '' : 'No dish selected';
  }
  if (elements.dishDetail) {
    const activeRadiusControl = activeElement instanceof HTMLInputElement
      && activeElement.dataset.dishRadius !== undefined
      && elements.dishDetail.contains(activeElement);
    if (!activeRadiusControl) {
      elements.dishDetail.innerHTML = formatDishState(activeDish);
    }
  }
  if (elements.dishList) {
    elements.dishList.hidden = false;
    if (!elements.dishList.contains(activeElement)) {
      const signature = `${currentDishPickerSignature(dishes)}|active:${activeDish?.id ?? 'none'}`;
      if (signature !== dishPickerSignature) {
        elements.dishList.innerHTML = formatDishPickerList(dishes, activeDish);
        return signature;
      }
    }
  }
  return dishPickerSignature;
}

export function syncSelectedEntityPanel(
  elements: EntityElements,
  activeDish: DishInstance | null,
  inspectedTarget: MapPick,
  selectedCell: Cell | null,
): void {
  if (!activeDish) {
    if (elements.entityName) {
      elements.entityName.hidden = false;
      elements.entityName.textContent = 'No entity selected';
    }
    if (elements.entityDetail) {
      elements.entityDetail.textContent = 'Select a dish, then click a cell, resource, poison cloud, or mineral block.';
    }
    return;
  }

  if (selectedCell) {
    const awareness = activeDish.simulation.awarenessRadius(selectedCell);
    const detections = scanDetections(selectedCell, awareness, activeDish.simulation.state);
    if (elements.entityName) {
      elements.entityName.hidden = true;
    }
    if (elements.entityDetail) {
      elements.entityDetail.innerHTML = formatCellState(selectedCell);
    }
    return;
  }

  if (elements.entityName) {
    elements.entityName.hidden = false;
  }
  if (inspectedTarget.kind === 'dish') {
    if (elements.entityName) {
      elements.entityName.textContent = 'No entity selected';
    }
    if (elements.entityDetail) {
      elements.entityDetail.textContent = `Dish ${activeDish.id} is selected. Click an entity inside this dish to inspect it.`;
    }
    return;
  }

  if (elements.entityName) {
    elements.entityName.hidden = true;
  }
  if (elements.entityDetail) {
    elements.entityDetail.innerHTML = formatHoverTarget(inspectedTarget, activeDish);
  }
}

export function syncDirectivePanel(elements: DirectiveElements, activeDish: DishInstance | null, selectedCell: Cell | null): void {
  if (!selectedCell || !activeDish) {
    if (elements.directiveHeading) {
      elements.directiveHeading.textContent = 'No cell selected';
    }
    if (elements.directiveDetail) {
      elements.directiveDetail.textContent = activeDish
        ? `Select a cell in dish ${activeDish.id} to tune sensing, movement, search preference, and DNA traits.`
        : 'Select a dish, then select a cell to tune sensing, movement, search preference, and DNA traits.';
    }
    return;
  }

  const awareness = activeDish.simulation.awarenessRadius(selectedCell);
  const detections = scanDetections(selectedCell, awareness, activeDish.simulation.state);
  if (elements.directiveHeading) {
    elements.directiveHeading.textContent = currentDirective(selectedCell, detections, awareness);
  }
  if (elements.directiveDetail) {
    elements.directiveDetail.innerHTML = formatNavigationState(
      selectedCell,
      detections,
      awareness,
      activeDish.simulation.sensingProfile(selectedCell).clarity,
    );
  }
}

export function syncHoverInfoPanel(
  elements: HoverElements,
  hoveredDish: DishInstance | null,
  hoveredTarget: MapPick | null,
  activeDish: DishInstance | null,
): void {
  if (!elements.hoverWindowTitle || !elements.hoverDetail) {
    return;
  }
  const sourceDish = hoveredDish ?? activeDish;
  if (!hoveredTarget || !sourceDish) {
    elements.hoverWindowTitle.textContent = 'Hover Info | No dish | Nothing';
    elements.hoverDetail.innerHTML = '<div class="hover-fact-grid"><span class="hover-fact" data-tooltip="Move over any dish item to see a compact breakdown here."><span>Hint</span><strong>Hover a dish entity</strong></span></div>';
    return;
  }
  const label = targetLabel(hoveredTarget, sourceDish.simulation.state);
  elements.hoverWindowTitle.textContent = `Hover Info | ${sourceDish.name} | ${label}`;
  elements.hoverDetail.innerHTML = formatHoverTarget(hoveredTarget, sourceDish);
}

export function selectedEntityLabel(activeDish: DishInstance | null, inspectedTarget: MapPick): string {
  if (!activeDish) {
    return 'Entity';
  }
  if (inspectedTarget.kind === 'dish') {
    return 'No entity selected';
  }
  return targetLabel(inspectedTarget, activeDish.simulation.state);
}

export function syncWindowTitles(elements: TitleElements, activeDish: DishInstance | null, inspectedTarget: MapPick): void {
  const dishLabel = activeDish ? activeDish.name : 'No dish';
  const entityLabel = selectedEntityLabel(activeDish, inspectedTarget);
  if (elements.dishWindowTitle) {
    elements.dishWindowTitle.textContent = `${dishLabel} | State`;
  }
  if (elements.entityWindowTitle) {
    elements.entityWindowTitle.textContent = activeDish && inspectedTarget.kind === 'cell'
      ? `${dishLabel} | ${entityLabel} | Homeostasis`
      : activeDish
        ? `${dishLabel} | ${entityLabel}`
        : 'No dish | Entity';
  }
  if (elements.directivesWindowTitle) {
    elements.directivesWindowTitle.textContent = activeDish && inspectedTarget.kind === 'cell'
      ? `${dishLabel} | ${entityLabel} | Navigation`
      : `${dishLabel} | Navigation`;
  }
}
