import * as THREE from 'three';
import type { Block, Vec2 } from '../core/types';
import { createTimedShaderMaterial, noiseShaderChunk } from './shaders';

export function createBlockGeometry(block: Block): THREE.ShapeGeometry {
  const shape = new THREE.Shape(block.vertices.map((point) => new THREE.Vector2(point.x, point.y)));
  return new THREE.ShapeGeometry(shape, 8);
}

export function createMineralMaterial(seed: number, timedMaterials: THREE.ShaderMaterial[]): THREE.ShaderMaterial {
  const material = createTimedShaderMaterial(timedMaterials, {
    transparent: true,
    uniforms: {
      uSeed: { value: seed * 0.037 },
    },
    fragmentShader: `
      precision highp float;
      uniform float uTime;
      uniform float uSeed;
      varying vec2 vLocal;
      ${noiseShaderChunk()}
      void main() {
        vec2 p = vLocal * 0.09;
        float grain = fbm(p * 22.0 + uSeed);
        float coarse = fbm(p * 6.0 + uSeed * 1.7);
        float strata = sin(p.x * 13.0 + p.y * 4.0 + coarse * 4.0);
        float chips = smoothstep(0.66, 0.98, grain);
        float cracks = 1.0 - smoothstep(0.02, 0.075, abs(strata) * (0.65 + coarse));
        vec3 base = mix(vec3(0.22, 0.25, 0.26), vec3(0.48, 0.52, 0.51), coarse);
        vec3 mineral = base + chips * vec3(0.16, 0.17, 0.16);
        mineral -= cracks * vec3(0.18, 0.19, 0.18);
        mineral += smoothstep(0.12, 0.9, vLocal.y * 0.025 + 0.5) * vec3(0.08);
        gl_FragColor = vec4(mineral, 0.96);
      }
    `,
  });
  material.depthTest = false;
  return material;
}

export function pointInBlock(point: Vec2, block: Block): boolean {
  const local = {
    x: point.x - block.position.x,
    y: point.y - block.position.y,
  };
  if (Math.hypot(local.x, local.y) > block.radius + 1) {
    return false;
  }
  let inside = false;
  for (let index = 0, previous = block.vertices.length - 1; index < block.vertices.length; previous = index, index += 1) {
    const currentVertex = block.vertices[index];
    const previousVertex = block.vertices[previous];
    const crosses = (currentVertex.y > local.y) !== (previousVertex.y > local.y)
      && local.x < ((previousVertex.x - currentVertex.x) * (local.y - currentVertex.y)) / (previousVertex.y - currentVertex.y) + currentVertex.x;
    if (crosses) {
      inside = !inside;
    }
  }
  return inside;
}
