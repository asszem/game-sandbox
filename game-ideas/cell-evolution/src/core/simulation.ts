import { scanEnvironment } from './environment-scan';
import { RESOURCE_KINDS, createBlockEntity, createCellEntity, createResourceEntity, normalizeBlockEntity, normalizeCellEntity } from './entities';
import { constrainCellToDishAndBlocks, keepBlockInDish, keepCellInDish, resolveBlockCollisions } from './cell-constraints';
import { removeDeadCells } from './cell-death';
import { updateLightResources } from './light-cycle';
import { applyCellMetabolism, radiusForMass } from './metabolism';
import { Rng } from './rng';
import { transportResource } from './resource-transport';
import { awarenessRadius, sensingProfile, type SensingProfile } from './sensing';
import { cellCollisionRadius, clampPointToCellBounds, findCellSpawnPoint } from './spawn-placement';
import type { Block, Cell, CellGenome, DNAKey, Hazard, Resource, ResourceKind, SimulationEvent, SimulationState, Vec2 } from './types';
import { add, clamp, clampLength, distance, length, normalize, scale, sub, vec } from './vector';
import { findOpenPoint, scatterPoint } from './world-points';

const DNA_KEYS: DNAKey[] = ['motility', 'split', 'harvest', 'predator', 'caution'];
export const MIN_BOARD_RADIUS = 72;
export const MAX_BOARD_RADIUS = 128;

type WorldSeedOptions = {
  cellCount?: number;
  resourceCounts?: Partial<Record<ResourceKind, number>>;
  hazardCount?: number;
  blockCount?: number;
  boardRadius?: number;
};

export class CellSimulation {
  readonly state: SimulationState;
  private rng = new Rng(82421);
  private nextId = 1;
  private events: SimulationEvent[] = [];

  constructor() {
    this.state = {
      tick: 0,
      running: true,
      selectedCellId: null,
      boardRadius: 92,
      cells: [],
      resources: [],
      hazards: [],
      blocks: [],
    };

    this.seedWorld();
  }

  toggleRunning(): void {
    this.state.running = !this.state.running;
  }

  selectCell(id: number | null): void {
    this.state.selectedCellId = id;
  }

  get selectedCell(): Cell | null {
    return this.state.cells.find((cell) => cell.id === this.state.selectedCellId) ?? null;
  }

  infuseDNA(key: DNAKey): void {
    const cell = this.selectedCell;
    if (!cell) {
      return;
    }
    cell.genome[key] = clamp(cell.genome[key] + 0.18, 0, 1.6);
    cell.energy = Math.max(12, cell.energy - 7);
    cell.signalPhase += 0.35;
  }

  drainEvents(): SimulationEvent[] {
    const drained = this.events;
    this.events = [];
    return drained;
  }

  restart(): void {
    this.resetWorld(82421, false);
  }

  randomScenario(options: WorldSeedOptions = {}): void {
    this.resetWorld(Date.now() ^ Math.floor(Math.random() * 0xffffffff), true, options);
  }

  exportState(): SimulationState {
    return JSON.parse(JSON.stringify(this.state)) as SimulationState;
  }

  importState(state: SimulationState): void {
    this.state.tick = state.tick;
    this.state.running = state.running;
    this.state.selectedCellId = state.selectedCellId;
    this.state.boardRadius = state.boardRadius;
    this.state.cells = state.cells;
    this.state.resources = state.resources;
    this.state.hazards = state.hazards;
    this.state.blocks = state.blocks;
    this.events = [];
    for (const cell of this.state.cells) {
      normalizeCellEntity(cell);
    }
    for (const block of this.state.blocks) {
      normalizeBlockEntity(block, this.state.boardRadius);
    }
    for (const resource of this.state.resources) {
      if ((resource.kind as string) === 'food') {
        resource.kind = 'glucose';
      }
      if ((resource.kind as string) === 'water') {
        resource.kind = 'oxygen';
      }
    }
    this.nextId = this.findNextId();
  }

  dropCottonCandy(position: Vec2): void {
    for (let index = 0; index < 18; index += 1) {
      const point = scatterPoint(this.state, this.rng, position, 8.5);
      this.state.resources.push({
        id: this.nextId++,
        kind: 'glucose',
        position: point,
        amount: this.rng.range(0.52, 1),
        radius: this.rng.range(1.2, 3.4),
      });
    }
  }

  dropCatPawn(position: Vec2): void {
    for (let index = 0; index < 7; index += 1) {
      const point = scatterPoint(this.state, this.rng, position, 9.5);
      this.state.hazards.push({
        id: this.nextId++,
        kind: 'poison',
        position: point,
        radius: this.rng.range(2.4, 5.5),
        potency: this.rng.range(0.48, 0.95),
      });
    }
  }

