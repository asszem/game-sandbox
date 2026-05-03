import * as THREE from 'three';
import type { Cell } from '../core/types';
import { createCellBodyGeometry, createCiliaGeometry } from './cell-geometry';
import { createMembraneMaterial, createNucleusMaterial, createPlasmaMaterial } from './cell-materials';
import { createOrganelles } from './cell-organelles';

export type CellVisual = {
  group: THREE.Group;
  membrane: THREE.Mesh<THREE.ShapeGeometry, THREE.ShaderMaterial>;
  cytoplasm: THREE.Mesh<THREE.ShapeGeometry, THREE.ShaderMaterial>;
  nucleus: THREE.Mesh<THREE.CircleGeometry, THREE.ShaderMaterial>;
  organelles: THREE.Object3D[];
  cilia: THREE.LineSegments;
  aura: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  signal: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  seed: number;
};

export function createCellVisual(cell: Cell): CellVisual {
  const group = new THREE.Group();
  const bodySeed = cell.id * 917 + cell.generation * 53;
  const membrane = new THREE.Mesh(
    createCellBodyGeometry(bodySeed, 1.04, 0.16),
    createMembraneMaterial(0xd5fff0, bodySeed),
  );
  const cytoplasm = new THREE.Mesh(
    createCellBodyGeometry(bodySeed + 29, 0.88, 0.1),
    createPlasmaMaterial(cell, bodySeed + 29),
  );
  cytoplasm.rotation.z = 0.08;
  const nucleus = new THREE.Mesh(
    new THREE.CircleGeometry(1, 48),
    createNucleusMaterial(bodySeed + 71),
  );
  nucleus.position.set(-0.06, 0.08, 0.18);
  nucleus.scale.set(0.18, 0.24, 1);

  const organelles = createOrganelles(cell, bodySeed);

  const cilia = new THREE.LineSegments(
    createCiliaGeometry(bodySeed, 0, 0),
    new THREE.LineBasicMaterial({ color: 0xf9fff4, transparent: true, opacity: 0.66, depthWrite: false }),
  );
  cilia.position.z = 0.28;

  const aura = new THREE.Mesh(
    new THREE.RingGeometry(0.98, 1.12, 96),
    new THREE.MeshBasicMaterial({ color: 0x18ffc8, transparent: true, opacity: 0.14, depthWrite: false }),
  );
  aura.visible = false;
  aura.position.z = -0.03;

  const signal = new THREE.Mesh(
    new THREE.RingGeometry(0.82, 0.86, 80),
    new THREE.MeshBasicMaterial({ color: 0x00ffe1, transparent: true, opacity: 0, depthWrite: false }),
  );
  signal.position.z = -0.02;

  group.add(aura, signal, cilia, membrane, cytoplasm, nucleus, ...organelles);
  return { group, membrane, cytoplasm, nucleus, organelles, cilia, aura, signal, seed: bodySeed };
}
