import * as THREE from 'three';
import type { Cell } from '../core/types';
import { seededNoise } from './cell-geometry';

export function createOrganelles(cell: Cell, seed: number): THREE.Object3D[] {
  const organelles: THREE.Object3D[] = [];
  for (let index = 0; index < 5; index += 1) {
    const group = new THREE.Group();
    const x = -0.56 + index * 0.28 + seededNoise(seed, index + 120) * 0.08;
    const y = seededNoise(seed, index + 150) * 0.26;
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.045 + (index % 2) * 0.012, 0.1 + (index % 3) * 0.025, 4, 10),
      new THREE.MeshBasicMaterial({ color: index % 2 ? 0x8dffe0 : 0xf2fff2, transparent: true, opacity: 0.52, depthWrite: false }),
    );
    body.scale.set(1.25, 0.56, 1);
    body.rotation.z = seededNoise(seed, index + 180) * Math.PI;
    const fold = new THREE.Line(
      new THREE.BufferGeometry().setAttribute(
        'position',
        new THREE.Float32BufferAttribute([-0.04, 0, 0.01, -0.012, 0.018, 0.01, 0.02, -0.016, 0.01, 0.045, 0.012, 0.01], 3),
      ),
      new THREE.LineBasicMaterial({ color: 0x063c42, transparent: true, opacity: 0.36, depthWrite: false }),
    );
    group.add(body, fold);
    group.position.set(x, y, 0.23 + index * 0.003);
    organelles.push(group);
  }

  for (let index = 0; index < 4; index += 1) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.42 + index * 0.18, -0.22 + seededNoise(seed, index + 210) * 0.08, 0.235),
      new THREE.Vector3(-0.24 + index * 0.16, -0.06 + seededNoise(seed, index + 220) * 0.08, 0.235),
      new THREE.Vector3(-0.04 + index * 0.12, 0.06 + seededNoise(seed, index + 230) * 0.08, 0.235),
    ]);
    const tube = new THREE.TubeGeometry(curve, 12, 0.01, 5, false);
    const strand = new THREE.Mesh(
      tube,
      new THREE.MeshBasicMaterial({ color: cell.genome.harvest > 0.55 ? 0x65ffbd : 0xdbfff3, transparent: true, opacity: 0.3, depthWrite: false }),
    );
    organelles.push(strand);
  }

  return organelles;
}