  spawnResource(kind: ResourceKind, position: Vec2, amount = 0.9): Resource {
    const resource = this.createResource(kind);
    resource.position = { ...position };
    resource.origin = kind === 'light' ? { ...position } : undefined;
    resource.amount = clamp(amount, 0.05, 1);
    this.state.resources.push(resource);
    return resource;
  }

  spawnHazard(position: Vec2, potency = 0.7): Hazard {
    const hazard: Hazard = {
      id: this.nextId++,
      kind: 'poison',
      position: { ...position },
      radius: this.rng.range(3.2, 5.4),
      potency: clamp(potency, 0.1, 1),
    };
    this.state.hazards.push(hazard);
    return hazard;
  }

  spawnBlock(position: Vec2, width = 11, height = 8): Block {
    const block = this.createBlock({ ...position }, width, height);
    keepBlockInDish(block, this.state.boardRadius);
    this.state.blocks.push(block);
    return block;
  }

  spawnCell(position: Vec2, generation = 0): Cell {
    const cell = this.createCell({ ...position }, this.state.cells.length % 3, generation);
    cell.position = findCellSpawnPoint({
      state: this.state,
      rng: this.rng,
      cell,
      preferred: position,
      allowFallback: true,
    }) ?? clampPointToCellBounds(position, this.state.boardRadius, cellCollisionRadius(cell));
    this.state.cells.push(cell);
    this.resolveCellObstacles();
    return cell;
  }

  setBoardRadius(radius: number): void {
    this.state.boardRadius = clamp(radius, MIN_BOARD_RADIUS, MAX_BOARD_RADIUS);
    for (const block of this.state.blocks) {
      keepBlockInDish(block, this.state.boardRadius);
    }
    for (const cell of this.state.cells) {
      keepCellInDish(this.state, cell);
    }
    this.resolveCellObstacles();
  }

  awarenessRadius(cell: Cell): number {
    return awarenessRadius(cell);
  }

  sensingProfile(cell: Cell): SensingProfile {
    return sensingProfile(cell);
  }

  step(): void {
    this.state.tick += 1;
    this.updateLightCycle();
    this.spawnAmbientResources();

    for (const cell of this.state.cells) {
      this.updateCell(cell);
    }

    this.resolveCells();
    this.resolveCellObstacles();
    this.nextId = removeDeadCells({ state: this.state, events: this.events, rng: this.rng, nextId: this.nextId });
    if (this.state.selectedCellId && !this.state.cells.some((cell) => cell.id === this.state.selectedCellId)) {
      this.state.selectedCellId = null;
    }
  }

  private resetWorld(seed: number, randomized: boolean, options: WorldSeedOptions = {}): void {
    this.rng = new Rng(seed);
    this.nextId = 1;
    this.events = [];
    this.state.tick = 0;
    this.state.running = true;
    this.state.selectedCellId = null;
    this.state.boardRadius = options.boardRadius === undefined
      ? randomized ? this.rng.range(84, 104) : 92
      : clamp(options.boardRadius, MIN_BOARD_RADIUS, MAX_BOARD_RADIUS);
    this.state.cells = [];
    this.state.resources = [];
    this.state.hazards = [];
    this.state.blocks = [];
    this.seedWorld(randomized, options);
  }

  private seedWorld(randomized = false, options: WorldSeedOptions = {}): void {
    if (randomized || options.blockCount !== undefined) {
      const blockCount = options.blockCount === undefined
        ? 3 + Math.floor(this.rng.range(0, 4))
        : clamp(Math.round(options.blockCount), 0, 24);
      for (let index = 0; index < blockCount; index += 1) {
        this.state.blocks.push(this.createPlacedBlock(this.rng.range(7, 18), this.rng.range(5, 16)));
      }
    } else {
      this.state.blocks.push(
        this.createBlock(vec(-24, 25), 15, 7),
        this.createBlock(vec(29, -18), 8, 16),
        this.createBlock(vec(4, -42), 17, 6),
        this.createBlock(vec(42, 34), 10, 9),
      );
      for (const block of this.state.blocks) {
        keepBlockInDish(block, this.state.boardRadius);
      }
    }

    const defaultCellCount = randomized ? 9 + Math.floor(this.rng.range(0, 18)) : 16;
    const cellCount = options.cellCount === undefined
      ? defaultCellCount
      : clamp(Math.round(options.cellCount), 1, 80);
    for (let index = 0; index < cellCount; index += 1) {
      const cell = this.createCell(vec(), index % 3);
      const spawnPoint = findCellSpawnPoint({ state: this.state, rng: this.rng, cell });
      if (!spawnPoint) {
        break;
      }
      cell.position = spawnPoint;
      this.state.cells.push(cell);
    }
    this.resolveCellObstacles();

    if (options.resourceCounts) {
      for (const kind of RESOURCE_KINDS) {
        const count = clamp(Math.round(options.resourceCounts[kind] ?? 0), 0, 100);
        for (let index = 0; index < count; index += 1) {
          this.state.resources.push(this.createResource(kind));
        }
      }
    } else {
      const resourceCount = randomized ? 45 + Math.floor(this.rng.range(0, 70)) : 70;
      for (let index = 0; index < resourceCount; index += 1) {
        this.state.resources.push(this.createResource());
      }
    }

    const defaultHazardCount = randomized ? 5 + Math.floor(this.rng.range(0, 22)) : 14;
    const hazardCount = options.hazardCount === undefined
      ? defaultHazardCount
      : clamp(Math.round(options.hazardCount), 0, 80);
    for (let index = 0; index < hazardCount; index += 1) {
      this.state.hazards.push({
        id: this.nextId++,
        kind: 'poison',
        position: findOpenPoint(this.state, this.rng, this.state.boardRadius - 14, 6),
        radius: this.rng.range(2.3, 5.8),
        potency: this.rng.range(0.45, 1),
      });
    }
  }

