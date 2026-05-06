import { clamp } from '../core/vector';
import { MAX_BOARD_RADIUS, MIN_BOARD_RADIUS } from '../core/simulation';

const NEW_DISH_DEFAULT_BOARD_RADIUS = 92;
const NEW_DISH_DEFAULT_CELL_COUNT = 10;
const NEW_DISH_MIN_CELL_COUNT = 1;
const NEW_DISH_MAX_CELL_COUNT = 40;
const NEW_DISH_DEFAULT_COMPLEXITY = 1;

type NewDishResourceKey = 'glucose' | 'amino-acid' | 'oxygen' | 'light';

export type NewDishSetup = {
  boardRadius?: number;
  cellCount?: number;
  cellComplexity?: number;
  resourceCounts?: Partial<Record<NewDishResourceKey, number>>;
  hazardCount?: number;
  blockCount?: number;
};

export function defaultNewDishSetup(): NewDishSetup {
  return {
    boardRadius: NEW_DISH_DEFAULT_BOARD_RADIUS,
    cellCount: NEW_DISH_DEFAULT_CELL_COUNT,
    cellComplexity: NEW_DISH_DEFAULT_COMPLEXITY,
    resourceCounts: {
      glucose: 20,
      'amino-acid': 0,
      oxygen: 0,
      light: 0,
    },
    hazardCount: 0,
    blockCount: 0,
  };
}

export function setNewDishBoardRadius(range: HTMLInputElement | null, value: number): number {
  const next = clamp(Math.round(Number.isFinite(value) ? value : NEW_DISH_DEFAULT_BOARD_RADIUS), MIN_BOARD_RADIUS, MAX_BOARD_RADIUS);
  if (range) {
    range.value = String(next);
    syncRangeOutput(range);
  }
  return next;
}

export function setNewDishCellCount(range: HTMLInputElement | null, input: HTMLInputElement | null, value: number): number {
  const next = clamp(Math.round(Number.isFinite(value) ? value : NEW_DISH_DEFAULT_CELL_COUNT), NEW_DISH_MIN_CELL_COUNT, NEW_DISH_MAX_CELL_COUNT);
  if (range) {
    range.value = String(next);
  }
  if (input) {
    input.value = String(next);
  }
  return next;
}

export function readNewDishSetup(
  radiusRange: HTMLInputElement | null,
  range: HTMLInputElement | null,
  input: HTMLInputElement | null,
  complexitySelect: HTMLSelectElement | null,
  resourceSliders: NodeListOf<HTMLInputElement>,
  environmentSliders: NodeListOf<HTMLInputElement>,
): NewDishSetup {
  const setup = defaultNewDishSetup();
  setup.boardRadius = setNewDishBoardRadius(radiusRange, Number(radiusRange?.value ?? NEW_DISH_DEFAULT_BOARD_RADIUS));
  const source = input?.value || range?.value || String(NEW_DISH_DEFAULT_CELL_COUNT);
  setup.cellCount = setNewDishCellCount(range, input, Number(source));
  setup.cellComplexity = clamp(Math.round(Number(complexitySelect?.value ?? NEW_DISH_DEFAULT_COMPLEXITY)), 1, 4);
  setup.resourceCounts = {};
  resourceSliders.forEach((slider) => {
    const key = slider.dataset.newDishResource as NewDishResourceKey | undefined;
    if (key) {
      setup.resourceCounts![key] = clamp(Math.round(Number(slider.value)), Number(slider.min || 0), Number(slider.max || 100));
    }
  });
  environmentSliders.forEach((slider) => {
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

export function resetNewDishRangeControls(resourceSliders: NodeListOf<HTMLInputElement>, environmentSliders: NodeListOf<HTMLInputElement>): void {
  resourceSliders.forEach((slider) => {
    slider.value = slider.dataset.newDishResource === 'glucose' ? '20' : '0';
    syncRangeOutput(slider);
  });
  environmentSliders.forEach((slider) => {
    slider.value = '0';
    syncRangeOutput(slider);
  });
}

export function syncRangeOutput(slider: HTMLInputElement): void {
  const output = slider.closest('label')?.querySelector('output');
  if (output) {
    output.textContent = slider.value;
  }
}

export function defaultNewDishCellCount(): number {
  return NEW_DISH_DEFAULT_CELL_COUNT;
}

export function defaultNewDishBoardRadius(): number {
  return NEW_DISH_DEFAULT_BOARD_RADIUS;
}

export function defaultNewDishComplexity(): number {
  return NEW_DISH_DEFAULT_COMPLEXITY;
}
