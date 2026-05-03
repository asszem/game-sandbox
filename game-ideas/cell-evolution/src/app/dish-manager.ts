import { CellSimulation } from '../core/simulation';
import { PetriDishRenderer } from '../render/PetriDishRenderer';
import type { MapPick } from '../render/types';
import { bindDishCanvasEvents } from './dish-events';
import { defaultDishPlacements, defaultDishSize, resizeDishCanvas, updateFloatingDishLabel } from './dish-layout';
import type { CreateDishOptions, DishInstance } from './dish-types';

export const MAX_DISH_COUNT = 9;

type DishManagerHandlers = {
  selectDish: (dish: DishInstance, target: MapPick) => void;
  updateHud: () => void;
  isHoveredDish: (dish: DishInstance) => boolean;
  setHoveredDishTarget: (dish: DishInstance | null, target: MapPick | null) => void;
};

export class DishManager {
  readonly dishes: DishInstance[] = [];
  private nextDishZ = 1;

  constructor(
    private readonly dishLayer: HTMLElement,
    private readonly handlers: DishManagerHandlers,
  ) {}

  createDefaultDishes(): void {
    const size = defaultDishSize(window.innerWidth);
    const positions = defaultDishPlacements(size, window.innerWidth, window.innerHeight);
    positions.forEach((position) => this.createDish({ ...position, size, select: false }));
  }

  createDish(options: CreateDishOptions = {}): DishInstance {
    if (this.dishes.length >= MAX_DISH_COUNT) {
      throw new Error(`Cannot create more than ${MAX_DISH_COUNT} dishes`);
    }
    const id = options.id ?? this.nextAvailableDishId();
    const canvas = document.createElement('canvas');
    canvas.className = 'dish-canvas';
    canvas.dataset.dishId = String(id);
    const label = document.createElement('button');
    label.className = 'dish-label';
    label.type = 'button';
    label.dataset.dishId = String(id);
    const size = options.size ?? defaultDishSize(window.innerWidth);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    canvas.style.left = `${options.left ?? window.innerWidth - size - 48}px`;
    canvas.style.top = `${options.top ?? window.innerHeight - size - 32}px`;
    this.dishLayer.appendChild(canvas);
    this.dishLayer.appendChild(label);

    const simulation = new CellSimulation();
    if (options.state) {
      simulation.importState(options.state);
    } else {
      simulation.randomScenario(options.setup);
    }
    const renderer = new PetriDishRenderer(canvas, {
      renderBackground: false,
      cameraControls: false,
      defaultCameraX: 0,
      defaultCameraY: 0,
    });
    renderer.applyView(options.view);

    const dish: DishInstance = {
      id,
      name: options.name ?? defaultDishName(id),
      canvas,
      label,
      simulation,
      renderer,
      inspectedTarget: options.inspectedTarget ?? { kind: 'dish', id: null },
      hoveredTarget: { kind: 'dish', id: null },
      accumulator: 0,
      worldTime: 0,
      zIndex: options.zIndex ?? this.nextDishZ,
      dragStart: null,
      dragMoved: false,
    };

    this.nextDishZ = Math.max(this.nextDishZ, dish.zIndex + 1);
    canvas.style.zIndex = String(dish.zIndex);
    this.updateDishLabel(dish);
    this.bindDishEvents(dish);
    this.dishes.push(dish);
    renderer.applyView(options.view);
    if (options.select) {
      this.handlers.selectDish(dish, dish.inspectedTarget);
    }
    return dish;
  }

  resetIds(): void {
    this.nextDishZ = 1;
  }

  bringToFront(dish: DishInstance): void {
    dish.zIndex = this.nextDishZ;
    dish.canvas.style.zIndex = String(this.nextDishZ);
    this.updateDishLabel(dish);
    this.nextDishZ += 1;
  }

  resizeDish(dish: DishInstance, factor: number): void {
    if (!resizeDishCanvas(dish.canvas, factor)) {
      return;
    }
    this.updateDishLabel(dish);
    dish.renderer.applyView(dish.renderer.exportView());
    this.handlers.updateHud();
  }

  updateDishLabel(dish: DishInstance): void {
    updateFloatingDishLabel(dish.label, dish.canvas, dish.name, dish.zIndex, dish.id);
  }

  deleteDish(dish: DishInstance): void {
    dish.renderer.dispose();
    dish.canvas.remove();
    dish.label.remove();
    const index = this.dishes.indexOf(dish);
    if (index >= 0) {
      this.dishes.splice(index, 1);
    }
  }

  clearDishes(): void {
    for (const dish of this.dishes) {
      dish.renderer.dispose();
      dish.canvas.remove();
      dish.label.remove();
    }
    this.dishes.splice(0, this.dishes.length);
    this.resetIds();
  }

  syncSelectionClasses(activeDish: DishInstance | null): void {
    for (const dish of this.dishes) {
      dish.canvas.classList.toggle('is-selected', dish === activeDish);
      dish.label.classList.toggle('is-selected', dish === activeDish);
    }
  }

  private bindDishEvents(dish: DishInstance): void {
    bindDishCanvasEvents(dish, {
      selectDish: this.handlers.selectDish,
      resizeDish: (item, factor) => this.resizeDish(item, factor),
      updateDishLabel: (item) => this.updateDishLabel(item),
      updateHud: this.handlers.updateHud,
      isHoveredDish: this.handlers.isHoveredDish,
      setHoveredDishTarget: this.handlers.setHoveredDishTarget,
    });
  }

  private nextAvailableDishId(): number {
    for (let id = 1; id <= MAX_DISH_COUNT; id += 1) {
      if (!this.dishes.some((dish) => dish.id === id)) {
        return id;
      }
    }
    return MAX_DISH_COUNT;
  }
}

export function defaultDishName(id: number): string {
  const letterCode = 'A'.charCodeAt(0) + Math.max(0, id - 1);
  return `Dish ${String.fromCharCode(letterCode)}`;
}
