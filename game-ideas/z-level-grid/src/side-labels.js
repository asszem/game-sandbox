import * as THREE from 'three';

export const sideRotations = {
  Digit1: { x: 0, y: 0, z: 0 },
  Digit2: { x: Math.PI, y: 0, z: 0 },
  Digit3: { x: 0, y: -Math.PI / 2, z: 0 },
  Digit4: { x: 0, y: Math.PI / 2, z: 0 },
  Digit5: { x: Math.PI / 2, y: 0, z: 0 },
  Digit6: { x: -Math.PI / 2, y: 0, z: 0 },
};

export function createSideLabels(grid) {
  const group = new THREE.Group();
  const halfX = grid.columns / 2 + 0.2;
  const halfY = grid.rows / 2 + 0.2;
  const minZ = -grid.cellSize / 2;
  const maxZ = (grid.layers - 0.5) * grid.layerGap;
  const midZ = ((grid.layers - 1) * grid.layerGap) / 2;
  const placements = [
    ['1', [0, 0, maxZ + 0.2], [0, 0, 0]],
    ['2', [0, 0, minZ - 0.2], [Math.PI, 0, 0]],
    ['3', [halfX, 0, midZ], [0, Math.PI / 2, 0]],
    ['4', [-halfX, 0, midZ], [0, -Math.PI / 2, 0]],
    ['5', [0, halfY, midZ], [-Math.PI / 2, 0, 0]],
    ['6', [0, -halfY, midZ], [Math.PI / 2, 0, 0]],
  ];

  const geometry = new THREE.PlaneGeometry(1, 1);
  for (const [text, position, rotation] of placements) {
    const label = new THREE.Mesh(geometry, createLabelMaterial(text));
    label.position.fromArray(position);
    label.rotation.set(...rotation);
    label.scale.set(32, 32, 1);
    label.userData.side = Number(text);
    label.renderOrder = 20;
    group.add(label);
  }

  group.visible = false;
  return group;
}

export function createSideLabelController(group) {
  let timer;
  const show = (side) => {
    group.visible = side !== null;
    group.children.forEach((label) => {
      label.visible = side === 'all' || label.userData.side === side;
    });
  };
  return {
    hide() {
      clearTimeout(timer);
      show(null);
    },
    showAll() {
      clearTimeout(timer);
      show('all');
    },
    showOneFor(side) {
      clearTimeout(timer);
      show(side);
      timer = setTimeout(() => show(null), 2200);
    },
  };
}

function createLabelMaterial(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = 'rgba(10, 16, 24, 0.78)';
  context.beginPath();
  context.roundRect(16, 16, 224, 224, 22);
  context.fill();
  context.strokeStyle = 'rgba(217, 244, 255, 0.95)';
  context.lineWidth = 10;
  context.stroke();
  context.fillStyle = '#f7c948';
  context.font = 'bold 172px system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, 128, 136);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.DoubleSide,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
}
