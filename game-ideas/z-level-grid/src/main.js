import * as THREE from 'three';
import { buildLevelStack, createMaterials } from './scene-builders.js';
import { createSideLabelController, createSideLabels, sideRotations } from './side-labels.js';
import { createCamera, syncCamera, syncOrtho, worldUnitsPerPixel } from './camera-controls.js';
const canvas = document.getElementById('game');
const selectedReadout = document.getElementById('selected-readout');
const rotationReadout = document.getElementById('rotation-readout');
const zoomReadout = document.getElementById('zoom-readout');
const inputReadout = document.getElementById('input-readout');
const grid = {
  columns: 100,
  rows: 100,
  layers: 100,
  cellSize: 1,
  layerGap: 1,
};
const defaultRotation = { x: 0, y: 0, z: 0 };
const state = {
  selected: { x: 49, y: 49, z: 99 },
  lastInput: 'none',
  cameraDistance: 90,
  cameraTarget: new THREE.Vector3(0, 0, 99),
  rotation: { ...defaultRotation },
  visibleSide: 1,
  zoom: { lastAt: 0, streakStartedAt: 0, step: 0 },
  drag: {
    active: false,
    pointerId: null,
    button: 0,
    x: 0,
    y: 0,
  },
};
const projectedPosition = new THREE.Vector3();
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
});
renderer.setClearColor(0x111820, 1);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

const scene = new THREE.Scene();

const camera = createCamera();
syncCameraDistance();

const levelRoot = new THREE.Group();
scene.add(levelRoot);
const sideLabels = createSideLabels(grid);
const sideLabelControl = createSideLabelController(sideLabels);
levelRoot.add(sideLabels);

let selectedMesh;
let layerVisuals = [];
const visitedCells = new Set();
const trailGroup = new THREE.Group();
const materials = createMaterials();

({ layerVisuals, selectedMesh } = buildLevelStack({
  grid,
  levelRoot,
  materials,
  trailGroup,
}));
addVisitedCell();
updateSelectionMaterials();
syncCameraDistance();
resize();

const controls = new Map([
  ['w', () => moveTowardScreen('top')],
  ['a', () => moveTowardScreen('left')],
  ['s', () => moveTowardScreen('bottom')],
  ['d', () => moveTowardScreen('right')],
  ['r', () => move(0, 0, 1, 'up')],
  ['f', () => move(0, 0, -1, 'down')],
]);

const shiftedControls = new Map([
  ['w', () => rotateField(-0.12, 0, 0, 'shift w rotate x-')],
  ['s', () => rotateField(0.12, 0, 0, 'shift s rotate x+')],
  ['a', () => rotateField(0, 0, -0.12, 'shift a rotate z-')],
  ['d', () => rotateField(0, 0, 0.12, 'shift d rotate z+')],
]);

function updateSelectionMaterials() {
  for (const visual of layerVisuals) {
    const activeLayer = visual.z === state.selected.z;
    visual.surface.material = activeLayer ? materials.active : materials.inactive;
    visual.lines.material = activeLayer ? materials.lineActive : materials.lineInactive;
  }
  moveSelectedMesh();
  updateHud();
}

function moveSelectedMesh() {
  selectedMesh.position.copy(cellToWorld(state.selected.x, state.selected.y, state.selected.z, 0.012));
}

function addVisitedCell() {
  const key = `${state.selected.x},${state.selected.y},${state.selected.z}`;
  if (visitedCells.has(key)) {
    return;
  }

  visitedCells.add(key);
  const geometry = new THREE.BoxGeometry(
    grid.cellSize * 0.82,
    grid.cellSize * 0.82,
    grid.cellSize * 0.82,
  );
  const trailMesh = new THREE.Mesh(geometry, materials.trail);
  trailMesh.position.copy(cellToWorld(state.selected.x, state.selected.y, state.selected.z, 0));
  trailMesh.renderOrder = 9;
  trailGroup.add(trailMesh);
}

function cellToWorld(x, y, z, zOffset = 0) {
  const offsetX = (grid.columns - 1) / 2;
  const offsetY = (grid.rows - 1) / 2;
  return new THREE.Vector3(x - offsetX, y - offsetY, z * grid.layerGap + zOffset);
}

