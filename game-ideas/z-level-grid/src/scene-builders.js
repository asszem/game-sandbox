import * as THREE from 'three';

export function createMaterials() {
  return {
    inactive: new THREE.MeshBasicMaterial({
      color: 0x718399,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
    active: new THREE.MeshBasicMaterial({
      color: 0x54a8c7,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
    selected: new THREE.MeshBasicMaterial({
      color: 0xf7c948,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      depthTest: false,
    }),
    trail: new THREE.MeshBasicMaterial({
      color: 0xff6b6b,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: false,
    }),
    lineInactive: new THREE.LineBasicMaterial({
      color: 0x6f8798,
      transparent: true,
      opacity: 0,
    }),
    lineActive: new THREE.LineBasicMaterial({
      color: 0xbfe8f5,
      transparent: true,
      opacity: 0.82,
    }),
  };
}

export function buildLevelStack({ grid, levelRoot, materials, trailGroup }) {
  const surfaceGeometry = new THREE.PlaneGeometry(grid.columns, grid.rows);
  const cellGeometry = new THREE.BoxGeometry(
    grid.cellSize * 0.9,
    grid.cellSize * 0.9,
    grid.cellSize * 0.9,
  );
  const layerVisuals = [];

  for (let z = 0; z < grid.layers; z += 1) {
    const surface = new THREE.Mesh(surfaceGeometry, materials.inactive);
    const lines = new THREE.LineSegments(createLayerLineGeometry(grid), materials.lineInactive);
    surface.position.z = z * grid.layerGap;
    lines.position.z = z * grid.layerGap;
    levelRoot.add(surface, lines);
    layerVisuals.push({ surface, lines, z });
  }

  const selectedMesh = new THREE.Mesh(cellGeometry, materials.selected);
  selectedMesh.position.z += 0.01;
  selectedMesh.renderOrder = 10;

  levelRoot.add(trailGroup, selectedMesh);
  addVolumeGrid(grid, levelRoot);
  addOuterFaceGrids(grid, levelRoot);

  return { layerVisuals, selectedMesh };
}

function createLayerLineGeometry(grid) {
  const points = [];
  const left = -grid.columns / 2;
  const right = grid.columns / 2;
  const bottom = -grid.rows / 2;
  const top = grid.rows / 2;

  for (let x = 0; x <= grid.columns; x += 1) {
    const worldX = left + x;
    points.push(new THREE.Vector3(worldX, bottom, 0), new THREE.Vector3(worldX, top, 0));
  }
  for (let y = 0; y <= grid.rows; y += 1) {
    const worldY = bottom + y;
    points.push(new THREE.Vector3(left, worldY, 0), new THREE.Vector3(right, worldY, 0));
  }

  return new THREE.BufferGeometry().setFromPoints(points);
}

function addVolumeGrid(grid, levelRoot) {
  const left = -grid.columns / 2;
  const right = grid.columns / 2;
  const bottom = -grid.rows / 2;
  const top = grid.rows / 2;
  const minZ = -grid.cellSize / 2;
  const maxZ = (grid.layers - 0.5) * grid.layerGap;
  const points = [];
  const material = new THREE.LineBasicMaterial({
    color: 0x7898aa,
    transparent: true,
    opacity: 0.32,
  });

  for (let x = 0; x <= grid.columns; x += 1) {
    const worldX = left + x;
    points.push(new THREE.Vector3(worldX, bottom, minZ), new THREE.Vector3(worldX, bottom, maxZ));
    points.push(new THREE.Vector3(worldX, top, minZ), new THREE.Vector3(worldX, top, maxZ));
  }
  for (let y = 0; y <= grid.rows; y += 1) {
    const worldY = bottom + y;
    points.push(new THREE.Vector3(left, worldY, minZ), new THREE.Vector3(left, worldY, maxZ));
    points.push(new THREE.Vector3(right, worldY, minZ), new THREE.Vector3(right, worldY, maxZ));
  }

  levelRoot.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points), material));
}

function addOuterFaceGrids(grid, levelRoot) {
  addOuterFaceSurfaces(grid, levelRoot, createFaceGridMaterial());
}

function addOuterFaceSurfaces(grid, levelRoot, material) {
  const faceOffset = 0.03;
  const zSize = grid.layers * grid.layerGap;
  const zCenter = (grid.layers - 1) * grid.layerGap / 2;
  const xy = new THREE.PlaneGeometry(grid.columns, grid.rows);
  const yz = new THREE.PlaneGeometry(grid.rows, zSize);
  const xz = new THREE.PlaneGeometry(grid.columns, zSize);
  addFaceSurface(levelRoot, xy, material, [0, 0, grid.layers - 0.5 + faceOffset], [0, 0, 0]);
  addFaceSurface(levelRoot, xy, material, [0, 0, -0.5 - faceOffset], [0, 0, 0]);
  addFaceSurface(levelRoot, yz, material, [grid.columns / 2 + faceOffset, 0, zCenter], [0, Math.PI / 2, 0]);
  addFaceSurface(levelRoot, yz, material, [-grid.columns / 2 - faceOffset, 0, zCenter], [0, Math.PI / 2, 0]);
  addFaceSurface(levelRoot, xz, material, [0, grid.rows / 2 + faceOffset, zCenter], [Math.PI / 2, 0, 0]);
  addFaceSurface(levelRoot, xz, material, [0, -grid.rows / 2 - faceOffset, zCenter], [Math.PI / 2, 0, 0]);
}

function addFaceSurface(levelRoot, geometry, material, position, rotation) {
  const surface = new THREE.Mesh(geometry, material);
  surface.position.fromArray(position);
  surface.rotation.set(...rotation);
  levelRoot.add(surface);
}

function createFaceGridMaterial() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 2048;
  const context = canvas.getContext('2d');
  context.fillStyle = '#6f95a7';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = 'rgba(192, 237, 246, 0.9)';
  context.lineWidth = 2;
  for (let index = 0; index <= 100; index += 1) {
    const position = Math.round((index / 100) * canvas.width) + 0.5;
    context.beginPath();
    context.moveTo(position, 0);
    context.lineTo(position, canvas.height);
    context.moveTo(0, position);
    context.lineTo(canvas.width, position);
    context.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}
