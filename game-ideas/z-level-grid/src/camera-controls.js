import * as THREE from 'three';

export function createCamera() {
  return new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
}

export function syncCamera(camera, target, distance) {
  camera.position.set(target.x, target.y, target.z + 500);
  camera.lookAt(target);
  syncOrtho(camera, distance);
}

export function syncOrtho(camera, distance) {
  const aspect = camera.aspect || 1;
  const halfHeight = distance / 2;
  camera.left = -halfHeight * aspect;
  camera.right = halfHeight * aspect;
  camera.top = halfHeight;
  camera.bottom = -halfHeight;
  camera.updateProjectionMatrix();
}

export function worldUnitsPerPixel(camera, canvas) {
  return (camera.top - camera.bottom) / canvas.clientHeight;
}