  private createBlock(position: Vec2, width: number, height: number): Block {
    return createBlockEntity(this.nextId++, this.rng, position, width, height);
  }

  private createPlacedBlock(width: number, height: number): Block {
    const block = this.createBlock(vec(), width, height);
    const maxCenterDistance = Math.max(0, this.state.boardRadius - block.radius - 2);
    block.position = findOpenPoint(this.state, this.rng, maxCenterDistance, block.radius + 2);
    keepBlockInDish(block, this.state.boardRadius);
    return block;
  }

  private createCell(position: Vec2, family = 0, generation = 1): Cell {
    return createCellEntity(this.nextId++, this.rng, position, family, generation);
  }

  private createResource(resourceKind?: ResourceKind): Resource {
    const kind = resourceKind ?? this.rng.pick(RESOURCE_KINDS);
    const position = findOpenPoint(this.state, this.rng, 84, kind === 'light' ? 8 : 4);
    return createResourceEntity(this.nextId++, this.rng, kind, position);
  }

  private updateCell(cell: Cell): void {
    const baseline = {
      atp: cell.atp,
      glucose: cell.glucose,
      amino: cell.aminoAcids,
      oxygen: cell.oxygen,
      ros: cell.ros,
      glycogen: cell.glycogen,
    };
    cell.glucoseRate = 0;
    cell.glycogenRate = 0;
    cell.autophagyRate = 0;
    cell.age += 1;
    cell.signalPhase += 0.12 + cell.genome.motility * 0.04;

    const awareness = this.awarenessRadius(cell);
    const pull = scanEnvironment(this.state, cell, awareness);
    const jitter = vec(this.rng.signed(0.15), this.rng.signed(0.15));
    const desired = add(scale(normalize(pull), 0.08 + cell.genome.motility * 0.16), jitter);
    const metabolicBoost = 0.75 + cell.oxygenMetabolism * 0.55;
    const sizeDrag = 1 + Math.max(0, cell.radius - 3) * 0.16;
    cell.velocity = clampLength(add(scale(cell.velocity, 0.82), desired), ((0.38 + cell.genome.motility * 0.42) * metabolicBoost) / sizeDrag);
    cell.position = add(cell.position, cell.velocity);
    cell.lastSignal = pull;

    keepCellInDish(this.state, cell);
    resolveBlockCollisions(this.state, cell);
    this.consumeResources(cell);
    this.applyHazards(cell);

    applyCellMetabolism(cell, this.localLight(cell.position), baseline);
    constrainCellToDishAndBlocks(this.state, cell);

    if (cell.atp > 92 && cell.aminoAcids > 55 && cell.mass > 1.12 && cell.genome.split > 0.4 && this.state.cells.length < 55) {
      this.splitCell(cell);
    }
  }

  private consumeResources(cell: Cell): void {
    this.state.resources = this.state.resources.filter((resource) => {
      const overlap = distance(cell.position, resource.position) < cell.radius + resource.radius;
      if (!overlap || resource.kind === 'light') {
        return true;
      }
      const canIngest = cell.radius * (1.22 + cell.genome.harvest * 0.45) >= resource.radius;
      if (!canIngest) {
        cell.energy -= 0.08;
        return true;
      }
      const consumedAmount = transportResource(cell, resource);
      this.events.push({
        kind: 'resource-consumed',
        position: { ...resource.position },
        resourceKind: resource.kind,
        amount: consumedAmount,
        radius: resource.radius,
      });
      return resource.amount > 0.06;
    });
  }

  private applyHazards(cell: Cell): void {
    for (const hazard of this.state.hazards) {
      const d = distance(cell.position, hazard.position);
      if (d < cell.radius + hazard.radius) {
        cell.health -= 0.018 * hazard.potency * (1.4 - cell.genome.caution * 0.35);
        cell.atp -= 0.45 * hazard.potency;
        cell.ros += 0.6 * hazard.potency;
        cell.energy = cell.atp;
      }
    }
  }

