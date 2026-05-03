import * as THREE from 'three';
import type { Cell } from '../core/types';

export function cellColor(cell: Cell, lightness: number): THREE.Color {
  const hue = 0.43 + cell.genome.harvest * 0.14 - cell.genome.predator * 0.18 + cell.generation * 0.017;
  return new THREE.Color().setHSL(hue, 0.92, lightness);
}

export function createPlasmaMaterial(cell: Cell, seed: number): THREE.ShaderMaterial {
  const base = cellColor(cell, 0.7);
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uSeed: { value: seed * 0.013 },
      uBase: { value: base },
      uEnergy: { value: cell.energy / 100 },
      uStress: { value: 0 },
    },
    vertexShader: `
      varying vec2 vLocal;
      void main() {
        vLocal = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform float uTime;
      uniform float uSeed;
      uniform vec3 uBase;
      uniform float uEnergy;
      uniform float uStress;
      varying vec2 vLocal;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 4; i++) {
          v += a * noise(p);
          p = mat2(1.62, -1.08, 1.08, 1.62) * p + 11.7;
          a *= 0.52;
        }
        return v;
      }

      void main() {
        vec2 p = vLocal;
        vec2 velocityCurl = vec2(
          sin(p.y * 5.2 + uTime * 1.35 + uSeed),
          cos(p.x * 4.8 - uTime * 1.1 + uSeed)
        ) * 0.16;
        vec2 advected = p * 2.8 + velocityCurl + vec2(uTime * 0.42, -uTime * 0.28);
        float dye = fbm(advected + fbm(advected + uSeed));
        float stream = smoothstep(0.36, 0.78, dye);
        float depth = smoothstep(1.25, 0.04, length(p / vec2(1.05, 0.78)));
        vec3 plasma = mix(uBase * 0.55, vec3(0.58, 1.0, 0.86), stream);
        plasma = mix(plasma, vec3(0.95, 0.55, 1.0), uStress * (0.28 + stream * 0.2));
        plasma += vec3(0.05, 0.16, 0.12) * sin((p.x - p.y) * 12.0 + uTime * 2.0 + uSeed);
        float alpha = (0.52 + stream * 0.28 + uEnergy * 0.08) * depth;
        gl_FragColor = vec4(plasma, alpha);
      }
    `,
  });
}

export function createMembraneMaterial(color: number, seed: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uSeed: { value: seed * 0.019 },
      uColor: { value: new THREE.Color(color) },
      uHealth: { value: 1 },
    },
    vertexShader: `
      varying vec2 vLocal;
      void main() {
        vLocal = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform float uTime;
      uniform float uSeed;
      uniform vec3 uColor;
      uniform float uHealth;
      varying vec2 vLocal;

      void main() {
        vec2 p = vLocal / vec2(1.06, 0.8);
        float r = length(p);
        float membrane = smoothstep(0.62, 1.02, r);
        float ripple = sin(atan(p.y, p.x) * 18.0 + uTime * 2.0 + uSeed) * 0.08;
        float proteins = smoothstep(0.72, 0.98, r + ripple) * smoothstep(1.18, 0.82, r);
        vec3 proteinColor = mix(vec3(0.65, 1.0, 0.88), uColor, 0.55 + uHealth * 0.35);
        float alpha = (0.18 + proteins * 0.42 + membrane * 0.16) * smoothstep(1.22, 0.72, r);
        gl_FragColor = vec4(proteinColor, alpha);
      }
    `,
  });
}

export function createNucleusMaterial(seed: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uSeed: { value: seed * 0.021 },
      uStress: { value: 0 },
    },
    vertexShader: `
      varying vec2 vLocal;
      void main() {
        vLocal = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform float uTime;
      uniform float uSeed;
      uniform float uStress;
      varying vec2 vLocal;

      float strand(vec2 p, float offset) {
        float wave = sin(p.x * 12.0 + uTime * 0.7 + offset) * 0.08;
        return smoothstep(0.035, 0.0, abs(p.y + wave));
      }

      void main() {
        vec2 p = vLocal;
        float r = length(p);
        float shell = smoothstep(1.02, 0.74, r);
        float chromatin = strand(p * mat2(0.86, -0.5, 0.5, 0.86), uSeed)
          + strand(p * mat2(0.38, 0.92, -0.92, 0.38), uSeed + 2.1);
        float nucleolus = smoothstep(0.22, 0.02, length(p - vec2(0.26, 0.16)));
        vec3 color = mix(vec3(0.64, 0.18, 0.9), vec3(0.98, 0.38, 1.0), chromatin * 0.42 + nucleolus * 0.55);
        color = mix(color, vec3(0.75, 1.0, 0.62), uStress * 0.28);
        gl_FragColor = vec4(color, shell * (0.66 + chromatin * 0.18 + nucleolus * 0.2));
      }
    `,
  });
}