function move(dx, dy, dz, label) {
  const nextX = clamp(state.selected.x + dx, 0, grid.columns - 1);
  const nextY = clamp(state.selected.y + dy, 0, grid.rows - 1);
  state.selected.x = nextX;
  state.selected.y = nextY;
  state.selected.z = clamp(state.selected.z + dz, 0, grid.layers - 1);
  state.lastInput = label;
  addVisitedCell();
  updateSelectionMaterials();
  render();
}

function moveTowardScreen(edge) {
  const candidates = getScreenMoveCandidates();
  const ranked = candidates
    .map((candidate) => ({
      ...candidate,
      score: getScreenEdgeScore(edge, candidate.screenDelta),
    }))
    .filter((candidate) => candidate.score > 0.0001)
    .sort((a, b) => b.score - a.score);

  if (!ranked.length) {
    state.lastInput = `${edge} blocked`;
    updateHud();
    render();
    return;
  }

  const best = ranked[0];
  move(best.dx, best.dy, 0, edge);
}

function getScreenMoveCandidates() {
  const { x, y, z } = state.selected;
  const origin = projectCellCenter(x, y, z);
  const directions = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];

  return directions
    .map((direction) => ({
      ...direction,
      x: x + direction.dx,
      y: y + direction.dy,
    }))
    .filter((candidate) => isWithinGrid(candidate.x, candidate.y))
    .map((candidate) => {
      const projected = projectCellCenter(candidate.x, candidate.y, z);
      return {
        ...candidate,
        screenDelta: {
          x: projected.x - origin.x,
          y: projected.y - origin.y,
        },
      };
    });
}

function projectCellCenter(x, y, z) {
  const offsetX = (grid.columns - 1) / 2;
  const offsetY = (grid.rows - 1) / 2;
  projectedPosition.set(x - offsetX, y - offsetY, z * grid.layerGap);
  levelRoot.updateMatrixWorld(true);
  projectedPosition.applyMatrix4(levelRoot.matrixWorld);
  projectedPosition.project(camera);
  return { x: projectedPosition.x, y: projectedPosition.y };
}

function getScreenEdgeScore(edge, delta) {
  if (edge === 'top') {
    return delta.y;
  }
  if (edge === 'bottom') {
    return -delta.y;
  }
  if (edge === 'right') {
    return delta.x;
  }
  return -delta.x;
}

function isWithinGrid(x, y) {
  return x >= 0 && x < grid.columns && y >= 0 && y < grid.rows;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function updateHud() {
  selectedReadout.textContent = `Selected: x ${state.selected.x + 1}, y ${state.selected.y + 1}, z ${state.selected.z + 1}`;
  rotationReadout.textContent = `Rotation: x ${formatAngle(state.rotation.x)}, y ${formatAngle(state.rotation.y)}, z ${formatAngle(state.rotation.z)}`;
  zoomReadout.textContent = `Zoom: ${state.cameraDistance.toFixed(1)}`;
  inputReadout.textContent = `Last input: ${state.lastInput}`;
}

function formatAngle(angle) {
  return angle.toFixed(2);
}

function applyRotationAroundSelected() {
  const pivot = cellToWorld(state.selected.x, state.selected.y, state.selected.z, 0);
  levelRoot.updateMatrixWorld(true);
  const pivotWorld = pivot.clone().applyMatrix4(levelRoot.matrixWorld);
  levelRoot.rotation.set(state.rotation.x, state.rotation.y, state.rotation.z);
  levelRoot.position.copy(pivotWorld).sub(pivot.clone().applyEuler(levelRoot.rotation));
}

function syncCameraDistance() {
  syncCamera(camera, state.cameraTarget, state.cameraDistance);
}

function syncCameraToCubeCenter() {
  levelRoot.updateMatrixWorld(true);
  state.cameraTarget.set(0, 0, ((grid.layers - 1) * grid.layerGap) / 2).applyMatrix4(levelRoot.matrixWorld);
  syncCameraDistance();
}

function resize() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  syncOrtho(camera, state.cameraDistance);
  render();
}

function render() {
  renderer.render(scene, camera);
}

