import type { CellSimulation } from '../core/simulation';
import type { ResourceKind, SimulationState, Vec2 } from '../core/types';
import type { MapPick } from '../render/PetriDishRenderer';
import { currentDirective, scanDetections } from './entity-panel';
import { escapeHtml } from './state-panel';

type HoverDish = {
  name: string;
  simulation: CellSimulation;
};

export function formatHoverTarget(target: MapPick, dish: HoverDish): string {
  const sourceSimulation = dish.simulation;
  const state = sourceSimulation.state;
  if (target.kind === 'cell') {
    const cell = state.cells.find((item) => item.id === target.id);
    if (!cell) return hoverFacts([['Status', 'Signal lost', 'The hovered cell no longer exists in this dish.']]);
    const awareness = sourceSimulation.awarenessRadius(cell);
    const detections = scanDetections(cell, awareness, state);
    return hoverFacts([
      ['Directive', currentDirective(cell, detections, awareness), 'What this cell is currently trying to do based on internal state, DNA, and nearby signals.'],
      ['ATP', Math.round(cell.atp).toString(), 'Immediate energy used for movement, transport, repair, growth, and division.'],
      ['Health', `${Math.round(cell.health * 100)}%`, 'Cell survival condition. Poison, starvation, ROS, and low materials lower it.'],
      ['Sensing', awareness.toFixed(1), 'How far this cell can detect resources, poison, prey, and rivals.'],
    ]);
  }
  if (target.kind === 'resource') {
    const resource = state.resources.find((item) => item.id === target.id);
    if (!resource) return hoverFacts([['Status', 'Consumed', 'This resource was consumed or moved out of range.']]);
    return hoverFacts([
      ['Kind', resourceLabel(resource.kind), 'The resource type determines which internal store it can refill.'],
      ['Amount', resource.amount.toFixed(2), 'Remaining usable material in this marker.'],
      ['Use', resourceUse(resource.kind), 'How cells benefit from this resource.'],
      ['Size', resource.radius.toFixed(1), 'Larger markers are easier to see but may require enough cell size to ingest.'],
    ]);
  }
  if (target.kind === 'hazard') {
    const hazard = state.hazards.find((item) => item.id === target.id);
    if (!hazard) return hoverFacts([['Status', 'Faded', 'This poison cloud is no longer present.']]);
    return hoverFacts([
      ['Kind', 'Poison cloud', 'Hazards damage cells that overlap them.'],
      ['Potency', hazard.potency.toFixed(2), 'Higher potency drains more ATP, adds more ROS, and hurts health faster.'],
      ['Radius', hazard.radius.toFixed(1), 'Cells are affected when their membrane overlaps this radius.'],
      ['Counter', 'Caution DNA', 'Caution improves avoidance behavior around poison.'],
    ]);
  }
  if (target.kind === 'block') {
    const block = state.blocks.find((item) => item.id === target.id);
    if (!block) return hoverFacts([['Status', 'Gone', 'This mineral block is no longer present.']]);
    return hoverFacts([
      ['Kind', 'Mineral block', 'A solid obstacle. Cells cannot overlap or harvest it.'],
      ['Body', `${Math.round(block.size.x)} x ${Math.round(block.size.y)}`, 'Approximate obstacle width and height.'],
      ['Radius', block.radius.toFixed(1), 'Collision radius used for keeping cells outside the rock.'],
      ['Counter', 'Motility DNA', 'Motility helps cells steer around obstacles.'],
    ]);
  }
  return hoverFacts([
    ['Medium', dish.name, 'Open agar medium inside this petri dish.'],
    ['Cells', state.cells.length.toString(), 'Living cells currently in this dish.'],
    ['Resources', state.resources.length.toString(), 'Glucose, amino acid, oxygen, and light markers in this dish.'],
    ['Poison', state.hazards.length.toString(), 'Hazard clouds currently in this dish.'],
  ]);
}

