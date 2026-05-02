import type { CellSimulation } from '../core/simulation';

type DishPanelDish = {
  id: number;
  name: string;
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
  const stats = [
    ['Biomass', livingMass.toFixed(1)],
    ['Avg ATP', avgAtp.toFixed(0)],
    ['Resources', state.resources.length.toString()],
    ['Glucose', resources.glucose.toString()],
    ['Amino', resources['amino-acid'].toString()],
    ['Oxygen', resources.oxygen.toString()],
    ['Light', resources.light.toString()],
    ['Poison', state.hazards.length.toString()],
    ['Blocks', state.blocks.length.toString()],
    ['Radius', state.boardRadius.toFixed(1)],
  ];
  return `<span class="dish-stat-grid">${stats.map(([label, value]) => `<span class="dish-stat"><span>${label}</span><strong>${value}</strong></span>`).join('')}</span>`;
}

export function formatDishPickerList(dishes: DishPanelDish[]): string {
  if (dishes.length === 0) {
    return '<div class="dish-picker-empty">No dishes yet.</div>';
  }
  return dishes.map((dish) => `
    <div class="dish-picker-row">
      <button type="button" class="dish-picker-icon" data-select-dish="${dish.id}" aria-label="Select ${escapeHtml(dish.name)}">◯</button>
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
