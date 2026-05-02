import * as THREE from 'three';

export function createTimedShaderMaterial(
  timedMaterials: THREE.ShaderMaterial[],
  options: {
    transparent: boolean;
    uniforms: Record<string, THREE.IUniform>;
    fragmentShader: string;
    opacity?: number;
  },
): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    transparent: options.transparent,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      ...options.uniforms,
    },
    vertexShader: `
      varying vec2 vLocal;
      void main() {
        vLocal = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: options.fragmentShader,
  });
  material.opacity = options.opacity ?? 1;
  timedMaterials.push(material);
  return material;
}

export function updateTimedMaterials(timedMaterials: THREE.ShaderMaterial[], time: number): void {
  for (const material of timedMaterials) {
    if (material.uniforms.uTime) {
      material.uniforms.uTime.value = time * 0.001;
    }
  }
}

export function noiseShaderChunk(): string {
  return `
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
  `;
}
