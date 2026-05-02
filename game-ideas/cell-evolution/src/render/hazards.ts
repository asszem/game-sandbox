import * as THREE from 'three';
import { createTimedShaderMaterial, noiseShaderChunk } from './shaders';

export function createPoisonMaterial(seed: number, timedMaterials: THREE.ShaderMaterial[]): THREE.ShaderMaterial {
  return createTimedShaderMaterial(timedMaterials, {
    transparent: true,
    uniforms: {
      uSeed: { value: seed * 0.047 },
    },
    fragmentShader: `
      precision highp float;
      uniform float uTime;
      uniform float uSeed;
      varying vec2 vLocal;
      ${noiseShaderChunk()}
      void main() {
        vec2 p = vLocal;
        float r = length(p);
        vec2 swirl = p * 4.4 + vec2(sin(uTime + p.y * 3.0), cos(uTime * 0.8 + p.x * 3.0)) * 0.35 + uSeed;
        float smoke = fbm(swirl);
        float rim = smoothstep(1.05, 0.28, r) * smoothstep(0.08, 0.9, smoke);
        vec3 color = mix(vec3(0.34, 0.05, 0.44), vec3(1.0, 0.2, 0.55), smoke);
        color = mix(color, vec3(0.28, 1.0, 0.68), smoothstep(0.72, 0.95, smoke) * 0.18);
        gl_FragColor = vec4(color, rim * 0.58);
      }
    `,
  });
}
