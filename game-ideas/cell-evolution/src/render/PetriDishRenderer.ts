import * as THREE from 'three';
import { sensingProfile } from '../core/sensing';
import type { Block, Cell, Hazard, Resource, SimulationEvent, SimulationState, Vec2 } from '../core/types';
import { createBlockGeometry, createMineralMaterial } from './blocks';
import { updateCiliaGeometry } from './cell-geometry';
import { createCellVisual, type CellVisual } from './cell-visuals';
import { createAgarMaterial, createDishBaseMaterial, createDishRimMaterial } from './dish-materials';
import { spawnEffectVisuals, syncEffectVisuals, type EffectVisual } from './effects';
import { createPoisonMaterial } from './hazards';
import { pickAtWorldPoint } from './picking';
import { createResourceVisual } from './resources';
import { createTimedShaderMaterial, noiseShaderChunk, updateTimedMaterials } from './shaders';
import { createDishTexture, createMicroscopeBackdropTexture } from './textures';
import type { MapPick, PickResult, RendererView } from './types';

type PetriDishRendererOptions = {
  renderBackground?: boolean;
  cameraControls?: boolean;
  defaultCameraX?: number;
  defaultCameraY?: number;
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
    return pickAtWorldPoint(point, state);
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
        visual = createCellVisual(cell);
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
    this.effects.push(...spawnEffectVisuals(events, time, this.effectLayer));
  }

  private syncEffects(time: number): void {
    this.effects = syncEffectVisuals(this.effects, time, this.effectLayer);
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
