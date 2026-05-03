import * as THREE from 'three';
import type { SimulationEvent, Vec2 } from '../core/types';
import { createCellBodyGeometry } from './cell-geometry';
import { RESOURCE_COLORS } from './resources';

export type EffectVisual = {
  group: THREE.Group;
  bornAt: number;
  duration: number;
};

export function spawnEffectVisuals(events: SimulationEvent[], time: number, effectLayer: THREE.Group): EffectVisual[] {
  const effects: EffectVisual[] = [];
  for (const event of events) {
    if (event.kind === 'resource-consumed') {
      effects.push(createConsumeEffect(event.position, event.radius, RESOURCE_COLORS[event.resourceKind], time, effectLayer));
    }
    if (event.kind === 'cell-devoured' || event.kind === 'cell-died') {
      effects.push(createDissolveEffect(event.position, event.radius, time, effectLayer));
    }
  }
  return effects;
}

export function syncEffectVisuals(effects: EffectVisual[], time: number, effectLayer: THREE.Group): EffectVisual[] {
  return effects.filter((effect) => {
    const progress = (time - effect.bornAt) / effect.duration;
    if (progress >= 1) {
      effectLayer.remove(effect.group);
      return false;
    }
    const opacity = 1 - progress;
    effect.group.scale.setScalar(1 + progress * 1.6);
    for (const child of effect.group.children) {
      const mesh = child as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
      if (mesh.material) {
        mesh.material.opacity = Math.max(0, opacity * (child.userData.baseOpacity ?? 1));
      }
      if (child.userData.driftX) {
        child.position.x += child.userData.driftX * 0.025;
        child.position.y += child.userData.driftY * 0.025;
      }
    }
    return true;
  });
}

function createConsumeEffect(position: Vec2, radius: number, color: number, time: number, effectLayer: THREE.Group): EffectVisual {
  const group = new THREE.Group();
  group.position.set(position.x, position.y, 7);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.6, 0.8, 36),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false }),
  );
  ring.userData.baseOpacity = 0.8;
  ring.scale.setScalar(Math.max(1.2, radius));
  group.add(ring);
  effectLayer.add(group);
  return { group, bornAt: time, duration: 520 };
}

function createDissolveEffect(position: Vec2, radius: number, time: number, effectLayer: THREE.Group): EffectVisual {
  const group = new THREE.Group();
  group.position.set(position.x, position.y, 7);
  const cloud = new THREE.Mesh(
    createCellBodyGeometry(Math.floor(time), Math.max(0.8, radius * 0.34), 0.22),
    new THREE.MeshBasicMaterial({ color: 0xdfeee5, transparent: true, opacity: 0.52, depthWrite: false }),
  );
  cloud.userData.baseOpacity = 0.52;
  group.add(cloud);
  for (let index = 0; index < 10; index += 1) {
    const angle = (index / 10) * Math.PI * 2;
    const particle = new THREE.Mesh(
      new THREE.CircleGeometry(0.18 + (index % 3) * 0.06, 12),
      new THREE.MeshBasicMaterial({ color: 0xd2ad91, transparent: true, opacity: 0.66, depthWrite: false }),
    );
    particle.position.set(Math.cos(angle) * radius * 0.25, Math.sin(angle) * radius * 0.2, index * 0.01);
    particle.userData.driftX = Math.cos(angle) * (0.25 + (index % 4) * 0.06);
    particle.userData.driftY = Math.sin(angle) * (0.25 + (index % 5) * 0.04);
    particle.userData.baseOpacity = 0.66;
    group.add(particle);
  }
  effectLayer.add(group);
  return { group, bornAt: time, duration: 1100 };
}
