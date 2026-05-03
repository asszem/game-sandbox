import type { Cell, SimulationState } from '../core/types';
import { distance } from '../core/vector';
import { escapeHtml } from './state-panel';

export type DetectionSummary = {
  resources: number;
  hazards: number;
  prey: number;
  rivals: number;
  nearestResource: number;
  nearestHazard: number;
};

type CellStatState = 'danger' | 'warning' | 'stable';
type CellStat = [label: string, value: string, tooltip: string, state?: CellStatState];

export function formatCellState(cell: Cell): string {
  const healthPercent = Math.round(cell.health * 100);
  const healthState = cell.health <= 0.25 || cell.atp <= 5 || cell.mass <= 0.28
    ? 'danger'
    : cell.health <= 0.45 || cell.atp <= 15 || cell.ros >= 45
      ? 'warning'
      : 'stable';
  const repairReady = cell.atp > 15 && cell.aminoAcids > 12 && cell.ros < 35;
  const pressure = [
    { label: `ATP ${Math.round(cell.atp)}`, state: cell.atp > 15 ? 'good' : 'bad' },
    { label: `Amino Acids ${Math.round(cell.aminoAcids)}`, state: cell.aminoAcids > 12 ? 'good' : 'bad' },
    { label: `ROS ${Math.round(cell.ros)}`, state: cell.ros < 35 ? 'good' : cell.ros > 45 ? 'bad' : 'warn' },
    { label: cell.autophagyRate > 0 ? `Autophagy -${cell.autophagyRate.toFixed(1)}` : 'Autophagy 0', state: cell.autophagyRate > 0 ? 'bad' : 'good' },
    { label: repairReady ? 'Repair active' : 'Repair limited', state: repairReady ? 'good' : 'warn' },
  ];
  return `
    <div class="health-status health-status-${healthState}" data-tooltip="${escapeHtml('Health is normalized from 0% to 100%. Health improves when ATP and amino acids can maintain repair while ROS is low. It drops from poison, high ROS, low ATP, amino-acid shortage, autophagy, and very low mass.')}">
      <div class="health-status-head"><span>Health</span><strong>${healthPercent}%</strong></div>
      <div class="health-track" role="meter" aria-label="Cell health" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${healthPercent}" style="--health-value: ${healthPercent / 100}"><span></span></div>
      <div class="health-impact-list">${pressure.map(({ label, state }) => `<span data-impact="${state}">${escapeHtml(label)}</span>`).join('')}</div>
    </div>
  `;
}

export function formatNavigationState(cell: Cell, detections: DetectionSummary, awareness: number, sensingClarity: number): string {
  const strongest = Object.entries(cell.genome).sort((a, b) => b[1] - a[1])[0];
  const stats: CellStat[] = [
    [
      'Sensing',
      `${awareness.toFixed(1)} · ${Math.round(sensingClarity * 100)}%`,
      'Sensing depends on signal transduction. ATP powers receptor resolution, amino acids maintain receptor proteins, oxygen supports processing speed, and ROS or damage reduce clarity.',
    ],
    ['DNA', `${strongest[0]} ${strongest[1].toFixed(2)}`, 'Dominant DNA is the strongest current trait shaping behavior, metabolism, sensing, and division priorities.'],
    ['Nearby', `${detections.resources} molecules · ${detections.hazards} poison · ${detections.prey} prey · ${detections.rivals} rivals`, 'Nearby signals are what the cell can currently sense and use for movement, feeding, avoidance, or hunting decisions.'],
    ['Search', searchPreferenceLabel(cell.searchPreference), 'Search preference biases movement toward one ingredient. Balanced mode still weighs the most depleted internal reserves.'],
  ];
  return `
    <p class="directive-summary">Current directive is inferred from ATP, amino acids, oxygen, ROS, nearby echoes, and DNA traits.</p>
    <span class="cell-stat-grid">${stats.map(([label, value, tooltip, state]) => `<span class="cell-stat${state ? ` cell-stat-${state}` : ''}" data-tooltip="${escapeHtml(tooltip)}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></span>`).join('')}</span>
  `;
}

export function currentDirective(cell: Cell, detections: DetectionSummary, awareness: number): string {
  if (cell.ros > 55) {
    return 'Neutralize oxidative stress';
  }
  if (cell.aminoAcids < 12) {
    return detections.resources > 0 ? 'Seek amino acids for repair' : 'Preserve membrane proteins';
  }
  if (cell.health < 0.35 || cell.atp < 14) {
    return detections.resources > 0 ? 'Transport glucose for emergency ATP' : 'Starve slowly and consume internal structure';
  }
  if (detections.hazards > 0 && detections.nearestHazard < awareness * 0.55) {
    return 'Evade poison echo';
  }
  if (cell.atp > 92 && cell.aminoAcids > 55 && cell.mass > 1.12 && cell.genome.split > 0.4) {
    return 'Prepare mitosis';
  }
  if (detections.prey > 0 && cell.genome.predator > 0.55) {
    return 'Hunt smaller cells';
  }
  if (detections.resources > 0 && cell.genome.harvest >= cell.genome.predator) {
    return 'Seek strongest molecule signal';
  }
  if (detections.rivals > 0 && cell.genome.caution > 0.7) {
    return 'Keep distance from rival cells';
  }
  return 'Explore and map surroundings';
}

function searchPreferenceLabel(value: Cell['searchPreference']): string {
  if (value === 'amino-acid') {
    return 'Amino acids';
  }
  return value[0].toUpperCase() + value.slice(1);
}

export function scanDetections(cell: Cell, awareness: number, state: SimulationState): DetectionSummary {
  let resources = 0;
  let hazards = 0;
  let prey = 0;
  let rivals = 0;
  let nearestResource = Infinity;
  let nearestHazard = Infinity;

  for (const resource of state.resources) {
    const d = distance(cell.position, resource.position);
    if (d <= awareness) {
      resources += 1;
      nearestResource = Math.min(nearestResource, d);
    }
  }
  for (const hazard of state.hazards) {
    const d = distance(cell.position, hazard.position);
    if (d <= awareness + hazard.radius) {
      hazards += 1;
      nearestHazard = Math.min(nearestHazard, d);
    }
  }
  for (const other of state.cells) {
    if (other.id === cell.id) {
      continue;
    }
    const d = distance(cell.position, other.position);
    if (d <= awareness) {
      if (cell.radius > other.radius * 1.08) {
        prey += 1;
      } else {
        rivals += 1;
      }
    }
  }

  return { resources, hazards, prey, rivals, nearestResource, nearestHazard };
}
