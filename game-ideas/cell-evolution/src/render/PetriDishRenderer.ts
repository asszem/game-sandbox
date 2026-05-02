import * as THREE from 'three';
import type { Block, Cell, Hazard, Resource, SimulationEvent, SimulationState, Vec2 } from '../core/types';

type CellVisual = {
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

type EffectVisual = {
  group: THREE.Group;
  bornAt: number;
  duration: number;
};

export type MapPick =
  | { kind: 'cell'; id: number }
  | { kind: 'resource'; id: number }
  | { kind: 'hazard'; id: number }
  | { kind: 'block'; id: number }
  | { kind: 'dish'; id: null };

export type PickResult = {
  target: MapPick;
  dragged: boolean;
};

const RESOURCE_COLORS = {
  glucose: 0xff5d7a,
  'amino-acid': 0x65ffbd,
  oxygen: 0x36d7ff,
  light: 0xf7ff5a,
};

const LIGHT_RESOURCE_RENDER_ORDER = 1000;
const LIGHT_RESOURCE_Z = 10;

export class PetriDishRenderer {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private backgroundScene = new THREE.Scene();
  private backgroundCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
  private camera: THREE.OrthographicCamera;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private dishPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  private board = new THREE.Group();
  private cellLayer = new THREE.Group();
  private resourceLayer = new THREE.Group();
  private hazardLayer = new THREE.Group();
  private blockLayer = new THREE.Group();
  private sensorLayer = new THREE.Group();
  private cellVisuals = new Map<number, CellVisual>();
  private resourceVisuals = new Map<number, THREE.Group>();
  private hazardVisuals = new Map<number, THREE.Mesh>();
  private blockVisuals = new Map<number, THREE.Mesh>();
  private effectLayer = new THREE.Group();
  private effects: EffectVisual[] = [];
  private selectedRing: THREE.Mesh;
  private sensorField: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  private sensorRim: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private sensorRays: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  private timedMaterials: THREE.ShaderMaterial[] = [];
  private frustumHeight = 203;
  private zoom = 1;
  private readonly defaultCameraX = -48;
  private readonly defaultCameraY = 0;
  private dragStart: { x: number; y: number; cameraX: number; cameraY: number } | null = null;
  private pointerDown = { x: 0, y: 0 };
  private clickMoved = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x06080f, 1);

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -200, 200);
    this.camera.position.set(this.defaultCameraX, this.defaultCameraY, 100);
    this.camera.lookAt(this.camera.position.x, this.camera.position.y, 0);

    this.selectedRing = new THREE.Mesh(
      new THREE.RingGeometry(1, 1.14, 96),
      new THREE.MeshBasicMaterial({ color: 0xf3f8d4, transparent: true, opacity: 0.9 }),
    );
    this.selectedRing.visible = false;
    this.sensorField = new THREE.Mesh(
      new THREE.CircleGeometry(1, 96),
      new THREE.MeshBasicMaterial({ color: 0x00ffe1, transparent: true, opacity: 0.055, depthWrite: false }),
    );
    this.sensorRim = new THREE.Mesh(
      new THREE.RingGeometry(0.985, 1, 128),
      new THREE.MeshBasicMaterial({ color: 0xf9ff4d, transparent: true, opacity: 0.48, depthWrite: false }),
    );
    this.sensorRays = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0xf9ff4d, transparent: true, opacity: 0.64, depthWrite: false }),
    );
    this.sensorField.visible = false;
    this.sensorRim.visible = false;
    this.sensorRays.visible = false;
    this.sensorLayer.add(this.sensorField, this.sensorRim, this.sensorRays);

    this.buildScene();
    this.bindEvents();
    this.resize();
  }

  dispose(): void {
    window.removeEventListener('resize', this.resize);
    this.renderer.dispose();
  }

  render(state: SimulationState, time: number, events: SimulationEvent[] = []): void {
    this.updateTimedMaterials(time);
    this.spawnEffects(events, time);
    this.syncResources(state.resources, time);
    this.syncHazards(state.hazards, time);
    this.syncBlocks(state);
    this.syncCells(state.cells, state.selectedCellId, time, state.running);
    this.syncSensorOverlay(state, time);
    this.syncEffects(time);
    this.renderer.autoClear = true;
    this.renderer.render(this.backgroundScene, this.backgroundCamera);
    this.renderer.clearDepth();
    this.renderer.autoClear = false;
    this.renderer.render(this.scene, this.camera);
    this.renderer.autoClear = true;
  }

  onPointerPick(event: PointerEvent, state: SimulationState): PickResult {
    const dragged = this.clickMoved;
    return { target: this.pickAtScreenPosition(event.clientX, event.clientY, state), dragged };
  }

  pickAtScreenPosition(clientX: number, clientY: number, state: SimulationState): MapPick {
    const point = this.screenToWorld(clientX, clientY);
    return this.pickAtPoint(point, state);
  }

  centerOnCell(cell: Cell): void {
    this.camera.position.x = cell.position.x;
    this.camera.position.y = cell.position.y;
  }

  resetZoom(): void {
    this.zoom = 1;
    this.camera.position.x = this.defaultCameraX;
    this.camera.position.y = this.defaultCameraY;
    this.resize();
  }

  getZoomPercent(): number {
    return Math.round(this.zoom * 100);
  }

  private buildScene(): void {
    const ambient = new THREE.AmbientLight(0xc7ffe6, 1.15);
    const key = new THREE.DirectionalLight(0xb7fff0, 1.8);
    key.position.set(-20, 28, 48);

    const backPlate = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.MeshBasicMaterial({ map: this.createMicroscopeBackdropTexture(), color: 0x9fc9c5, depthWrite: false, depthTest: false }),
    );
    backPlate.position.set(0, 0, 0);
    this.backgroundScene.add(backPlate);

    const dish = new THREE.Mesh(
      new THREE.CircleGeometry(96, 160),
      this.createDishBaseMaterial(),
    );
    const agar = new THREE.Mesh(
      new THREE.CircleGeometry(91.5, 160),
      this.createAgarMaterial(),
    );
    const rim = new THREE.Mesh(
      new THREE.RingGeometry(91.8, 96.8, 160),
      this.createDishRimMaterial(),
    );
    const grid = this.createDishTexture();
    const dishVeins = new THREE.Mesh(
      new THREE.CircleGeometry(91.2, 160),
      new THREE.MeshBasicMaterial({ map: grid, transparent: true, opacity: 0.18, depthWrite: false }),
    );
    dishVeins.position.z = 0.02;

    this.board.add(dish, agar, dishVeins, this.resourceLayer, this.hazardLayer, this.blockLayer, this.effectLayer, this.sensorLayer, this.cellLayer, rim, this.selectedRing);
    this.scene.add(ambient, key, this.board);
  }

  private createDishTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return new THREE.CanvasTexture(canvas);
    }
    ctx.fillStyle = '#153d43';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < 160; i += 1) {
      const hue = 145 + Math.random() * 115;
      ctx.strokeStyle = `hsla(${hue}, 95%, 63%, ${0.035 + Math.random() * 0.07})`;
      ctx.lineWidth = 1 + Math.random() * 2;
      ctx.beginPath();
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      ctx.ellipse(x, y, 20 + Math.random() * 95, 2 + Math.random() * 8, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.stroke();
    }
    return new THREE.CanvasTexture(canvas);
  }

  private createTimedShaderMaterial(options: {
    transparent: boolean;
    uniforms: Record<string, THREE.IUniform>;
    fragmentShader: string;
    opacity?: number;
  }): THREE.ShaderMaterial {
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
    this.timedMaterials.push(material);
    return material;
  }

  private updateTimedMaterials(time: number): void {
    for (const material of this.timedMaterials) {
      if (material.uniforms.uTime) {
        material.uniforms.uTime.value = time * 0.001;
      }
    }
  }

  private noiseShaderChunk(): string {
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

  private createMicroscopeBackdropTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 640;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return new THREE.CanvasTexture(canvas);
    }
    const gradient = ctx.createRadialGradient(512, 320, 40, 512, 320, 560);
    gradient.addColorStop(0, '#274d4f');
    gradient.addColorStop(0.58, '#142c31');
    gradient.addColorStop(1, '#071217');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < 90; index += 1) {
      ctx.strokeStyle = `rgba(184, 238, 220, ${0.018 + Math.random() * 0.035})`;
      ctx.lineWidth = 1 + Math.random() * 2.2;
      ctx.beginPath();
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      ctx.ellipse(x, y, 80 + Math.random() * 260, 8 + Math.random() * 26, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let index = 0; index < 3500; index += 1) {
      const value = 80 + Math.random() * 90;
      ctx.fillStyle = `rgba(${value}, ${value + 22}, ${value + 16}, ${Math.random() * 0.04})`;
      ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 1, 1);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  private createDishBaseMaterial(): THREE.ShaderMaterial {
    return this.createTimedShaderMaterial({
      transparent: false,
      uniforms: {},
      fragmentShader: `
        precision highp float;
        varying vec2 vLocal;
        ${this.noiseShaderChunk()}
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

  private createAgarMaterial(): THREE.ShaderMaterial {
    return this.createTimedShaderMaterial({
      transparent: true,
      uniforms: {},
      fragmentShader: `
        precision highp float;
        uniform float uTime;
        varying vec2 vLocal;
        ${this.noiseShaderChunk()}
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

  private createDishRimMaterial(): THREE.ShaderMaterial {
    return this.createTimedShaderMaterial({
      transparent: true,
      uniforms: {},
      fragmentShader: `
        precision highp float;
        uniform float uTime;
        varying vec2 vLocal;
        ${this.noiseShaderChunk()}
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

  private syncCells(cells: Cell[], selectedCellId: number | null, time: number, running: boolean): void {
    const active = new Set<number>();
    for (const cell of cells) {
      active.add(cell.id);
      let visual = this.cellVisuals.get(cell.id);
      if (!visual) {
        visual = this.createCellVisual(cell);
        this.cellVisuals.set(cell.id, visual);
        this.cellLayer.add(visual.group);
      }

      const pulse = 1;
      const heading = Math.abs(cell.velocity.x) + Math.abs(cell.velocity.y) > 0.02
        ? Math.atan2(cell.velocity.y, cell.velocity.x)
        : visual.group.rotation.z;
      const stressed = cell.ros > 52 || (cell.oxygen > 70 && cell.aminoAcids < 25);
      const balanced = cell.atp > 35 && cell.atp < 105 && cell.aminoAcids > 25 && cell.oxygen > 18 && cell.oxygen < 75 && cell.ros < 35;
      const jitter = stressed && running ? Math.sin(time * 0.08 + cell.id) * 0.18 : 0;
      visual.group.position.set(cell.position.x + jitter, cell.position.y - jitter * 0.55, 2 + cell.id * 0.0001);
      visual.group.scale.set(cell.radius * cell.bodyLength * pulse, cell.radius * pulse, 1);
      visual.group.userData.radius = cell.radius;
      visual.group.userData.bodyLength = cell.bodyLength;
      if (running) {
        visual.group.rotation.z = THREE.MathUtils.lerp(visual.group.rotation.z, heading, 0.06);
      }
      const membraneColor = stressed ? new THREE.Color(0xb6ff6a) : cell.id === selectedCellId ? new THREE.Color(0xfff65a) : new THREE.Color(0xd5fff0);
      visual.membrane.material.uniforms.uColor.value.copy(membraneColor);
      visual.membrane.material.uniforms.uTime.value = time * 0.001;
      visual.membrane.material.uniforms.uHealth.value = cell.health;
      visual.membrane.material.opacity = 0.34 + cell.health * 0.32;
      visual.cytoplasm.material.uniforms.uTime.value = time * 0.001;
      visual.cytoplasm.material.uniforms.uStress.value = stressed ? 1 : 0;
      visual.cytoplasm.material.uniforms.uEnergy.value = cell.energy / 100;
      visual.cytoplasm.material.opacity = stressed ? 0.58 : 0.72 + cell.energy / 520;
      visual.aura.visible = balanced;
      visual.aura.material.opacity = running ? 0.16 + Math.sin(time * 0.004 + cell.id) * 0.06 : 0.16;
      visual.nucleus.material.uniforms.uTime.value = time * 0.001;
      visual.nucleus.material.uniforms.uStress.value = stressed ? 1 : 0;
      visual.nucleus.scale.setScalar(0.22 + cell.genome.split * 0.1);
      visual.signal.visible = false;
      this.updateCiliaGeometry(visual, cell, time, running);

      for (let index = 0; index < visual.organelles.length; index += 1) {
        const organelle = visual.organelles[index];
        if (running) {
          const orbit = time * 0.0006 * (index + 1) + cell.id;
          organelle.position.x += Math.sin(orbit) * 0.0012;
          organelle.position.y += Math.cos(orbit) * 0.0012;
          organelle.rotation.z += Math.sin(orbit) * 0.0008;
        }
      }
    }

    for (const [id, visual] of this.cellVisuals.entries()) {
      if (!active.has(id)) {
        this.cellLayer.remove(visual.group);
        this.cellVisuals.delete(id);
      }
    }

    this.selectedRing.visible = false;
  }

  private syncSensorOverlay(state: SimulationState, time: number): void {
    const selected = state.selectedCellId ? state.cells.find((cell) => cell.id === state.selectedCellId) : null;
    if (!selected) {
      this.sensorField.visible = false;
      this.sensorRim.visible = false;
      this.sensorRays.visible = false;
      return;
    }

    const awareness = this.awarenessRadius(selected);
    const pulse = 1;
    this.sensorField.visible = true;
    this.sensorRim.visible = true;
    this.sensorRays.visible = true;
    this.sensorField.position.set(selected.position.x, selected.position.y, 1.6);
    this.sensorRim.position.copy(this.sensorField.position);
    this.sensorField.scale.setScalar(awareness * pulse);
    this.sensorRim.scale.setScalar(awareness * pulse);

    const positions: number[] = [];
    const addRay = (target: Vec2, strength: number): void => {
      const dx = target.x - selected.position.x;
      const dy = target.y - selected.position.y;
      const d = Math.hypot(dx, dy);
      if (d > awareness || d <= 0.01) {
        return;
      }
      positions.push(selected.position.x, selected.position.y, 5.8, selected.position.x + dx * strength, selected.position.y + dy * strength, 5.8);
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

    this.sensorRays.geometry.dispose();
    this.sensorRays.geometry = new THREE.BufferGeometry();
    this.sensorRays.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.sensorRays.material.opacity = state.running ? 0.38 + Math.sin(time * 0.01) * 0.12 : 0.38;
  }

  private awarenessRadius(cell: Cell): number {
    return 16 + cell.radius * 3.4 + cell.genome.caution * 16;
  }

  private createCellVisual(cell: Cell): CellVisual {
    const group = new THREE.Group();
    const bodySeed = cell.id * 917 + cell.generation * 53;
    const membrane = new THREE.Mesh(
      this.createCellBodyGeometry(bodySeed, 1.04, 0.16),
      this.createMembraneMaterial(0xd5fff0, bodySeed),
    );
    const cytoplasm = new THREE.Mesh(
      this.createCellBodyGeometry(bodySeed + 29, 0.88, 0.1),
      this.createPlasmaMaterial(cell, bodySeed + 29),
    );
    cytoplasm.rotation.z = 0.08;
    const nucleus = new THREE.Mesh(
      new THREE.CircleGeometry(1, 48),
      this.createNucleusMaterial(bodySeed + 71),
    );
    nucleus.position.set(-0.06, 0.08, 0.18);
    nucleus.scale.set(0.18, 0.24, 1);

    const organelles = this.createOrganelles(cell, bodySeed);

    const cilia = new THREE.LineSegments(
      this.createCiliaGeometry(bodySeed, 0, 0),
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

  private createCellBodyGeometry(seed: number, radius: number, wobble: number): THREE.ShapeGeometry {
    const points: THREE.Vector2[] = [];
    const count = 56;
    const { stretchX, stretchY } = this.cellStretch(seed);

    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2;
      points.push(this.cellBoundaryPoint(seed, angle, radius, wobble, index, stretchX, stretchY));
    }

    const shape = new THREE.Shape(points);
    const geometry = new THREE.ShapeGeometry(shape, 12);
    geometry.computeVertexNormals();
    return geometry;
  }

  private createCiliaGeometry(seed: number, time: number, speed: number): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.ciliaPositions(seed, time, speed), 3));
    return geometry;
  }

  private updateCiliaGeometry(visual: CellVisual, cell: Cell, time: number, running: boolean): void {
    const speed = Math.min(1, Math.hypot(cell.velocity.x, cell.velocity.y) * 10);
    const phase = running ? time * (0.012 + speed * 0.022) : 0;
    const attribute = visual.cilia.geometry.getAttribute('position') as THREE.BufferAttribute;
    const positions = this.ciliaPositions(visual.seed, phase, speed);
    (attribute.array as Float32Array).set(positions);
    attribute.needsUpdate = true;
  }

  private ciliaPositions(seed: number, time: number, speed: number): number[] {
    const positions: number[] = [];
    const count = 76;
    const { stretchX, stretchY } = this.cellStretch(seed);
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2;
      const root = this.cellBoundaryPoint(seed, angle, 1.045, 0.16, index, stretchX, stretchY);
      const normal = new THREE.Vector2(Math.cos(angle) / stretchX, Math.sin(angle) / stretchY).normalize();
      const tangent = new THREE.Vector2(-normal.y, normal.x);
      const beat = Math.sin(time + index * 0.55 + seed * 0.013);
      const rearSweep = -speed * (0.028 + Math.max(0, Math.cos(angle)) * 0.035);
      const sideSweep = beat * (0.016 + speed * 0.026);
      const length = 0.018 + Math.abs(this.seededNoise(seed, index + 90)) * 0.018 + speed * 0.014;
      const tip = root
        .clone()
        .add(normal.multiplyScalar(length))
        .add(tangent.multiplyScalar(sideSweep))
        .add(new THREE.Vector2(rearSweep, beat * 0.006 * speed));
      positions.push(root.x, root.y, 0.32, tip.x, tip.y, 0.32);
    }
    return positions;
  }

  private cellBoundaryPoint(
    seed: number,
    angle: number,
    radius: number,
    wobble: number,
    index: number,
    stretchX: number,
    stretchY: number,
  ): THREE.Vector2 {
    const waveA = Math.sin(angle * 3 + seed * 0.017) * wobble;
    const waveB = Math.cos(angle * 5 + seed * 0.011) * wobble * 0.55;
    const noise = this.seededNoise(seed, index + 10) * wobble * 0.7;
    const r = radius * (1 + waveA + waveB + noise);
    return new THREE.Vector2(Math.cos(angle) * r * stretchX, Math.sin(angle) * r * stretchY);
  }

  private cellStretch(seed: number): { stretchX: number; stretchY: number } {
    return {
      stretchX: 1.04 + this.seededNoise(seed, 1) * 0.06,
      stretchY: 0.78 + this.seededNoise(seed, 2) * 0.05,
    };
  }

  private createPlasmaMaterial(cell: Cell, seed: number): THREE.ShaderMaterial {
    const base = this.cellColor(cell, 0.7);
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

  private createMembraneMaterial(color: number, seed: number): THREE.ShaderMaterial {
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

  private createNucleusMaterial(seed: number): THREE.ShaderMaterial {
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

  private createOrganelles(cell: Cell, seed: number): THREE.Object3D[] {
    const organelles: THREE.Object3D[] = [];
    for (let index = 0; index < 5; index += 1) {
      const group = new THREE.Group();
      const x = -0.56 + index * 0.28 + this.seededNoise(seed, index + 120) * 0.08;
      const y = this.seededNoise(seed, index + 150) * 0.26;
      const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.045 + (index % 2) * 0.012, 0.1 + (index % 3) * 0.025, 4, 10),
        new THREE.MeshBasicMaterial({ color: index % 2 ? 0x8dffe0 : 0xf2fff2, transparent: true, opacity: 0.52, depthWrite: false }),
      );
      body.scale.set(1.25, 0.56, 1);
      body.rotation.z = this.seededNoise(seed, index + 180) * Math.PI;
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
        new THREE.Vector3(-0.42 + index * 0.18, -0.22 + this.seededNoise(seed, index + 210) * 0.08, 0.235),
        new THREE.Vector3(-0.24 + index * 0.16, -0.06 + this.seededNoise(seed, index + 220) * 0.08, 0.235),
        new THREE.Vector3(-0.04 + index * 0.12, 0.06 + this.seededNoise(seed, index + 230) * 0.08, 0.235),
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

  private seededNoise(seed: number, salt: number): number {
    const value = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
    return (value - Math.floor(value)) * 2 - 1;
  }

  private cellColor(cell: Cell, lightness: number): THREE.Color {
    const hue = 0.43 + cell.genome.harvest * 0.14 - cell.genome.predator * 0.18 + cell.generation * 0.017;
    return new THREE.Color().setHSL(hue, 0.92, lightness);
  }

  private syncResources(resources: Resource[], time: number): void {
    const active = new Set<number>();
    for (const resource of resources) {
      active.add(resource.id);
      let mesh = this.resourceVisuals.get(resource.id);
      if (!mesh) {
        mesh = this.createResourceVisual(resource);
        this.resourceVisuals.set(resource.id, mesh);
        this.resourceLayer.add(mesh);
      }
      mesh.position.set(resource.position.x, resource.position.y, resource.kind === 'light' ? LIGHT_RESOURCE_Z : 3);
      const amountScale = 0.68 + resource.amount * 0.72;
      const lightScale = resource.kind === 'light' ? 0.75 + resource.amount * 0.45 : amountScale;
      mesh.scale.setScalar(resource.radius * lightScale);
    }

    for (const [id, mesh] of this.resourceVisuals.entries()) {
      if (!active.has(id)) {
        this.resourceLayer.remove(mesh);
        this.resourceVisuals.delete(id);
      }
    }
  }

  private createResourceVisual(resource: Resource): THREE.Group {
    const group = new THREE.Group();
    const color = RESOURCE_COLORS[resource.kind];
    const material = this.createResourceMaterial(color, resource.kind, resource.id);

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

  private createResourceMaterial(color: number, kind: Resource['kind'], seed: number): THREE.ShaderMaterial {
    const material = this.createTimedShaderMaterial({
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
        ${this.noiseShaderChunk()}
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

  private createPoisonMaterial(seed: number): THREE.ShaderMaterial {
    return this.createTimedShaderMaterial({
      transparent: true,
      uniforms: {
        uSeed: { value: seed * 0.047 },
      },
      fragmentShader: `
        precision highp float;
        uniform float uTime;
        uniform float uSeed;
        varying vec2 vLocal;
        ${this.noiseShaderChunk()}
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

  private syncHazards(hazards: Hazard[], time: number): void {
    const active = new Set<number>();
    for (const hazard of hazards) {
      active.add(hazard.id);
      let mesh = this.hazardVisuals.get(hazard.id);
      if (!mesh) {
        mesh = new THREE.Mesh(
          new THREE.CircleGeometry(1, 40),
          this.createPoisonMaterial(hazard.id),
        );
        this.hazardVisuals.set(hazard.id, mesh);
        this.hazardLayer.add(mesh);
      }
      mesh.position.set(hazard.position.x, hazard.position.y, 1);
      mesh.scale.setScalar(hazard.radius);
    }
  }

  private spawnEffects(events: SimulationEvent[], time: number): void {
    for (const event of events) {
      if (event.kind === 'resource-consumed') {
        this.effects.push(this.createConsumeEffect(event.position, event.radius, RESOURCE_COLORS[event.resourceKind], time));
      }
      if (event.kind === 'cell-devoured' || event.kind === 'cell-died') {
        this.effects.push(this.createDissolveEffect(event.position, event.radius, time));
      }
    }
  }

  private createConsumeEffect(position: Vec2, radius: number, color: number, time: number): EffectVisual {
    const group = new THREE.Group();
    group.position.set(position.x, position.y, 7);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.6, 0.8, 36),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false }),
    );
    ring.userData.baseOpacity = 0.8;
    ring.scale.setScalar(Math.max(1.2, radius));
    group.add(ring);
    this.effectLayer.add(group);
    return { group, bornAt: time, duration: 520 };
  }

  private createDissolveEffect(position: Vec2, radius: number, time: number): EffectVisual {
    const group = new THREE.Group();
    group.position.set(position.x, position.y, 7);
    const cloud = new THREE.Mesh(
      this.createCellBodyGeometry(Math.floor(time), Math.max(0.8, radius * 0.34), 0.22),
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
    this.effectLayer.add(group);
    return { group, bornAt: time, duration: 1100 };
  }

  private syncEffects(time: number): void {
    this.effects = this.effects.filter((effect) => {
      const progress = (time - effect.bornAt) / effect.duration;
      if (progress >= 1) {
        this.effectLayer.remove(effect.group);
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

  private syncBlocks(state: SimulationState): void {
    if (this.blockLayer.children.length === state.blocks.length) {
      return;
    }
    this.blockLayer.clear();
    this.blockVisuals.clear();
    for (const block of state.blocks) {
      const mesh = new THREE.Mesh(
        this.createBlockGeometry(block),
        this.createMineralMaterial(block.id),
      );
      mesh.position.set(block.position.x, block.position.y, 4);
      this.blockVisuals.set(block.id, mesh);
      this.blockLayer.add(mesh);
    }
  }

  private createMineralMaterial(seed: number): THREE.ShaderMaterial {
    return this.createTimedShaderMaterial({
      transparent: true,
      uniforms: {
        uSeed: { value: seed * 0.037 },
      },
      fragmentShader: `
        precision highp float;
        uniform float uTime;
        uniform float uSeed;
        varying vec2 vLocal;
        ${this.noiseShaderChunk()}
        void main() {
          vec2 p = vLocal * 0.08;
          float strata = sin((p.x * 5.0 + p.y * 2.0) + fbm(p * 7.0 + uSeed) * 3.0);
          float facets = fbm(p * 16.0 + uSeed);
          vec3 purple = vec3(0.26, 0.18, 0.58);
          vec3 teal = vec3(0.18, 0.45, 0.5);
          vec3 mineral = mix(purple, teal, facets * 0.38 + strata * 0.18);
          mineral += vec3(0.18, 0.14, 0.32) * smoothstep(0.72, 1.0, facets);
          gl_FragColor = vec4(mineral, 0.74);
        }
      `,
    });
  }

  private pickAtPoint(point: Vec2, state: SimulationState): MapPick {
    let target: MapPick = { kind: 'dish', id: null };
    let best = Infinity;

    const consider = (candidate: MapPick, distance: number): void => {
      if (distance < best) {
        target = candidate;
        best = distance;
      }
    };

    for (const cell of state.cells) {
      const d = Math.hypot(point.x - cell.position.x, point.y - cell.position.y);
      if (d <= cell.radius * cell.bodyLength * 1.25) {
        consider({ kind: 'cell', id: cell.id }, d);
      }
    }

    for (const resource of state.resources) {
      const d = Math.hypot(point.x - resource.position.x, point.y - resource.position.y);
      if (d <= Math.max(resource.radius * 1.35, 2.8)) {
        consider({ kind: 'resource', id: resource.id }, d + 0.2);
      }
    }

    for (const hazard of state.hazards) {
      const d = Math.hypot(point.x - hazard.position.x, point.y - hazard.position.y);
      if (d <= hazard.radius * 1.25) {
        consider({ kind: 'hazard', id: hazard.id }, d + 0.4);
      }
    }

    for (const block of state.blocks) {
      if (this.pointInBlock(point, block)) {
        const dx = Math.abs(point.x - block.position.x);
        const dy = Math.abs(point.y - block.position.y);
        consider({ kind: 'block', id: block.id }, Math.max(dx, dy) + 0.6);
      }
    }

    return target;
  }

  private pointInBlock(point: Vec2, block: Block): boolean {
    return Math.hypot(point.x - block.position.x, point.y - block.position.y) <= block.radius;
  }

  private createBlockGeometry(block: Block): THREE.ShapeGeometry {
    const shape = new THREE.Shape(block.vertices.map((point) => new THREE.Vector2(point.x, point.y)));
    return new THREE.ShapeGeometry(shape, 8);
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.resize);
    this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });
    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
  }

  private resize = (): void => {
    const width = Math.max(1, this.canvas.clientWidth || window.innerWidth);
    const height = Math.max(1, this.canvas.clientHeight || window.innerHeight);
    this.renderer.setSize(width, height, false);
    const aspect = width / Math.max(1, height);
    const halfHeight = (this.frustumHeight / this.zoom) * 0.5;
    this.camera.left = -halfHeight * aspect;
    this.camera.right = halfHeight * aspect;
    this.camera.top = halfHeight;
    this.camera.bottom = -halfHeight;
    this.camera.updateProjectionMatrix();
  };

  private handleWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const before = this.screenToWorld(event.clientX, event.clientY);
    this.zoom = THREE.MathUtils.clamp(this.zoom * (event.deltaY > 0 ? 0.9 : 1.1), 0.55, 4.2);
    this.resize();
    const after = this.screenToWorld(event.clientX, event.clientY);
    this.camera.position.x += before.x - after.x;
    this.camera.position.y += before.y - after.y;
  };

  private handlePointerDown = (event: PointerEvent): void => {
    this.pointerDown = { x: event.clientX, y: event.clientY };
    this.clickMoved = false;
    this.dragStart = { x: event.clientX, y: event.clientY, cameraX: this.camera.position.x, cameraY: this.camera.position.y };
    this.canvas.setPointerCapture(event.pointerId);
  };

  private handlePointerMove = (event: PointerEvent): void => {
    if (!this.dragStart) {
      return;
    }
    const dx = event.clientX - this.dragStart.x;
    const dy = event.clientY - this.dragStart.y;
    if (Math.hypot(event.clientX - this.pointerDown.x, event.clientY - this.pointerDown.y) > 4) {
      this.clickMoved = true;
    }
    const worldHeight = this.frustumHeight / this.zoom;
    const worldPerPixel = worldHeight / Math.max(1, this.canvas.clientHeight);
    this.camera.position.x = this.dragStart.cameraX - dx * worldPerPixel;
    this.camera.position.y = this.dragStart.cameraY + dy * worldPerPixel;
  };

  private handlePointerUp = (): void => {
    this.dragStart = null;
  };

  screenToWorld(clientX: number, clientY: number): Vec2 {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const point = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(this.dishPlane, point);
    return { x: point.x, y: point.y };
  }
}
