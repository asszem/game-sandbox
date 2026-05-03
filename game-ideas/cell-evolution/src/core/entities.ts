import type { Block, Cell, CellGenome, Resource, ResourceKind, Vec2 } from './types';
import { length, vec } from './vector';
import { keepBlockInDish } from './cell-constraints';

type EntityRng = {
  range: (min: number, max: number) => number;
  signed: (magnitude: number) => number;
};

export const RESOURCE_KINDS: ResourceKind[] = ['glucose', 'amino-acid', 'oxygen', 'light'];

export function createBlockEntity(id: number, rng: EntityRng, position: Vec2, width: number, height: number): Block {
  const count = 10 + Math.floor(rng.range(0, 5));
  const vertices: Vec2[] = [];
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2;
    const wobble = rng.range(0.68, 1.18);
    vertices.push(vec(Math.cos(angle) * width * wobble, Math.sin(angle) * height * rng.range(0.72, 1.22)));
  }
  const radius = vertices.reduce((max, point) => Math.max(max, length(point)), 0) + 0.4;
  return {
    id,
    position,
    size: vec(width * 2, height * 2),
    vertices,
    radius,
  };
}

export function createCellEntity(id: number, rng: EntityRng, position: Vec2, family = 0, generation = 1): Cell {
  const base: CellGenome = {
    motility: rng.range(0.35, 0.8),
    split: rng.range(0.25, 0.65),
    harvest: rng.range(0.3, 0.85),
    predator: family === 2 ? rng.range(0.45, 0.9) : rng.range(0.05, 0.35),
    caution: rng.range(0.25, 0.75),
  };

  return {
    id,
    generation,
    position,
    velocity: vec(rng.signed(0.08), rng.signed(0.08)),
    radius: rng.range(2.7, 4.2),
    bodyLength: rng.range(1.45, 2.25),
    energy: 80,
    mass: rng.range(0.45, 1.05),
    health: 1,
    atp: 80,
    glucose: 60,
    aminoAcids: 70,
    oxygen: 50,
    ros: 5,
    glycogen: 30,
    glucoseTransport: rng.range(0.35, 0.65),
    aminoTransport: rng.range(0.35, 0.65),
    oxygenMetabolism: rng.range(0.3, 0.6),
    ribosomeActivity: rng.range(0.35, 0.65),
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
    signalPhase: rng.range(0, Math.PI * 2),
    lastSignal: vec(),
  };
}

export function createResourceEntity(id: number, rng: EntityRng, kind: ResourceKind, position: Vec2): Resource {
  return {
    id,
    kind,
    position,
    origin: kind === 'light' ? { ...position } : undefined,
    orbitRadius: kind === 'light' ? rng.range(9, 26) : undefined,
    orbitSpeed: kind === 'light' ? rng.range(0.004, 0.011) : undefined,
    orbitPhase: kind === 'light' ? rng.range(0, Math.PI * 2) : undefined,
    amount: rng.range(0.45, 1),
    radius: kind === 'light' ? rng.range(4, 8) : kind === 'oxygen' ? rng.range(2.6, 5.6) : rng.range(1.3, 4.8),
  };
}

export function normalizeCellEntity(cell: Cell): void {
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

export function normalizeBlockEntity(block: Block, boardRadius: number): void {
  if (block.vertices.length > 0) {
    block.radius = block.vertices.reduce((max, point) => Math.max(max, length(point)), 0) + 0.4;
  }
  keepBlockInDish(block, boardRadius);
}
