import type { MapPick } from '../render/types';
import type { DishInstance } from './dish-types';

type DishEventHandlers = {
  selectDish: (dish: DishInstance, target: MapPick) => void;
  resizeDish: (dish: DishInstance, factor: number) => void;
  updateDishLabel: (dish: DishInstance) => void;
  updateHud: () => void;
  isHoveredDish: (dish: DishInstance) => boolean;
  setHoveredDishTarget: (dish: DishInstance | null, target: MapPick | null) => void;
};

export function bindDishCanvasEvents(dish: DishInstance, handlers: DishEventHandlers): void {
  dish.label.addEventListener('click', () => {
    handlers.selectDish(dish, dish.inspectedTarget);
  });

  dish.label.addEventListener('dblclick', (event) => {
    event.preventDefault();
    handlers.selectDish(dish, dish.inspectedTarget);
    dish.renderer.resetZoom();
    handlers.updateHud();
  });

  dish.canvas.addEventListener('contextmenu', (event) => {
    event.preventDefault();
  });

  dish.canvas.addEventListener('wheel', (event) => {
    if (!event.shiftKey) {
      return;
    }
    event.preventDefault();
    handlers.selectDish(dish, dish.inspectedTarget);
    handlers.resizeDish(dish, event.deltaY > 0 ? 0.94 : 1.06);
  }, { passive: false });

  dish.canvas.addEventListener('pointerdown', (event) => {
    handlers.selectDish(dish, dish.inspectedTarget);
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
    if (dish.dragStart?.pointerId !== event.pointerId) {
      return;
    }
    const dx = event.clientX - dish.dragStart.x;
    const dy = event.clientY - dish.dragStart.y;
    if (Math.hypot(dx, dy) > 4) {
      dish.dragMoved = true;
    }
    if (dish.dragStart.mode === 'pan') {
      dish.renderer.panFromView(dish.dragStart.view, dx, dy);
      handlers.updateHud();
      return;
    }
    dish.canvas.style.left = `${dish.dragStart.left + dx}px`;
    dish.canvas.style.top = `${dish.dragStart.top + dy}px`;
    handlers.updateDishLabel(dish);
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
      handlers.selectDish(dish, pick.target);
    }
  });

  dish.canvas.addEventListener('dblclick', (event) => {
    const target = dish.renderer.pickAtScreenPosition(event.clientX, event.clientY, dish.simulation.state);
    if (target.kind !== 'cell') {
      handlers.selectDish(dish, target);
      return;
    }
    const cell = dish.simulation.state.cells.find((item) => item.id === target.id);
    if (!cell) {
      return;
    }
    handlers.selectDish(dish, target);
    dish.renderer.centerOnCell(cell);
  });

  dish.canvas.addEventListener('pointermove', (event) => {
    if (dish.dragStart) {
      return;
    }
    const target = dish.renderer.pickAtScreenPosition(event.clientX, event.clientY, dish.simulation.state);
    if (!sameTarget(dish.hoveredTarget, target) || !handlers.isHoveredDish(dish)) {
      dish.hoveredTarget = target;
      handlers.setHoveredDishTarget(dish, target);
      handlers.updateHud();
    }
  });

  dish.canvas.addEventListener('pointerleave', () => {
    dish.hoveredTarget = null;
    if (handlers.isHoveredDish(dish)) {
      handlers.setHoveredDishTarget(null, null);
      handlers.updateHud();
    }
  });
}

function sameTarget(left: MapPick | null, right: MapPick | null): boolean {
  return left?.kind === right?.kind && left?.id === right?.id;
}