function beginDrag(event) {
  event.preventDefault();
  state.drag.active = true;
  state.drag.pointerId = event.pointerId;
  state.drag.button = event.button;
  state.drag.x = event.clientX;
  state.drag.y = event.clientY;
  canvas.setPointerCapture(event.pointerId);
}

function drag(event) {
  if (!state.drag.active || event.pointerId !== state.drag.pointerId) {
    return;
  }

  const dx = event.clientX - state.drag.x;
  const dy = event.clientY - state.drag.y;
  state.drag.x = event.clientX;
  state.drag.y = event.clientY;

  if (state.drag.button === 2) {
    state.rotation.x = wrapAngle(state.rotation.x + dy * 0.01);
    state.rotation.y = wrapAngle(state.rotation.y + dx * 0.01);
    state.lastInput = 'right drag rotate x/y';
    applyRotationAroundSelected();
  } else if (state.drag.button === 1) {
    state.rotation.y = wrapAngle(state.rotation.y + dy * 0.01);
    state.lastInput = 'middle drag rotate y';
    applyRotationAroundSelected();
  } else {
    panCamera(dx, dy);
    state.lastInput = 'left drag pan';
  }

  updateHud();
  render();
}

function panCamera(dx, dy) {
  const unitsPerPixel = getWorldUnitsPerPixel();
  state.cameraTarget.x -= dx * unitsPerPixel;
  state.cameraTarget.y += dy * unitsPerPixel;
  camera.position.x = state.cameraTarget.x;
  camera.position.y = state.cameraTarget.y;
  camera.lookAt(state.cameraTarget);
}

function getWorldUnitsPerPixel() {
  return worldUnitsPerPixel(camera, canvas);
}

function rotateField(dx, dy, dz, label) {
  state.rotation.x = wrapAngle(state.rotation.x + dx);
  state.rotation.y = wrapAngle(state.rotation.y + dy);
  state.rotation.z = wrapAngle(state.rotation.z + dz);
  state.lastInput = label;
  applyRotationAroundSelected();
  updateHud();
  render();
}

function centerOnSelectedGrid() {
  state.cameraTarget.copy(selectedCellWorldPosition());
  state.lastInput = 'center';
  syncCameraDistance();
  updateHud();
  render();
}

function centerAndResetView() {
  state.rotation = { ...defaultRotation };
  state.visibleSide = 1;
  state.lastInput = 'center reset';
  levelRoot.position.set(0, 0, 0);
  levelRoot.rotation.set(0, 0, 0);
  state.cameraTarget.set(0, 0, state.selected.z * grid.layerGap);
  syncCameraDistance();
  updateHud();
  render();
}

function faceSide(code) {
  const rotation = sideRotations[code];
  if (!rotation) {
    return false;
  }
  state.rotation = { ...rotation };
  state.visibleSide = Number(code.slice(-1));
  state.lastInput = `face side ${state.visibleSide}`;
  applyRotationAroundSelected();
  syncCameraToCubeCenter();
  sideLabelControl.showOneFor(state.visibleSide);
  updateHud();
  render();
  return true;
}
function selectedCellWorldPosition() {
  levelRoot.updateMatrixWorld(true);
  return cellToWorld(state.selected.x, state.selected.y, state.selected.z, 0).applyMatrix4(levelRoot.matrixWorld);
}
function endDrag(event) {
  if (event.pointerId !== state.drag.pointerId) {
    return;
  }

  event.preventDefault();
  state.drag.active = false;
  state.drag.pointerId = null;
  canvas.releasePointerCapture(event.pointerId);
}

function zoom(event) {
  event.preventDefault();
  const now = performance.now();
  const direction = event.deltaY < 0 ? -1 : 1;
  const baseStep = event.shiftKey ? 10 : 1;
  if (now - state.zoom.lastAt > 1500) {
    state.zoom.streakStartedAt = now;
  }
  const streakSeconds = (now - state.zoom.streakStartedAt) / 1000;
  const acceleration = streakSeconds > 4 ? 4 : streakSeconds > 2 ? 2 : 1;
  state.zoom.lastAt = now;
  state.zoom.step = baseStep * acceleration;
  state.cameraDistance = clamp(state.cameraDistance + direction * state.zoom.step, 26, 300);
  state.lastInput = `${event.deltaY < 0 ? 'zoom in' : 'zoom out'} ${state.zoom.step}`;
  syncCameraDistance();
  updateHud();
  render();
}

