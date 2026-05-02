import * as THREE from 'three';
import { sensingProfile } from '../core/sensing';
import type { Block, Cell, Hazard, Resource, SimulationEvent, SimulationState, Vec2 } from '../core/types';
import { createBlockGeometry, createMineralMaterial, pointInBlock } from './blocks';
import { createCellBodyGeometry, createCiliaGeometry, seededNoise, updateCiliaGeometry } from './cell-geometry';
import { createAgarMaterial, createDishBaseMaterial, createDishRimMaterial } from './dish-materials';
import { createPoisonMaterial } from './hazards';
import { createResourceVisual, RESOURCE_COLORS } from './resources';
import { createTimedShaderMaterial, noiseShaderChunk, updateTimedMaterials } from './shaders';
import { createDishTexture, createMicroscopeBackdropTexture } from './textures';

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

type PetriDishRendererOptions = {
  renderBackground?: boolean;
  cameraControls?: boolean;
  defaultCameraX?: number;
  defaultCameraY?: number;
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

export type RendererView = {
  zoom: number;
  cameraX: number;
  cameraY: number;
};

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
  private aspect = 1;
  private zoom = 1;
  private defaultCameraX = -48;
  private defaultCameraY = 0;
  private dragStart: { x: number; y: number; cameraX: number; cameraY: number } | null = null;
  private pointerDown = { x: 0, y: 0 };
  private clickMoved = false;
  private renderBackground: boolean;
  private cameraControls: boolean;

  constructor(canvas: HTMLCanvasElement, options: PetriDishRendererOptions = {}) {
    this.canvas = canvas;
    this.renderBackground = options.renderBackground ?? true;
    this.cameraControls = options.cameraControls ?? true;
    this.defaultCameraX = options.defaultCameraX ?? this.defaultCameraX;
    this.defaultCameraY = options.defaultCameraY ?? this.defaultCameraY;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: !this.renderBackground });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x06080f, this.renderBackground ? 1 : 0);

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -200, 200);
    this.camera.position.set(this.defaultCameraX, this.defaultCameraY, 100);
    this.camera.lookAt(this.camera.position.x, this.camera.position.y, 0);

    this.selectedRing = new THREE.Mesh(
      new THREE.RingGeometry(1, 1.08, 128),
      new THREE.MeshBasicMaterial({ color: 0xf9ff4d, transparent: true, opacity: 0.58, depthTest: false, depthWrite: false }),
    );
    this.selectedRing.renderOrder = 900;
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
    this.canvas.removeEventListener('wheel', this.handleWheel);
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    this.renderer.dispose();
  }

  render(state: SimulationState, time: number, events: SimulationEvent[] = [], selectedTarget: MapPick = { kind: 'dish', id: null }): void {
    updateTimedMaterials(this.timedMaterials, time);
    this.spawnEffects(events, time);
    this.syncResources(state.resources, time);
    this.syncHazards(state.hazards, time);
    this.syncBlocks(state);
    this.syncCells(state.cells, state.selectedCellId, time, state.running);
    this.syncSensorOverlay(state, time);
    this.syncSelectionRing(state, selectedTarget, time);
    this.syncEffects(time);
    this.renderer.autoClear = true;
    if (this.renderBackground) {
      this.renderer.render(this.backgroundScene, this.backgroundCamera);
      this.renderer.clearDepth();
      this.renderer.autoClear = false;
    }
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
    this.clampCameraToZoomBounds();
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

  panFromView(view: RendererView, screenDx: number, screenDy: number): void {
    const worldHeight = this.frustumHeight / Math.max(0.001, view.zoom);
    const worldPerPixel = worldHeight / Math.max(1, this.canvas.clientHeight);
    this.camera.position.x = view.cameraX - screenDx * worldPerPixel;
    this.camera.position.y = view.cameraY + screenDy * worldPerPixel;
    this.clampCameraToZoomBounds();
  }

  zoomBy(factor: number): void {
    this.zoom = THREE.MathUtils.clamp(this.zoom * factor, 1, 4.2);
    if (this.zoom <= 1.001) {
      this.camera.position.x = this.defaultCameraX;
      this.camera.position.y = this.defaultCameraY;
    }
    this.resize();
    this.clampCameraToZoomBounds();
  }

  exportView(): RendererView {
    return {
      zoom: this.zoom,
      cameraX: this.camera.position.x,
      cameraY: this.camera.position.y,
    };
  }

  applyView(view: RendererView | undefined): void {
    if (!view) {
      return;
    }
    this.zoom = THREE.MathUtils.clamp(view.zoom || 1, 1, 4.2);
    this.camera.position.x = Number.isFinite(view.cameraX) ? view.cameraX : this.defaultCameraX;
    this.camera.position.y = Number.isFinite(view.cameraY) ? view.cameraY : this.defaultCameraY;
    this.resize();
    this.clampCameraToZoomBounds();
  }

  private buildScene(): void {
    const ambient = new THREE.AmbientLight(0xc7ffe6, 1.15);
    const key = new THREE.DirectionalLight(0xb7fff0, 1.8);
    key.position.set(-20, 28, 48);

    const backPlate = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.MeshBasicMaterial({ map: createMicroscopeBackdropTexture(), color: 0x9fc9c5, depthWrite: false, depthTest: false }),
    );
    backPlate.position.set(0, 0, 0);
    this.backgroundScene.add(backPlate);

    const dish = new THREE.Mesh(
      new THREE.CircleGeometry(96, 160),
      createDishBaseMaterial(this.timedMaterials),
    );
    const agar = new THREE.Mesh(
      new THREE.CircleGeometry(91.5, 160),
      createAgarMaterial(this.timedMaterials),
    );
    const rim = new THREE.Mesh(
      new THREE.RingGeometry(91.8, 96.8, 160),
      createDishRimMaterial(this.timedMaterials),
    );
    const grid = createDishTexture();
    const dishVeins = new THREE.Mesh(
      new THREE.CircleGeometry(91.2, 160),
      new THREE.MeshBasicMaterial({ map: grid, transparent: true, opacity: 0.18, depthWrite: false }),
    );
    dishVeins.position.z = 0.02;

    this.board.add(dish, agar, dishVeins, this.resourceLayer, this.hazardLayer, this.effectLayer, this.sensorLayer, this.cellLayer, this.blockLayer, rim, this.selectedRing);
    this.scene.add(ambient, key, this.board);
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
      visual.group.position.set(cell.position.x, cell.position.y, 2 + cell.id * 0.0001);
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
      updateCiliaGeometry(visual.cilia.geometry, visual.seed, cell.velocity, time, running);

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

  private syncSelectionRing(state: SimulationState, target: MapPick, time: number): void {
    this.selectedRing.visible = false;
    if (target.kind === 'dish') {
      return;
    }

    const pulse = 1 + Math.sin(time * 0.004) * 0.018;
    if (target.kind === 'cell') {
      const cell = state.cells.find((item) => item.id === target.id);
      if (!cell) {
        return;
      }
      this.selectedRing.visible = true;
      this.selectedRing.position.set(cell.position.x, cell.position.y, 9);
      this.selectedRing.rotation.z = this.cellVisuals.get(cell.id)?.group.rotation.z ?? 0;
      this.selectedRing.scale.set(cell.radius * cell.bodyLength * 1.2 * pulse, cell.radius * 1.2 * pulse, 1);
      return;
    }

    this.selectedRing.rotation.z = 0;
    if (target.kind === 'resource') {
      const resource = state.resources.find((item) => item.id === target.id);
      if (!resource) {
        return;
      }
      const amountScale = 0.68 + resource.amount * 0.72;
      const lightScale = resource.kind === 'light' ? 0.75 + resource.amount * 0.45 : amountScale;
      this.selectedRing.visible = true;
      this.selectedRing.position.set(resource.position.x, resource.position.y, 9);
      this.selectedRing.scale.setScalar(resource.radius * lightScale * 1.16 * pulse);
      return;
    }

    if (target.kind === 'hazard') {
      const hazard = state.hazards.find((item) => item.id === target.id);
      if (!hazard) {
        return;
      }
      this.selectedRing.visible = true;
      this.selectedRing.position.set(hazard.position.x, hazard.position.y, 9);
      this.selectedRing.scale.setScalar(hazard.radius * 1.12 * pulse);
      return;
    }

    const block = state.blocks.find((item) => item.id === target.id);
    if (!block) {
      return;
    }
    this.selectedRing.visible = true;
    this.selectedRing.position.set(block.position.x, block.position.y, 9);
    this.selectedRing.scale.setScalar(block.radius * 1.12 * pulse);
  }

  private syncSensorOverlay(state: SimulationState, time: number): void {
    const selected = state.selectedCellId ? state.cells.find((cell) => cell.id === state.selectedCellId) : null;
    if (!selected) {
      this.sensorField.visible = false;
      this.sensorRim.visible = false;
      this.sensorRays.visible = false;
      return;
    }

    const sensing = sensingProfile(selected);
    const awareness = sensing.radius;
    const pulse = 1;
    this.sensorField.visible = true;
    this.sensorRim.visible = true;
    this.sensorRays.visible = true;
    this.sensorField.material.opacity = 0.025 + sensing.clarity * 0.055;
    this.sensorRim.material.opacity = 0.18 + sensing.clarity * 0.36;
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
      positions.push(selected.position.x, selected.position.y, 5.8, selected.position.x + dx * strength * sensing.clarity, selected.position.y + dy * strength * sensing.clarity, 5.8);
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
    this.sensorRays.material.opacity = (state.running ? 0.22 + Math.sin(time * 0.01) * 0.08 : 0.22) * sensing.clarity * sensing.processing;
  }

  private createCellVisual(cell: Cell): CellVisual {
    const group = new THREE.Group();
    const bodySeed = cell.id * 917 + cell.generation * 53;
    const membrane = new THREE.Mesh(
      createCellBodyGeometry(bodySeed, 1.04, 0.16),
      this.createMembraneMaterial(0xd5fff0, bodySeed),
    );
    const cytoplasm = new THREE.Mesh(
      createCellBodyGeometry(bodySeed + 29, 0.88, 0.1),
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

  private cellColor(cell: Cell, lightness: number): THREE.Color {
    const hue = 0.43 + cell.genome.harvest * 0.14 - cell.genome.predator * 0.18 + cell.generation * 0.017;
    return new THREE.Color().setHSL(hue, 0.92, lightness);
  }

  private syncResources(resources: Resource[], time: number): void {
    const active = new Set<number>();
    for (const resource of resources) {
      active.add(resource.id);
      let mesh = this.resourceVisuals.get(resource.id);
      if (mesh && mesh.userData.kind !== resource.kind) {
        this.resourceLayer.remove(mesh);
        this.resourceVisuals.delete(resource.id);
        mesh = undefined;
      }
      if (!mesh) {
        mesh = createResourceVisual(resource, this.timedMaterials);
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

  private syncHazards(hazards: Hazard[], time: number): void {
    const active = new Set<number>();
    for (const hazard of hazards) {
      active.add(hazard.id);
      let mesh = this.hazardVisuals.get(hazard.id);
      if (!mesh) {
        mesh = new THREE.Mesh(
          new THREE.CircleGeometry(1, 40),
          createPoisonMaterial(hazard.id, this.timedMaterials),
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
        createBlockGeometry(block),
        createMineralMaterial(block.id, this.timedMaterials),
      );
      mesh.position.set(block.position.x, block.position.y, 12);
      mesh.renderOrder = 820;
      this.blockVisuals.set(block.id, mesh);
      this.blockLayer.add(mesh);
    }
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
      if (pointInBlock(point, block)) {
        const dx = Math.abs(point.x - block.position.x);
        const dy = Math.abs(point.y - block.position.y);
        consider({ kind: 'block', id: block.id }, Math.max(dx, dy) + 0.6);
      }
    }

    return target;
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.resize);
    this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });
    if (this.cameraControls) {
      this.canvas.addEventListener('pointerdown', this.handlePointerDown);
      window.addEventListener('pointermove', this.handlePointerMove);
      window.addEventListener('pointerup', this.handlePointerUp);
    }
  }

  private resize = (): void => {
    const width = Math.max(1, this.canvas.clientWidth || window.innerWidth);
    const height = Math.max(1, this.canvas.clientHeight || window.innerHeight);
    this.renderer.setSize(width, height, false);
    const aspect = width / Math.max(1, height);
    this.aspect = aspect;
    const halfHeight = (this.frustumHeight / this.zoom) * 0.5;
    this.camera.left = -halfHeight * aspect;
    this.camera.right = halfHeight * aspect;
    this.camera.top = halfHeight;
    this.camera.bottom = -halfHeight;
    this.camera.updateProjectionMatrix();
  };

  private handleWheel = (event: WheelEvent): void => {
    if (event.shiftKey) {
      return;
    }
    event.preventDefault();
    const before = this.cameraControls ? this.screenToWorld(event.clientX, event.clientY) : null;
    this.zoomBy(event.deltaY > 0 ? 0.9 : 1.1);
    if (before) {
      const after = this.screenToWorld(event.clientX, event.clientY);
      this.camera.position.x += before.x - after.x;
      this.camera.position.y += before.y - after.y;
      this.clampCameraToZoomBounds();
    }
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
    this.clampCameraToZoomBounds();
  };

  private handlePointerUp = (): void => {
    this.dragStart = null;
  };

  private clampCameraToZoomBounds(): void {
    if (this.zoom <= 1.001) {
      this.camera.position.x = this.defaultCameraX;
      this.camera.position.y = this.defaultCameraY;
      return;
    }
    const defaultHalfHeight = this.frustumHeight * 0.5;
    const currentHalfHeight = (this.frustumHeight / this.zoom) * 0.5;
    const defaultHalfWidth = defaultHalfHeight * this.aspect;
    const currentHalfWidth = currentHalfHeight * this.aspect;
    const maxPanX = Math.max(0, defaultHalfWidth - currentHalfWidth);
    const maxPanY = Math.max(0, defaultHalfHeight - currentHalfHeight);
    this.camera.position.x = THREE.MathUtils.clamp(this.camera.position.x, this.defaultCameraX - maxPanX, this.defaultCameraX + maxPanX);
    this.camera.position.y = THREE.MathUtils.clamp(this.camera.position.y, this.defaultCameraY - maxPanY, this.defaultCameraY + maxPanY);
  }

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
