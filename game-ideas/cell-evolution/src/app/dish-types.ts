import type { CellSimulation } from '../core/simulation';
import type { SimulationState } from '../core/types';
import type { PetriDishRenderer } from '../render/PetriDishRenderer';
import type { MapPick, RendererView } from '../render/types';
import type { NewDishSetup } from './new-dish';

export type DishInstance = {
  id: number;
  name: string;
  canvas: HTMLCanvasElement;
  label: HTMLElement;
  simulation: CellSimulation;
  renderer: PetriDishRenderer;
  inspectedTarget: MapPick;
  hoveredTarget: MapPick | null;
  accumulator: number;
  worldTime: number;
  zIndex: number;
  dragStart: {
    pointerId: number;
    x: number;
    y: number;
    mode: 'move' | 'pan';
    left: number;
    top: number;
    view: RendererView;
  } | null;
  dragMoved: boolean;
};

export type CreateDishOptions = {
  state?: SimulationState;
  inspectedTarget?: MapPick;
  view?: RendererView;
  left?: number;
  top?: number;
  size?: number;
  zIndex?: number;
  id?: number;
  name?: string;
  select?: boolean;
  setup?: NewDishSetup;
};