function wrapAngle(angle) {
  const fullTurn = Math.PI * 2;
  return ((angle + Math.PI) % fullTurn + fullTurn) % fullTurn - Math.PI;
}

function renderGameToText() {
  const selectedScreen = projectCellCenter(state.selected.x, state.selected.y, state.selected.z);

  return JSON.stringify({
    game: 'z-level-grid',
    renderer: 'three-webgl',
    coordinateSystem: 'x increases right, y increases backward, z increases upward through layers; values are zero-based',
    grid: { columns: grid.columns, rows: grid.rows, layers: grid.layers },
    selected: { ...state.selected },
    selectedHuman: {
      x: state.selected.x + 1,
      y: state.selected.y + 1,
      z: state.selected.z + 1,
    },
    selectedScreen: {
      x: Number(selectedScreen.x.toFixed(4)),
      y: Number(selectedScreen.y.toFixed(4)),
    },
    cameraTarget: {
      x: Number(state.cameraTarget.x.toFixed(3)),
      y: Number(state.cameraTarget.y.toFixed(3)),
      z: Number(state.cameraTarget.z.toFixed(3)),
    },
    rotation: {
      x: Number(state.rotation.x.toFixed(3)),
      y: Number(state.rotation.y.toFixed(3)),
      z: Number(state.rotation.z.toFixed(3)),
      visibleSide: state.visibleSide,
    },
    zoom: {
      cameraDistance: Number(state.cameraDistance.toFixed(3)),
      lastStep: state.zoom.step,
    },
    trail: {
      visitedCells: visitedCells.size,
      shape: 'cube',
    },
    controls: {
      wasd: 'move toward screen edges within current z layer',
      r: 'up z+1',
      f: 'down z-1',
      leftDrag: 'pan camera target',
      rightDrag: 'rotate x and y angles',
      middleDrag: 'drag up/down to rotate y angle',
      shiftWasd: 'rotate x and z angles',
      q: 'rotate y-',
      e: 'rotate y+',
      c: 'center on selected grid without changing rotation',
      shiftC: 'center on selected grid and reset top view',
      altLeft: 'hold to show numbered cube sides',
      numbers: '1-6 rotate selected side toward the camera',
      wheel: 'zoom by 1, shift+wheel by 10, sustained wheel accelerates',
    },
    sideLabels: { visible: sideLabels.visible, count: sideLabels.children.length, visibleCount: sideLabels.children.filter((label) => label.visible).length, size: Number((sideLabels.children[0]?.scale.x ?? 0).toFixed(3)) },
    lastInput: state.lastInput,
  });
}

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  const handler = event.shiftKey ? shiftedControls.get(key) : controls.get(key);
  const yRotation = key === 'q' || key === 'e';
  if (event.code === 'AltLeft') {
    event.preventDefault();
    sideLabelControl.showAll();
    render();
  }
  if (faceSide(event.code)) {
    event.preventDefault();
    return;
  }
  if (key === 'c') {
    event.preventDefault();
    if (event.shiftKey) {
      centerAndResetView();
    } else {
      centerOnSelectedGrid();
    }
    return;
  }
  if (yRotation) {
    event.preventDefault();
    rotateField(0, key === 'q' ? -0.12 : 0.12, 0, `${key} rotate y`);
    return;
  }
  if (!handler) return;
  event.preventDefault();
  handler();
});
window.addEventListener('keyup', (event) => {
  if (event.code === 'AltLeft') {
    event.preventDefault();
    sideLabelControl.hide();
    render();
  }
});
window.addEventListener('resize', resize);
canvas.addEventListener('pointerdown', beginDrag);
canvas.addEventListener('pointermove', drag);
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('wheel', zoom, { passive: false });
document.addEventListener('contextmenu', (event) => event.preventDefault(), { capture: true });
window.render_game_to_text = renderGameToText;
window.advanceTime = () => render();
