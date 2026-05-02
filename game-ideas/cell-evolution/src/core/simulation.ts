import { Rng } from './rng';
import type { Block, Cell, CellGenome, DNAKey, Hazard, Resource, ResourceKind, SimulationEvent, SimulationState, Vec2 } from './types';
import { add, clamp, clampLength, distance, length, normalize, scale, sub, vec } from './vector';

const DNA_KEYS: DNAKey[] = ['motility', 'split', 'harvest', 'predator', 'caution'];
const RESOURCE_KINDS: ResourceKind[] = ['glucose', 'amino-acid', 'oxygen', 'light'];

type WorldSeedOptions = {
  cellCount?: number;
  resourceCounts?: Partial<Record<ResourceKind, number>>;
  hazardCount?: number;
  blockCount?: number;
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
      this.normalizeCell(cell);
    }
    for (const block of this.state.blocks) {
      this.normalizeBlock(block);
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
      const point = this.scatterPoint(position, 8.5);
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
      const point = this.scatterPoint(position, 9.5);
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
    this.keepBlockInDish(block);
    this.state.blocks.push(block);
    return block;
  }

  spawnCell(position: Vec2, generation = 0): Cell {
    const cell = this.createCell({ ...position }, this.state.cells.length % 3, generation);
    cell.position = this.findCellSpawnPoint(cell, position, true) ?? this.clampPointToCellBounds(position, this.cellCollisionRadius(cell));
    this.state.cells.push(cell);
    this.resolveCellObstacles();
    return cell;
  }

  awarenessRadius(cell: Cell): number {
    return this.sensingProfile(cell).radius;
  }

  sensingProfile(cell: Cell): { radius: number; clarity: number; processing: number } {
    const baseRadius = 16 + cell.radius * 3.4 + cell.genome.caution * 16;
    const atpResolution = clamp(cell.atp / 80, 0.18, 1.25);
    const aminoIntegrity = clamp(cell.aminoAcids / 45, 0.25, 1.15);
    const oxygenProcessing = clamp(cell.oxygen / 35, 0.35, 1.15);
    const rosIntegrity = clamp(1 - Math.max(0, cell.ros - 18) / 82, 0.35, 1);
    const healthIntegrity = clamp(cell.health, 0.3, 1);
    const radius = baseRadius
      * clamp(0.3 + atpResolution * 0.7, 0.3, 1.18)
      * clamp(0.68 + oxygenProcessing * 0.32, 0.68, 1.08)
      * clamp(0.78 + rosIntegrity * 0.22, 0.55, 1);
    const clarity = clamp(
      aminoIntegrity * 0.42
        + atpResolution * 0.24
        + oxygenProcessing * 0.16
        + rosIntegrity * 0.12
        + healthIntegrity * 0.06,
      0.15,
      1,
    );
    return {
      radius,
      clarity,
      processing: clamp(oxygenProcessing * rosIntegrity, 0.2, 1),
    };
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
    this.removeDeadCells();
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
    this.state.boardRadius = randomized ? this.rng.range(84, 104) : 92;
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
        this.keepBlockInDish(block);
      }
    }

    const defaultCellCount = randomized ? 9 + Math.floor(this.rng.range(0, 18)) : 16;
    const cellCount = options.cellCount === undefined
      ? defaultCellCount
      : clamp(Math.round(options.cellCount), 1, 80);
    for (let index = 0; index < cellCount; index += 1) {
      const cell = this.createCell(vec(), index % 3);
      const spawnPoint = this.findCellSpawnPoint(cell);
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
        position: this.findOpenPoint(this.state.boardRadius - 14, 6),
        radius: this.rng.range(2.3, 5.8),
        potency: this.rng.range(0.45, 1),
      });
    }
  }

  private createBlock(position: Vec2, width: number, height: number): Block {
    const count = 10 + Math.floor(this.rng.range(0, 5));
    const vertices: Vec2[] = [];
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2;
      const wobble = this.rng.range(0.68, 1.18);
      vertices.push(vec(Math.cos(angle) * width * wobble, Math.sin(angle) * height * this.rng.range(0.72, 1.22)));
    }
    const radius = vertices.reduce((max, point) => Math.max(max, length(point)), 0) + 0.4;
    return {
      id: this.nextId++,
      position,
      size: vec(width * 2, height * 2),
      vertices,
      radius,
    };
  }

  private createPlacedBlock(width: number, height: number): Block {
    const block = this.createBlock(vec(), width, height);
    const maxCenterDistance = Math.max(0, this.state.boardRadius - block.radius - 2);
    block.position = this.findOpenPoint(maxCenterDistance, block.radius + 2);
    this.keepBlockInDish(block);
    return block;
  }

  private createCell(position: Vec2, family = 0, generation = 1): Cell {
    const base: CellGenome = {
      motility: this.rng.range(0.35, 0.8),
      split: this.rng.range(0.25, 0.65),
      harvest: this.rng.range(0.3, 0.85),
      predator: family === 2 ? this.rng.range(0.45, 0.9) : this.rng.range(0.05, 0.35),
      caution: this.rng.range(0.25, 0.75),
    };

    return {
      id: this.nextId++,
      generation,
      position,
      velocity: vec(this.rng.signed(0.08), this.rng.signed(0.08)),
      radius: this.rng.range(2.7, 4.2),
      bodyLength: this.rng.range(1.45, 2.25),
      energy: 80,
      mass: this.rng.range(0.45, 1.05),
      health: 1,
      atp: 80,
      glucose: 60,
      aminoAcids: 70,
      oxygen: 50,
      ros: 5,
      glycogen: 30,
      glucoseTransport: this.rng.range(0.35, 0.65),
      aminoTransport: this.rng.range(0.35, 0.65),
      oxygenMetabolism: this.rng.range(0.3, 0.6),
      ribosomeActivity: this.rng.range(0.35, 0.65),
      atpRate: 0,
      glucoseRate: 0,
      glycogenRate: 0,
      autophagyRate: 0,
      aminoRate: 0,
      oxygenRate: 0,
      rosRate: 0,
      lightFactor: 0,
      age: 0,
      genome: base,
      signalPhase: this.rng.range(0, Math.PI * 2),
      lastSignal: vec(),
    };
  }

  private normalizeCell(cell: Cell): void {
    cell.atp ??= cell.energy ?? 50;
    cell.glucose ??= 60;
    cell.aminoAcids ??= Math.max(15, (cell.mass ?? 0.6) * 55);
    cell.oxygen ??= 35;
    cell.ros ??= 10;
    cell.glycogen ??= 24;
    cell.glucoseTransport ??= 0.5;
    cell.aminoTransport ??= 0.5;
    cell.oxygenMetabolism ??= 0.45;
    cell.ribosomeActivity ??= 0.5;
    cell.atpRate ??= 0;
    cell.glucoseRate ??= 0;
    cell.glycogenRate ??= 0;
    cell.autophagyRate ??= 0;
    cell.aminoRate ??= 0;
    cell.oxygenRate ??= 0;
    cell.rosRate ??= 0;
    cell.lightFactor ??= 0;
    cell.energy = cell.atp;
  }

  private normalizeBlock(block: Block): void {
    if (block.vertices.length > 0) {
      block.radius = block.vertices.reduce((max, point) => Math.max(max, length(point)), 0) + 0.4;
    }
    this.keepBlockInDish(block);
  }

  private createResource(resourceKind?: ResourceKind): Resource {
    const kind = resourceKind ?? this.rng.pick(RESOURCE_KINDS);
    const position = this.findOpenPoint(84, kind === 'light' ? 8 : 4);
    return {
      id: this.nextId++,
      kind,
      position,
      origin: kind === 'light' ? { ...position } : undefined,
      orbitRadius: kind === 'light' ? this.rng.range(9, 26) : undefined,
      orbitSpeed: kind === 'light' ? this.rng.range(0.004, 0.011) : undefined,
      orbitPhase: kind === 'light' ? this.rng.range(0, Math.PI * 2) : undefined,
      amount: this.rng.range(0.45, 1),
      radius: kind === 'light' ? this.rng.range(4, 8) : kind === 'oxygen' ? this.rng.range(2.6, 5.6) : this.rng.range(1.3, 4.8),
    };
  }

  private updateCell(cell: Cell): void {
    const beforeAtp = cell.atp;
    const beforeGlucose = cell.glucose;
    const beforeAmino = cell.aminoAcids;
    const beforeOxygen = cell.oxygen;
    const beforeRos = cell.ros;
    const beforeGlycogen = cell.glycogen;
    cell.glucoseRate = 0;
    cell.glycogenRate = 0;
    cell.autophagyRate = 0;
    cell.age += 1;
    cell.signalPhase += 0.12 + cell.genome.motility * 0.04;

    const awareness = this.awarenessRadius(cell);
    const pull = this.scanEnvironment(cell, awareness);
    const jitter = vec(this.rng.signed(0.15), this.rng.signed(0.15));
    const desired = add(scale(normalize(pull), 0.08 + cell.genome.motility * 0.16), jitter);
    const metabolicBoost = 0.75 + cell.oxygenMetabolism * 0.55;
    const sizeDrag = 1 + Math.max(0, cell.radius - 3) * 0.16;
    cell.velocity = clampLength(add(scale(cell.velocity, 0.82), desired), ((0.38 + cell.genome.motility * 0.42) * metabolicBoost) / sizeDrag);
    cell.position = add(cell.position, cell.velocity);
    cell.lastSignal = pull;

    this.keepInDish(cell);
    this.resolveBlocks(cell);
    this.consumeResources(cell);
    this.applyHazards(cell);

    const lightFactor = this.localLight(cell.position);
    cell.lightFactor = Math.max(0, lightFactor);
    const photosynthesisGlucose = Math.max(0, lightFactor) * (0.35 + cell.genome.harvest * 0.25);
    cell.glucose += photosynthesisGlucose;
    cell.oxygen = clamp(cell.oxygen + lightFactor * 0.018, 0, 100);

    if (cell.glucose > 80 && cell.glycogen < 200 && cell.atp > 1) {
      const glucoseToPack = Math.min(cell.glucose - 80, (200 - cell.glycogen) * 2);
      cell.glucose -= glucoseToPack;
      cell.glycogen += glucoseToPack / 2;
      cell.atp -= glucoseToPack / 2;
    }

    if (cell.glucose < 1 && cell.glycogen > 0) {
      const glucoseNeeded = 1 - cell.glucose;
      const glycogenToUnpack = Math.min(cell.glycogen, glucoseNeeded / 2);
      cell.glycogen -= glycogenToUnpack;
      cell.glucose += glycogenToUnpack * 2;
    }

    const glucoseUsed = Math.min(cell.glucose, 1);
    if (glucoseUsed > 0) {
      const oxygenNeeded = glucoseUsed * (0.28 + cell.oxygenMetabolism * 0.42);
      const oxygenUsed = Math.min(cell.oxygen, oxygenNeeded);
      const oxygenRatio = oxygenNeeded > 0 ? oxygenUsed / oxygenNeeded : 0;
      cell.glucose -= glucoseUsed;
      cell.oxygen -= oxygenUsed;
      cell.atp += 2 * glucoseUsed * oxygenRatio * (0.7 + cell.oxygenMetabolism * 0.6);
      cell.ros += (0.06 + cell.oxygenMetabolism * 0.12) * glucoseUsed * oxygenRatio;
    }

    if (cell.atp >= 1 && cell.aminoAcids >= 0.2) {
      cell.atp -= 1;
      cell.aminoAcids -= 0.2;
      cell.health = clamp(cell.health + 0.002, 0, 1);
    } else {
      cell.health -= 0.012;
    }

    if (cell.glucose <= 0.01 && cell.glycogen <= 0.01 && cell.aminoAcids > 0) {
      const autophagyAmino = Math.min(cell.aminoAcids, 2);
      cell.aminoAcids -= autophagyAmino;
      cell.mass -= autophagyAmino * 0.002;
      cell.health -= autophagyAmino * 0.003;
      cell.atp += autophagyAmino * 0.8;
      cell.autophagyRate = autophagyAmino;
    }

    const movementCost = length(cell.velocity) * (0.28 + cell.genome.motility * 0.12) * Math.pow(cell.radius / 3.2, 1.45) * (0.85 + cell.oxygenMetabolism * 0.35);
    cell.atp -= movementCost;
    const repairBudget = Math.min(cell.atp, cell.aminoAcids, 0.06 + cell.ribosomeActivity * 0.16);
    if (cell.ros > 18 && repairBudget > 0) {
      cell.ros -= repairBudget * (0.55 + cell.ribosomeActivity * 0.65);
      cell.atp -= repairBudget * (0.35 + cell.ribosomeActivity * 0.45);
      cell.aminoAcids -= repairBudget * (0.35 + cell.ribosomeActivity * 0.55);
    }
    const growthBias = 1 - cell.ribosomeActivity;
    cell.mass += Math.max(0, Math.min(cell.atp - 78, cell.aminoAcids - 45)) * 0.0012 * (0.45 + growthBias * 0.75 + cell.genome.harvest * 0.4);
    if (cell.atp < 12) {
      cell.mass -= 0.0045;
      cell.aminoAcids = Math.max(0, cell.aminoAcids - 0.03);
    }
    if (cell.aminoAcids < 8) {
      cell.health -= 0.006;
    }
    cell.health -= Math.max(0, cell.ros - 45) * 0.0008;
    cell.mass = clamp(cell.mass, 0.18, 2.4);
    cell.radius = this.radiusForMass(cell);
    cell.atp = clamp(cell.atp, -12, 100);
    cell.glucose = clamp(cell.glucose, 0, 100);
    cell.aminoAcids = clamp(cell.aminoAcids, 0, 100);
    cell.oxygen = clamp(cell.oxygen, 0, 100);
    cell.ros = clamp(cell.ros, 0, 100);
    cell.glycogen = clamp(cell.glycogen, 0, 200);
    cell.energy = cell.atp;
    cell.health = clamp(cell.health + (cell.atp > 15 && cell.aminoAcids > 12 && cell.ros < 35 ? 0.001 : -0.006), 0, 1);
    this.constrainCell(cell);
    cell.atpRate = cell.atp - beforeAtp;
    cell.glucoseRate = cell.glucose - beforeGlucose;
    cell.glycogenRate = cell.glycogen - beforeGlycogen;
    cell.aminoRate = cell.aminoAcids - beforeAmino;
    cell.oxygenRate = cell.oxygen - beforeOxygen;
    cell.rosRate = cell.ros - beforeRos;

    if (cell.atp > 92 && cell.aminoAcids > 55 && cell.mass > 1.12 && cell.genome.split > 0.4 && this.state.cells.length < 55) {
      this.splitCell(cell);
    }
  }

  private scanEnvironment(cell: Cell, awareness: number): Vec2 {
    let pull = vec();

    for (const resource of this.state.resources) {
      const d = distance(cell.position, resource.position);
      if (d > awareness) {
        continue;
      }
      const value = resource.kind === 'light' ? 0.75 : 1.25;
      pull = add(pull, scale(normalize(sub(resource.position, cell.position)), value * (1 - d / awareness) * cell.genome.harvest));
    }

    for (const hazard of this.state.hazards) {
      const d = distance(cell.position, hazard.position);
      if (d < awareness + hazard.radius) {
        pull = add(pull, scale(normalize(sub(cell.position, hazard.position)), (1.5 - d / awareness) * cell.genome.caution * 1.8));
      }
    }

    for (const other of this.state.cells) {
      if (other === cell) {
        continue;
      }
      const d = distance(cell.position, other.position);
      if (d < awareness) {
        const direction = normalize(sub(other.position, cell.position));
        const predatory = cell.radius > other.radius * 1.08 && cell.genome.predator > 0.4;
        pull = add(pull, scale(direction, predatory ? cell.genome.predator : -0.15));
      }
    }

    return pull;
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
      const consumedAmount = this.transportResource(cell, resource);
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
        const minDistance = this.cellCollisionRadius(left) + this.cellCollisionRadius(right);
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
    const offsetDistance = this.cellCollisionRadius(cell) * 1.15;
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
    child.radius = this.radiusForMass(child);
    cell.atp *= 0.48;
    cell.energy = cell.atp;
    cell.glucose *= 0.52;
    cell.aminoAcids *= 0.52;
    cell.oxygen *= 0.55;
    cell.ros *= 0.65;
    cell.glycogen *= 0.52;
    cell.mass *= 0.58;
    cell.radius = this.radiusForMass(cell);
    this.state.cells.push(child);
    this.resolveCellObstacles();
  }

  private cellCollisionRadius(cell: Cell): number {
    return cell.radius * Math.max(1, cell.bodyLength) * 1.18 + 0.35;
  }

  private findCellSpawnPoint(cell: Cell, preferred?: Vec2, allowFallback = false): Vec2 | null {
    const collisionRadius = this.cellCollisionRadius(cell);
    const maxCenterDistance = Math.max(0, this.state.boardRadius - collisionRadius);
    if (preferred) {
      const clampedPreferred = this.clampPointToCellBounds(preferred, collisionRadius);
      if (this.isCellSpawnPointOpen(clampedPreferred, cell)) {
        return clampedPreferred;
      }
      for (let attempt = 0; attempt < 48; attempt += 1) {
        const angle = this.rng.range(0, Math.PI * 2);
        const spread = Math.sqrt(this.rng.next()) * (collisionRadius + 18);
        const point = this.clampPointToCellBounds(add(preferred, vec(Math.cos(angle) * spread, Math.sin(angle) * spread)), collisionRadius);
        if (this.isCellSpawnPointOpen(point, cell)) {
          return point;
        }
      }
    }
    for (let attempt = 0; attempt < 220; attempt += 1) {
      const point = this.randomDishPoint(maxCenterDistance);
      if (this.isCellSpawnPointOpen(point, cell)) {
        return point;
      }
    }
    return allowFallback ? this.leastCrowdedCellSpawnPoint(cell, maxCenterDistance) : null;
  }

  private isCellSpawnPointOpen(point: Vec2, cell: Cell): boolean {
    const collisionRadius = this.cellCollisionRadius(cell);
    if (length(point) > this.state.boardRadius - collisionRadius) {
      return false;
    }
    for (const block of this.state.blocks) {
      if (distance(point, block.position) < block.radius + collisionRadius + 0.6) {
        return false;
      }
    }
    for (const other of this.state.cells) {
      if (distance(point, other.position) < collisionRadius + this.cellCollisionRadius(other) + 0.6) {
        return false;
      }
    }
    return true;
  }

  private leastCrowdedCellSpawnPoint(cell: Cell, maxCenterDistance: number): Vec2 {
    let best = this.randomDishPoint(maxCenterDistance);
    let bestScore = -Infinity;
    for (let attempt = 0; attempt < 220; attempt += 1) {
      const point = this.randomDishPoint(maxCenterDistance);
      const score = this.cellSpawnClearanceScore(point, cell);
      if (score > bestScore) {
        best = point;
        bestScore = score;
      }
    }
    return best;
  }

  private cellSpawnClearanceScore(point: Vec2, cell: Cell): number {
    const collisionRadius = this.cellCollisionRadius(cell);
    let score = this.state.boardRadius - collisionRadius - length(point);
    for (const block of this.state.blocks) {
      score = Math.min(score, distance(point, block.position) - block.radius - collisionRadius);
    }
    for (const other of this.state.cells) {
      score = Math.min(score, distance(point, other.position) - this.cellCollisionRadius(other) - collisionRadius);
    }
    return score;
  }

  private clampPointToCellBounds(point: Vec2, collisionRadius: number): Vec2 {
    const max = Math.max(0, this.state.boardRadius - collisionRadius);
    const d = length(point);
    return d > max ? scale(normalize(point), max) : { ...point };
  }

  private removeDeadCells(): void {
    const survivors: Cell[] = [];
    for (const cell of this.state.cells) {
      if (cell.health > 0 && cell.atp > -10 && cell.mass > 0.16) {
        survivors.push(cell);
        continue;
      }
      this.events.push({
        kind: 'cell-died',
        position: { ...cell.position },
        cellId: cell.id,
        mass: cell.mass,
        radius: cell.radius,
      });
      this.spawnRemains(cell);
    }
    this.state.cells = survivors;
  }

  private spawnRemains(cell: Cell): void {
    const pieces = clamp(Math.round(cell.mass * 3), 1, 7);
    for (let index = 0; index < pieces; index += 1) {
      const angle = this.rng.range(0, Math.PI * 2);
      const spread = this.rng.range(0.3, cell.radius * 1.4);
      const position = add(cell.position, vec(Math.cos(angle) * spread, Math.sin(angle) * spread));
      this.state.resources.push({
        id: this.nextId++,
        kind: 'amino-acid',
        position: this.isOpenPoint(position, 2) ? position : this.findOpenPoint(82, 3),
        amount: clamp(cell.mass / pieces, 0.18, 0.9),
        radius: this.rng.range(1.1, Math.max(1.4, cell.radius * 0.42)),
      });
    }
  }

  private radiusForMass(cell: Cell): number {
    return clamp(1.85 + Math.sqrt(cell.mass) * 2.55, 2.2, 6.4);
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

  private transportResource(cell: Cell, resource: Resource): number {
    const channel =
      resource.kind === 'glucose'
        ? cell.glucoseTransport
        : resource.kind === 'amino-acid'
          ? cell.aminoTransport
          : resource.kind === 'oxygen'
            ? cell.oxygenMetabolism
            : 0;
    const consumedAmount = Math.min(resource.amount, 0.16 + channel * 0.72);
    const transportCost = (0.08 + resource.radius * 0.018) * (0.5 + channel);
    cell.atp -= transportCost;
    const uptake = consumedAmount * (0.7 + cell.genome.harvest * 0.55);
    if (resource.kind === 'glucose') {
      cell.glucose += uptake * 18;
    }
    if (resource.kind === 'amino-acid') {
      cell.aminoAcids += uptake * 22;
      cell.mass += uptake * 0.035 * (resource.radius / 2.4);
    }
    if (resource.kind === 'oxygen') {
      cell.oxygen += uptake * 28;
      cell.ros += uptake * 0.25;
    }
    resource.amount = Math.max(0, resource.amount - consumedAmount);
    resource.radius = Math.max(0.65, resource.radius * (0.62 + resource.amount * 0.38));
    cell.energy = cell.atp;
    return consumedAmount;
  }

  private keepInDish(cell: Cell): void {
    const d = length(cell.position);
    const max = Math.max(0, this.state.boardRadius - this.cellCollisionRadius(cell));
    if (d > max) {
      const inward = scale(normalize(cell.position), max);
      cell.position = inward;
      cell.velocity = scale(cell.velocity, -0.25);
      cell.energy -= 0.25;
    }
  }

  private keepBlockInDish(block: Block): void {
    const max = Math.max(0, this.state.boardRadius - block.radius - 2);
    const d = length(block.position);
    if (d > max) {
      block.position = d > 0.001 ? scale(normalize(block.position), max) : vec();
    }
  }

  private resolveBlocks(cell: Cell): void {
    for (const block of this.state.blocks) {
      const d = distance(cell.position, block.position);
      const minDistance = block.radius + this.cellCollisionRadius(cell);
      if (d < minDistance) {
        const push = this.cellPushDirection(cell, block.position);
        cell.position = add(cell.position, scale(push, minDistance - d + 0.08));
        cell.velocity = scale(cell.velocity, -0.2);
      }
    }
  }

  private resolveCellObstacles(): void {
    for (let pass = 0; pass < 8; pass += 1) {
      this.resolveCells();
      for (const cell of this.state.cells) {
        this.constrainCell(cell);
      }
    }
  }

  private constrainCell(cell: Cell): void {
    this.keepInDish(cell);
    this.resolveBlocks(cell);
    this.keepInDish(cell);
  }

  private cellPushDirection(cell: Cell, origin: Vec2): Vec2 {
    const away = sub(cell.position, origin);
    if (length(away) > 0.001) {
      return normalize(away);
    }
    if (length(cell.velocity) > 0.001) {
      return normalize(cell.velocity);
    }
    return normalize(origin.x === 0 && origin.y === 0 ? vec(1, 0) : origin);
  }

  private spawnAmbientResources(): void {
    if (this.state.resources.length < 95 && this.rng.next() < 0.3) {
      this.state.resources.push(this.createResource());
    }
  }

  private updateLightCycle(): void {
    const dayAngle = this.state.tick * 0.012;
    const sunPosition = vec(Math.cos(dayAngle) * 52, Math.sin(dayAngle * 0.82) * 42);

    for (const resource of this.state.resources) {
      if (resource.kind !== 'light') {
        continue;
      }

      const origin = resource.origin ?? resource.position;
      const orbitRadius = resource.orbitRadius ?? 16;
      const orbitSpeed = resource.orbitSpeed ?? 0.007;
      const orbitPhase = resource.orbitPhase ?? 0;
      const angle = this.state.tick * orbitSpeed + orbitPhase;
      const drift = vec(Math.cos(angle) * orbitRadius, Math.sin(angle * 1.37) * orbitRadius * 0.55);
      const sunPull = scale(sub(sunPosition, origin), 0.34);
      const next = add(add(origin, drift), sunPull);
      const max = this.state.boardRadius - resource.radius - 3;
      const fromCenter = length(next);
      resource.position = fromCenter > max ? scale(normalize(next), max) : next;

      const dayPulse = 0.5 + Math.sin(dayAngle + orbitPhase) * 0.5;
      resource.amount = clamp(0.28 + dayPulse * 0.72, 0.18, 1);
    }
  }

  private findOpenPoint(radius: number, clearance: number): Vec2 {
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const point = this.randomDishPoint(radius);
      if (this.isOpenPoint(point, clearance)) {
        return point;
      }
    }
    return this.randomDishPoint(radius * 0.65);
  }

  private isOpenPoint(point: Vec2, clearance: number): boolean {
    for (const block of this.state.blocks) {
      if (this.pointNearBlock(point, block, clearance)) {
        return false;
      }
    }
    for (const cell of this.state.cells) {
      if (distance(point, cell.position) < clearance + cell.radius * cell.bodyLength) {
        return false;
      }
    }
    for (const resource of this.state.resources) {
      if (distance(point, resource.position) < clearance + resource.radius) {
        return false;
      }
    }
    return true;
  }

  private pointNearBlock(point: Vec2, block: Block, clearance: number): boolean {
    return distance(point, block.position) < block.radius + clearance;
  }

  private randomDishPoint(radius: number): Vec2 {
    const angle = this.rng.range(0, Math.PI * 2);
    const distanceFromCenter = Math.sqrt(this.rng.next()) * radius;
    return vec(Math.cos(angle) * distanceFromCenter, Math.sin(angle) * distanceFromCenter);
  }

  private scatterPoint(center: Vec2, radius: number): Vec2 {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const angle = this.rng.range(0, Math.PI * 2);
      const spread = Math.sqrt(this.rng.next()) * radius;
      const point = add(center, vec(Math.cos(angle) * spread, Math.sin(angle) * spread));
      if (length(point) <= this.state.boardRadius - 4 && !this.state.blocks.some((block) => this.pointNearBlock(point, block, 1.2))) {
        return point;
      }
    }
    const max = this.state.boardRadius - 5;
    return length(center) > max ? scale(normalize(center), max) : center;
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