export function describeHoverTarget(target: MapPick, dish: HoverDish | null): string {
  if (!dish) {
    return 'No dish under pointer.';
  }
  const sourceSimulation = dish.simulation;
  const state = sourceSimulation.state;
  if (target.kind === 'cell') {
    const cell = state.cells.find((item) => item.id === target.id);
    if (!cell) return 'Cell signal disappeared from the medium.';
    const awareness = sourceSimulation.awarenessRadius(cell);
    const detections = scanDetections(cell, awareness, state);
    return `${currentDirective(cell, detections, awareness)} · ATP ${Math.round(cell.atp)} · amino acids ${Math.round(cell.aminoAcids)} · oxygen ${Math.round(cell.oxygen)} · ROS ${Math.round(cell.ros)} · health ${Math.round(cell.health * 100)}% · size ${cell.radius.toFixed(1)} · sensor ${awareness.toFixed(1)}.`;
  }
  if (target.kind === 'resource') {
    const resource = state.resources.find((item) => item.id === target.id);
    if (!resource) return 'Resource was consumed or moved out of range.';
    return `${describeResource(resource.kind, resource.amount)} Size ${resource.radius.toFixed(1)} · position ${formatPosition(resource.position)}.`;
  }
  if (target.kind === 'hazard') {
    const hazard = state.hazards.find((item) => item.id === target.id);
    if (!hazard) return 'Poison signal faded.';
    return `Poison cloud · potency ${hazard.potency.toFixed(2)} · radius ${hazard.radius.toFixed(1)} · damages membrane integrity and raises avoidance pressure. Position ${formatPosition(hazard.position)}.`;
  }
  if (target.kind === 'block') {
    const block = state.blocks.find((item) => item.id === target.id);
    if (!block) return 'Mineral block is no longer present.';
    return `Mineral block · non-living obstacle · approximate body ${Math.round(block.size.x)} x ${Math.round(block.size.y)} · cells route around it. Position ${formatPosition(block.position)}.`;
  }
  return `Open agar medium · ${state.cells.length} cells, ${state.resources.length} resources, ${state.hazards.length} poison clouds · tick ${state.tick}.`;
}

export function targetLabel(target: MapPick, state: SimulationState): string {
  if (target.kind === 'cell') {
    const cell = state.cells.find((item) => item.id === target.id);
    return cell ? `Cell ${cell.id}` : 'Cell';
  }
  if (target.kind === 'resource') {
    const resource = state.resources.find((item) => item.id === target.id);
    return resource ? resourceLabel(resource.kind) : 'Resource';
  }
  if (target.kind === 'hazard') return 'Poison';
  if (target.kind === 'block') return 'Mineral Block';
  return 'Petri dish';
}

export function describeResource(kind: string, amount: number): string {
  if (kind === 'glucose') return `Glucose molecule · amount ${amount.toFixed(2)} · transported into the cell and converted into ATP. Oxygen multiplies its yield.`;
  if (kind === 'amino-acid') return `Amino acid packet · amount ${amount.toFixed(2)} · repairs proteins, builds receptor hardware, and supports growth or division.`;
  if (kind === 'oxygen') return `Oxygen bubble · amount ${amount.toFixed(2)} · boosts ATP yield when mitochondria are active, but high oxygen metabolism raises ROS.`;
  if (kind === 'light') return `Light patch · intensity ${amount.toFixed(2)} · increases light intake factor for cells inside its glow.`;
  return `${kind} · amount ${amount.toFixed(2)}.`;
}

function hoverFacts(facts: Array<[string, string, string]>): string {
  return `<div class="hover-fact-grid">${facts.map(([label, value, tooltip]) => `<span class="hover-fact" data-tooltip="${escapeHtml(tooltip)}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></span>`).join('')}</div>`;
}

function resourceLabel(kind: ResourceKind): string {
  if (kind === 'amino-acid') return 'Amino acids';
  return kind[0].toUpperCase() + kind.slice(1);
}

function resourceUse(kind: ResourceKind): string {
  if (kind === 'glucose') return 'Refills fuel';
  if (kind === 'amino-acid') return 'Repair and growth';
  if (kind === 'oxygen') return 'ATP production';
  return 'Light intake';
}

function formatPosition(position: Vec2): string {
  return `${position.x.toFixed(1)}, ${position.y.toFixed(1)}`;
}
