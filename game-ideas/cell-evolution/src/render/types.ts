export type MapPick =
  | { kind: 'cell'; id: number }
  | { kind: 'resource'; id: number }
  | { kind: 'hazard'; id: number }
  | { kind: 'block'; id: number }
  | { kind: 'dish'; id: null };

export type PickResult = {
  target: MapPick;
  dragged: boolean;
};

export type RendererView = {
  zoom: number;
  cameraX: number;
  cameraY: number;
};
