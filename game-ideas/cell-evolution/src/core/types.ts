export type Vec2 = {
  x: number;
  y: number;
};

export type ResourceKind = 'glucose' | 'amino-acid' | 'oxygen' | 'light';
export type HazardKind = 'poison';
export type DNAKey = 'motility' | 'split' | 'harvest' | 'predator' | 'caution';

export type CellGenome = Record<DNAKey, number>;

export type Cell = {
  id: number;
  generation: number;
  position: Vec2;
  velocity: Vec2;
  radius: number;
  bodyLength: number;
  energy: number;
  mass: number;
  health: number;
  atp: number;
  aminoAcids: number;
  oxygen: number;
  ros: number;
  glucoseTransport: number;
  aminoTransport: number;
  oxygenMetabolism: number;
  ribosomeActivity: number;
  atpRate: number;
  aminoRate: number;
  oxygenRate: number;
  rosRate: number;
  age: number;
  genome: CellGenome;
  signalPhase: number;
  lastSignal: Vec2;
};

export type Resource = {
  id: number;
  kind: ResourceKind;
  position: Vec2;
  origin?: Vec2;
  orbitRadius?: number;
  orbitSpeed?: number;
  orbitPhase?: number;
  amount: number;
  radius: number;
};

export type Hazard = {
  id: number;
  kind: HazardKind;
  position: Vec2;
  radius: number;
  potency: number;
};

export type Block = {
  id: number;
  position: Vec2;
  size: Vec2;
  vertices: Vec2[];
  radius: number;
};

export type SimulationState = {
  tick: number;
  running: boolean;
  selectedCellId: number | null;
  boardRadius: number;
  cells: Cell[];
  resources: Resource[];
  hazards: Hazard[];
  blocks: Block[];
};

export type SimulationEvent =
  | {
      kind: 'resource-consumed';
      position: Vec2;
      resourceKind: ResourceKind;
      amount: number;
      radius: number;
    }
  | {
      kind: 'cell-devoured';
      position: Vec2;
      hunterId: number;
      preyId: number;
      mass: number;
      radius: number;
    }
  | {
      kind: 'cell-died';
      position: Vec2;
      cellId: number;
      mass: number;
      radius: number;
    };
