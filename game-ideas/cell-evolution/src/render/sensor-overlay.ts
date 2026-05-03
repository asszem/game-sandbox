import * as THREE from 'three';
import { sensingProfile } from '../core/sensing';
import type { SimulationState, Vec2 } from '../core/types';

export type SensorOverlayVisual = {
  field: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  rim: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  rays: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
};

export function createSensorOverlay(): SensorOverlayVisual {
  const field = new THREE.Mesh(
    new THREE.CircleGeometry(1, 96),
    new THREE.MeshBasicMaterial({ color: 0x00ffe1, transparent: true, opacity: 0.055, depthWrite: false }),
  );
  const rim = new THREE.Mesh(
    new THREE.RingGeometry(0.985, 1, 128),
    new THREE.MeshBasicMaterial({ color: 0xf9ff4d, transparent: true, opacity: 0.48, depthWrite: false }),
  );
  const rays = new THREE.LineSegments(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: 0xf9ff4d, transparent: true, opacity: 0.64, depthWrite: false }),
  );
  field.visible = false;
  rim.visible = false;
  rays.visible = false;
  return { field, rim, rays };
}

export function syncSensorOverlay(visual: SensorOverlayVisual, state: SimulationState, time: number): void {
  const selected = state.selectedCellId ? state.cells.find((cell) => cell.id === state.selectedCellId) : null;
  if (!selected) {
    visual.field.visible = false;
    visual.rim.visible = false;
    visual.rays.visible = false;
    return;
  }

  const sensing = sensingProfile(selected);
  const awareness = sensing.radius;
  const pulse = 1;
  visual.field.visible = true;
  visual.rim.visible = true;
  visual.rays.visible = true;
  visual.field.material.opacity = 0.025 + sensing.clarity * 0.055;
  visual.rim.material.opacity = 0.18 + sensing.clarity * 0.36;
  visual.field.position.set(selected.position.x, selected.position.y, 1.6);
  visual.rim.position.copy(visual.field.position);
  visual.field.scale.setScalar(awareness * pulse);
  visual.rim.scale.setScalar(awareness * pulse);

  const positions: number[] = [];
  const addRay = (target: Vec2, strength: number): void => {
    const dx = target.x - selected.position.x;
    const dy = target.y - selected.position.y;
    const d = Math.hypot(dx, dy);
    if (d > awareness || d <= 0.01) {
      return;
    }
    positions.push(
      selected.position.x,
      selected.position.y,
      5.8,
      selected.position.x + dx * strength * sensing.clarity,
      selected.position.y + dy * strength * sensing.clarity,
      5.8,
    );
  };

  for (const resource of state.resources) {
    addRay(resource.position, resource.kind === 'light' ? 0.72 : 0.92);
  }
  for (const hazard of state.hazards) {
    addRay(hazard.position, 1);
  }
  for (const cell of state.cells) {
    if (cell.id !== selected.id) {
      addRay(cell.position, 0.82);
    }
  }

  visual.rays.geometry.dispose();
  visual.rays.geometry = new THREE.BufferGeometry();
  visual.rays.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  visual.rays.material.opacity = (state.running ? 0.22 + Math.sin(time * 0.01) * 0.08 : 0.22) * sensing.clarity * sensing.processing;
}