  private resolveCells(): void {
    for (let a = 0; a < this.state.cells.length; a += 1) {
      for (let b = a + 1; b < this.state.cells.length; b += 1) {
        const left = this.state.cells[a];
        const right = this.state.cells[b];
        const d = distance(left.position, right.position);
        const minDistance = cellCollisionRadius(left) + cellCollisionRadius(right);
        if (d >= minDistance) {
          continue;
        }

        const direction = d > 0.01
          ? normalize(sub(right.position, left.position))
          : normalize(vec(this.rng.signed(1) || 1, this.rng.signed(1)));
        const overlap = minDistance - d;
        left.position = add(left.position, scale(direction, -overlap * 0.5));
        right.position = add(right.position, scale(direction, overlap * 0.5));

        const hunter = left.radius > right.radius * 1.12 ? left : right.radius > left.radius * 1.12 ? right : null;
        const prey = hunter === left ? right : hunter === right ? left : null;
        if (hunter && prey && hunter.genome.predator > 0.55 && hunter.atp > 18) {
          const sizeAdvantage = clamp((hunter.radius - prey.radius) / 3, 0.2, 1.5);
          prey.health -= 0.08 * hunter.genome.predator * sizeAdvantage;
          hunter.atp += 1.4 * sizeAdvantage;
          if (prey.health <= 0.08) {
            hunter.atp += prey.atp * 0.38;
            hunter.aminoAcids += prey.aminoAcids * 0.28;
            hunter.mass += prey.mass * 0.22;
            hunter.energy = hunter.atp;
            this.events.push({
              kind: 'cell-devoured',
              position: { ...prey.position },
              hunterId: hunter.id,
              preyId: prey.id,
              mass: prey.mass,
              radius: prey.radius,
            });
          }
        }
      }
    }
  }

  private splitCell(cell: Cell): void {
    const angle = this.rng.range(0, Math.PI * 2);
    const offsetDistance = cellCollisionRadius(cell) * 1.15;
    const offset = vec(Math.cos(angle) * offsetDistance, Math.sin(angle) * offsetDistance);
    const child = this.createCell(add(cell.position, offset), 0, cell.generation + 1);
    child.genome = this.mutateGenome(cell.genome);
    child.atp = cell.atp * 0.42;
    child.energy = child.atp;
    child.glucose = cell.glucose * 0.42;
    child.aminoAcids = cell.aminoAcids * 0.42;
    child.oxygen = cell.oxygen * 0.5;
    child.ros = cell.ros * 0.35;
    child.glycogen = cell.glycogen * 0.42;
    child.mass = cell.mass * 0.48;
    child.bodyLength = clamp(cell.bodyLength + this.rng.signed(0.16), 1.35, 2.55);
    child.radius = radiusForMass(child);
    cell.atp *= 0.48;
    cell.energy = cell.atp;
    cell.glucose *= 0.52;
    cell.aminoAcids *= 0.52;
    cell.oxygen *= 0.55;
    cell.ros *= 0.65;
    cell.glycogen *= 0.52;
    cell.mass *= 0.58;
    cell.radius = radiusForMass(cell);
    this.state.cells.push(child);
    this.resolveCellObstacles();
  }

  private mutateGenome(genome: CellGenome): CellGenome {
    const next = { ...genome };
    for (const key of DNA_KEYS) {
      next[key] = clamp(next[key] + this.rng.signed(0.07), 0.02, 1.5);
    }
    return next;
  }

  private localLight(position: Vec2): number {
    return this.state.resources.reduce((total, resource) => {
      if (resource.kind !== 'light') {
        return total;
      }
      const d = distance(position, resource.position);
      return total + Math.max(0, 1 - d / (resource.radius * 3.2)) * resource.amount;
    }, -0.12);
  }

  private resolveCellObstacles(): void {
    for (let pass = 0; pass < 8; pass += 1) {
      this.resolveCells();
      for (const cell of this.state.cells) {
        constrainCellToDishAndBlocks(this.state, cell);
      }
    }
  }

  private spawnAmbientResources(): void {
    if (this.state.resources.length < 95 && this.rng.next() < 0.3) {
      this.state.resources.push(this.createResource());
    }
  }

  private updateLightCycle(): void {
    updateLightResources(this.state.resources, this.state.tick, this.state.boardRadius);
  }

  private findNextId(): number {
    const ids = [
      ...this.state.cells.map((cell) => cell.id),
      ...this.state.resources.map((resource) => resource.id),
      ...this.state.hazards.map((hazard) => hazard.id),
      ...this.state.blocks.map((block) => block.id),
    ];
    return Math.max(0, ...ids) + 1;
  }
}
