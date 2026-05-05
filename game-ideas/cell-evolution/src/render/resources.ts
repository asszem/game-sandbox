import * as THREE from 'three';
import type { Resource, ResourceKind } from '../core/types';
import { createTimedShaderMaterial, noiseShaderChunk } from './shaders';

export const RESOURCE_COLORS: Record<ResourceKind, number> = {
  glucose: 0x18ff9b,
  'amino-acid': 0xffe62e,
  oxygen: 0x36d7ff,
  light: 0xf7ff5a,
};

const LIGHT_RESOURCE_RENDER_ORDER = 1000;

export function createResourceVisual(resource: Resource, timedMaterials: THREE.ShaderMaterial[]): THREE.Group {
  const group = new THREE.Group();
  group.userData.kind = resource.kind;
  const color = RESOURCE_COLORS[resource.kind];
  const material = createResourceMaterial(color, resource.kind, resource.id, timedMaterials);

  if (resource.kind === 'glucose') {
    const backbone = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.48, 6), material);
    backbone.rotation.z = Math.PI / 6;
    group.add(backbone);
    for (let index = 0; index < 6; index += 1) {
      const angle = (index / 6) * Math.PI * 2;
      const mesh = new THREE.Mesh(new THREE.CircleGeometry(0.13 + (index % 2) * 0.03, 16), material);
      mesh.position.set(Math.cos(angle) * 0.56, Math.sin(angle) * 0.56, index * 0.002);
      mesh.rotation.z = angle;
      group.add(mesh);
    }
  } else if (resource.kind === 'amino-acid') {
    const spine = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.58, 5, 16), material);
    spine.rotation.z = 1.1;
    group.add(spine);
    for (let index = 0; index < 4; index += 1) {
      const angle = index * Math.PI * 0.5 + 0.4;
      const mesh = new THREE.Mesh(new THREE.CircleGeometry(0.13, 16), material);
      mesh.position.set(Math.cos(angle) * 0.42, Math.sin(angle) * 0.34, index * 0.002);
      group.add(mesh);
    }
  } else if (resource.kind === 'oxygen') {
    const left = new THREE.Mesh(new THREE.CircleGeometry(0.34, 24), material);
    const right = new THREE.Mesh(new THREE.CircleGeometry(0.34, 24), material);
    left.position.x = -0.22;
    right.position.x = 0.22;
    const bridge = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.28, 4, 8), material);
    bridge.rotation.z = Math.PI * 0.5;
    group.add(left, right, bridge);
  } else {
    const glow = new THREE.Mesh(new THREE.CircleGeometry(1, 56), material);
    const core = new THREE.Mesh(new THREE.CircleGeometry(0.46, 40), material);
    core.scale.setScalar(0.58);
    group.add(glow, core);
  }

  if (resource.kind === 'light') {
    group.renderOrder = LIGHT_RESOURCE_RENDER_ORDER;
    group.traverse((child) => {
      child.renderOrder = LIGHT_RESOURCE_RENDER_ORDER;
    });
  }

  return group;
}

function createResourceMaterial(
  color: number,
  kind: Resource['kind'],
  seed: number,
  timedMaterials: THREE.ShaderMaterial[],
): THREE.ShaderMaterial {
  const material = createTimedShaderMaterial(timedMaterials, {
    transparent: true,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uSeed: { value: seed * 0.031 },
      uKind: { value: kind === 'light' ? 1 : 0 },
    },
    fragmentShader: `
      precision highp float;
      uniform float uTime;
      uniform float uSeed;
      uniform vec3 uColor;
      uniform float uKind;
      varying vec2 vLocal;
      ${noiseShaderChunk()}
      void main() {
        vec2 p = vLocal;
        float r = length(p);
        float texture = fbm(p * 8.0 + vec2(uTime * 0.18, -uTime * 0.12) + uSeed);
        float shell = smoothstep(1.08, 0.05, r);
        float glint = smoothstep(0.12, 0.0, length(p - vec2(-0.16, 0.18)));
        vec3 color = mix(uColor * 0.48, uColor, 0.42 + texture * 0.58);
        color += vec3(0.9, 1.0, 0.92) * glint * 0.45;
        if (uKind > 0.5) {
          color = mix(color, vec3(1.0, 0.96, 0.54), 0.42 + sin(uTime * 0.7 + uSeed) * 0.12);
          shell *= 0.62 + texture * 0.3;
        }
        gl_FragColor = vec4(color, shell * (0.58 + texture * 0.32));
      }
    `,
  });
  if (kind === 'light') {
    material.depthTest = false;
  }
  return material;
}
