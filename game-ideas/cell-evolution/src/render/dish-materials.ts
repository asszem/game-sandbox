import * as THREE from 'three';
import { createTimedShaderMaterial, noiseShaderChunk } from './shaders';

export function createDishBaseMaterial(timedMaterials: THREE.ShaderMaterial[]): THREE.ShaderMaterial {
  return createTimedShaderMaterial(timedMaterials, {
    transparent: false,
    uniforms: {},
    fragmentShader: `
      precision highp float;
      varying vec2 vLocal;
      ${noiseShaderChunk()}
      void main() {
        vec2 p = vLocal / 96.0;
        float r = length(p);
        float grain = fbm(p * 18.0);
        float vignette = smoothstep(1.08, 0.2, r);
        vec3 color = mix(vec3(0.015, 0.055, 0.064), vec3(0.05, 0.16, 0.16), grain * 0.5 + vignette * 0.45);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
}

export function createAgarMaterial(timedMaterials: THREE.ShaderMaterial[]): THREE.ShaderMaterial {
  return createTimedShaderMaterial(timedMaterials, {
    transparent: true,
    uniforms: {},
    fragmentShader: `
      precision highp float;
      uniform float uTime;
      varying vec2 vLocal;
      ${noiseShaderChunk()}
      void main() {
        vec2 p = vLocal / 91.5;
        float r = length(p);
        vec2 drift = p * 8.0 + vec2(uTime * 0.025, -uTime * 0.018);
        float culture = fbm(drift + fbm(drift * 0.72));
        float meniscus = smoothstep(1.02, 0.82, r) * smoothstep(0.22, 1.0, r);
        float depth = smoothstep(1.02, 0.02, r);
        vec3 color = mix(vec3(0.06, 0.24, 0.27), vec3(0.18, 0.45, 0.42), culture * 0.5 + meniscus * 0.36);
        color += vec3(0.03, 0.08, 0.07) * sin((p.x + p.y) * 34.0 + uTime * 0.28);
        gl_FragColor = vec4(color, 0.9 * depth);
      }
    `,
  });
}

export function createDishRimMaterial(timedMaterials: THREE.ShaderMaterial[]): THREE.ShaderMaterial {
  return createTimedShaderMaterial(timedMaterials, {
    transparent: true,
    uniforms: {},
    fragmentShader: `
      precision highp float;
      uniform float uTime;
      varying vec2 vLocal;
      ${noiseShaderChunk()}
      void main() {
        vec2 p = vLocal / 96.0;
        float r = length(p);
        float ring = smoothstep(0.94, 0.98, r) * smoothstep(1.03, 0.99, r);
        float scratch = fbm(vec2(atan(p.y, p.x) * 18.0, r * 40.0 + uTime * 0.04));
        vec3 color = mix(vec3(0.25, 0.62, 0.58), vec3(0.74, 1.0, 0.9), scratch * 0.42);
        gl_FragColor = vec4(color, ring * (0.42 + scratch * 0.16));
      }
    `,
  });
}
