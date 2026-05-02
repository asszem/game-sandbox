import { Rng } from './rng';
import type { Block, Cell, CellGenome, DNAKey, Hazard, Resource, ResourceKind, SimulationEvent, SimulationState, Vec2 } from './types';
import { add, clamp, clampLength, distance, length, normalize, scale, sub, vec } from './vector';

const DNA_KEYS: DNAKey[] = ['motility', 'split', 'harvest', 'predator', 'caution'];
const RESOURCE_KINDS: ResourceKind[] = ['glucose', 'amino-acid', 'oxygen', 'light'];

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
    this.rng = new Rng(82421);
    this.nextId = 1;
    this.events = [];
    this.state.tick = 0;
    this.state.running = true;
    this.state.selectedCellId = null;
    this.state.boardRadius = 92;
    this.state.cells = [];
    this.state.resources = [];
    this.state.hazards = [];
    this.state.blocks = [];
    this.seedWorld();
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

  awarenessRadius(cell: Cell): number {
    return 16 + cell.radius * 3.4 + cell.genome.caution * 16;
  }

  step(): void {
    this.state.tick += 1;
    this.updateLightCycle();
    this.spawnAmbientResources();

    for (const cell of this.state.cells) {
      this.updateCell(cell);
    }

    this.resolveCells();
    this.removeDeadCells();
    if (this.state.selectedCellId && !this.state.cells.some((cell) => cell.id === this.state.selectedCellId)) {
      this.state.selectedCellId = null;
    }
  }

  private seedWorld(): void {
    this.state.blocks.push(
      this.createBlock(vec(-24, 25), 15, 7),
      this.createBlock(vec(29, -18), 8, 16),
      this.createBlock(vec(4, -42), 17, 6),
      this.createBlock(vec(42, 34), 10, 9),
    );

    for (let index = 0; index < 16; index += 1) {
      this.state.cells.push(this.createCell(this.findOpenPoint(68, 8), index % 3));
    }

    for (let index = 0; index < 70; index += 1) {
      this.state.resources.push(this.createResource());
    }

    for (let index = 0; index < 14; index += 1) {
      this.state.hazards.push({
        id: this.nextId++,
        kind: 'poison',
        position: this.findOpenPoint(78, 6),
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
    return {
      id: this.nextId++,
      position,
      size: vec(width * 2, height * 2),
      vertices,
      radius: Math.max(width, height) * 1.28,
    };
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
      energy: this.rng.range(45, 85),
      mass: this.rng.range(0.45, 1.05),
      health: 1,
      atp: this.rng.range(38, 78),
      aminoAcids: this.rng.range(35, 75),
      oxygen: this.rng.range(18, 56),
      ros: this.rng.range(4, 18),
      glucoseTransport: this.rng.range(0.35, 0.65),
      aminoTransport: this.rng.range(0.35, 0.65),
      oxygenMetabolism: this.rng.range(0.3, 0.6),
      ribosomeActivity: this.rng.range(0.35, 0.65),
      atpRate: 0,
      aminoRate: 0,
      oxygenRate: 0,
      rosRate: 0,
      age: 0,
      genome: base,
      signalPhase: this.rng.range(0, Math.PI * 2),
      lastSignal: vec(),
    };
  }

  private normalizeCell(cell: Cell): void {
    cell.atp ??= cell.energy ?? 50;
    cell.aminoAcids ??= Math.max(15, (cell.mass ?? 0.6) * 55);
    cell.oxygen ??= 35;
    cell.ros ??= 10;
    cell.glucoseTransport ??= 0.5;
    cell.aminoTransport ??= 0.5;
    cell.oxygenMetabolism ??= 0.45;
    cell.ribosomeActivity ??= 0.5;
    cell.atpRate ??= 0;
    cell.aminoRate ??= 0;
    cell.oxygenRate ??= 0;
    cell.rosRate ??= 0;
    cell.energy = cell.atp;
  }

  private createResource(): Resource {
    const kind = this.rng.pick(RESOURCE_KINDS);
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
    const beforeAmino = cell.aminoAcids;
    const beforeOxygen = cell.oxygen;
    const beforeRos = cell.ros;
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
    cell.oxygen = clamp(cell.oxygen + lightFactor * 0.018, 0, 100);
    const oxygenEfficiency = 0.45 + (cell.oxygen / 100) * (0.65 + cell.oxygenMetabolism * 2.2);
    const atpGenerated = (0.07 + cell.genome.harvest * 0.05) * oxygenEfficiency;
    cell.atp += atpGenerated;
    cell.oxygen = Math.max(0, cell.oxygen - 0.02 * oxygenEfficiency * (0.7 + cell.oxygenMetabolism));
    cell.ros += Math.max(0, oxygenEfficiency - 0.8) * (0.035 + cell.oxygenMetabolism * 0.055);
    const movementCost = length(cell.velocity) * (0.28 + cell.genome.motility * 0.12) * Math.pow(cell.radius / 3.2, 1.45) * (0.85 + cell.oxygenMetabolism * 0.35);
    const basalCost = 0.055 + Math.pow(cell.radius / 4.4, 1.25) * 0.06;
    cell.atp -= basalCost + movementCost;
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
    cell.atp = clamp(cell.atp, -12, 130);
    cell.aminoAcids = clamp(cell.aminoAcids, 0, 130);
    cell.oxygen = clamp(cell.oxygen, 0, 100);
    cell.ros = clamp(cell.ros, 0, 100);
    cell.energy = cell.atp;
    cell.health = clamp(cell.health + (cell.atp > 15 && cell.aminoAcids > 12 ? 0.002 : -0.01), 0, 1);
    cell.atpRate = cell.atp - beforeAtp;
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
        const minDistance = left.radius + right.radius;
        if (d >= minDistance || d <= 0.01) {
          continue;
        }

        const direction = normalize(sub(right.position, left.position));
        const overlap = minDistance - d;
        left.position = add(left.position, scale(direction, -overlap * 0.42));
        right.position = add(right.position, scale(direction, overlap * 0.42));

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
    const offset = vec(Math.cos(angle) * cell.radius * 1.2, Math.sin(angle) * cell.radius * 1.2);
    const child = this.createCell(add(cell.position, offset), 0, cell.generation + 1);
    child.genome = this.mutateGenome(cell.genome);
    child.atp = cell.atp * 0.42;
    child.energy = child.atp;
    child.aminoAcids = cell.aminoAcids * 0.42;
    child.oxygen = cell.oxygen * 0.5;
    child.ros = cell.ros * 0.35;
    child.mass = cell.mass * 0.48;
    child.bodyLength = clamp(cell.bodyLength + this.rng.signed(0.16), 1.35, 2.55);
    child.radius = this.radiusForMass(child);
    cell.atp *= 0.48;
    cell.energy = cell.atp;
    cell.aminoAcids *= 0.52;
    cell.oxygen *= 0.55;
    cell.ros *= 0.65;
    cell.mass *= 0.58;
    cell.radius = this.radiusForMass(cell);
    this.state.cells.push(child);
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
      cell.atp += uptake * (10 + cell.oxygen * 0.12);
      cell.ros += uptake * (cell.oxygen / 100) * 0.7;
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
    const max = this.state.boardRadius - cell.radius - 2;
    if (d > max) {
      const inward = scale(normalize(cell.position), max);
      cell.position = inward;
      cell.velocity = scale(cell.velocity, -0.25);
      cell.energy -= 0.25;
    }
  }

  private resolveBlocks(cell: Cell): void {
    for (const block of this.state.blocks) {
      const d = distance(cell.position, block.position);
      if (d < block.radius + cell.radius && this.pointNearBlock(cell.position, block, cell.radius)) {
        const push = normalize(sub(cell.position, block.position));
        cell.position = add(cell.position, scale(push, block.radius + cell.radius - d + 0.08));
        cell.velocity = scale(cell.velocity, -0.2);
      }
    }
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
