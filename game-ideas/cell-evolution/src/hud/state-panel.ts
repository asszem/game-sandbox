import type { CellSimulation } from '../core/simulation';
import { MAX_BOARD_RADIUS, MIN_BOARD_RADIUS } from '../core/simulation';
import { MAX_DISH_SIZE } from '../app/dish-layout';

type DishPanelDish = {
  id: number;
  name: string;
  canvas: HTMLCanvasElement;
  simulation: CellSimulation;
};

export function formatDishState(dish: DishPanelDish | null): string {
  if (!dish) {
    return '<div class="dish-picker-empty">Select a dish from the Game window or click any petri dish to inspect it.</div>';
  }
  const state = dish.simulation.state;
  const resources = state.resources.reduce(
    (counts, resource) => {
      counts[resource.kind] += 1;
      counts.totalAmount += resource.amount;
      return counts;
    },
    { glucose: 0, 'amino-acid': 0, oxygen: 0, light: 0, totalAmount: 0 } as Record<'glucose' | 'amino-acid' | 'oxygen' | 'light', number> & { totalAmount: number },
  );
  const livingMass = state.cells.reduce((total, cell) => total + cell.mass, 0);
  const avgAtp = state.cells.length
    ? state.cells.reduce((total, cell) => total + cell.atp, 0) / state.cells.length
    : 0;
  const dishSize = Math.round(dish.canvas.getBoundingClientRect().width);
  const stats = [
    ['Biomass', livingMass.toFixed(1)],
    ['Avg ATP', avgAtp.toFixed(0)],
    ['Resources', state.resources.length.toString()],
    ['Glucose', resources.glucose.toString()],
    ['Amino Acids', resources['amino-acid'].toString()],
    ['Oxygen', resources.oxygen.toString()],
    ['Light', resources.light.toString()],
    ['Poison', state.hazards.length.toString()],
    ['Mineral Blocks', state.blocks.length.toString()],
    ['Size', `${dishSize}/${MAX_DISH_SIZE}px`],
  ];
  return `
    <span class="dish-stat-grid">${stats.map(([label, value]) => `<span class="dish-stat"><span>${label}</span><strong>${value}</strong></span>`).join('')}</span>
    <label class="dish-radius-control">
      <span>Radius <strong>${state.boardRadius.toFixed(1)}</strong></span>
      <input type="range" data-dish-radius min="${MIN_BOARD_RADIUS}" max="${MAX_BOARD_RADIUS}" step="1" value="${state.boardRadius.toFixed(0)}" />
    </label>
  `;
}

export function formatDishPickerList(dishes: DishPanelDish[], activeDish: DishPanelDish | null = null): string {
  if (dishes.length === 0) {
    return '<div class="dish-picker-empty">No dishes yet.</div>';
  }
  return dishes.map((dish) => `
    <div class="dish-picker-row${dish === activeDish ? ' is-selected' : ''}">
      <button type="button" class="dish-picker-icon" data-select-dish="${dish.id}" aria-label="Select #${dish.id} ${escapeHtml(dish.name)}">#${dish.id}</button>
      <input type="text" data-rename-dish="${dish.id}" value="${escapeHtml(dish.name)}" aria-label="Rename ${escapeHtml(dish.name)}" />
      <span>${dish.simulation.state.cells.length} cells</span>
      <span>${dish.simulation.state.running ? 'Running' : 'Paused'}</span>
    </div>
  `).join('');
}

export function currentDishPickerSignature(dishes: DishPanelDish[]): string {
  return dishes
    .map((dish) => `${dish.id}:${dish.name}:${dish.simulation.state.cells.length}:${dish.simulation.state.running ? 1 : 0}`)
    .join('|');
}

export function sanitizeDishName(value: string, id: number): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, 32) || `Dish ${id}`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
