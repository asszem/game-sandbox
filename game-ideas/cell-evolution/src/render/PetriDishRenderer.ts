import * as THREE from 'three';
import type { Block, Cell, Hazard, Resource, SimulationEvent, SimulationState, Vec2 } from '../core/types';

type CellVisual = {
  group: THREE.Group;
  membrane: THREE.Mesh<THREE.ShapeGeometry, THREE.MeshBasicMaterial>;
  cytoplasm: THREE.Mesh<THREE.ShapeGeometry, THREE.MeshBasicMaterial>;
  nucleus: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  organelles: THREE.Mesh[];
  cilia: THREE.LineSegments;
  aura: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  signal: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
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

export class PetriDishRenderer {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
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
  private frustumHeight = 203;
  private zoom = 1;
  private dragStart: { x: number; y: number; cameraX: number; cameraY: number } | null = null;
  private pointerDown = { x: 0, y: 0 };
  private clickMoved = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x06080f, 1);

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -200, 200);
    this.camera.position.set(-96, 0, 100);
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
    this.spawnEffects(events, time);
    this.syncResources(state.resources, time);
    this.syncHazards(state.hazards, time);
    this.syncBlocks(state);
    this.syncCells(state.cells, state.selectedCellId, time, state.running);
    this.syncSensorOverlay(state, time);
    this.syncEffects(time);
    this.renderer.render(this.scene, this.camera);
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
    this.resize();
  }

  getZoomPercent(): number {
    return Math.round(this.zoom * 100);
  }

  private buildScene(): void {
    const ambient = new THREE.AmbientLight(0x9fffd8, 1.35);
    const key = new THREE.DirectionalLight(0xff6bf7, 2.4);
    key.position.set(-20, 28, 48);

    const dish = new THREE.Mesh(
      new THREE.CircleGeometry(96, 160),
      new THREE.MeshBasicMaterial({ color: 0x071b1f }),
    );
    const agar = new THREE.Mesh(
      new THREE.CircleGeometry(91.5, 160),
      new THREE.MeshBasicMaterial({ color: 0x123544, transparent: true, opacity: 0.94 }),
    );
    const rim = new THREE.Mesh(
      new THREE.RingGeometry(91.8, 96.8, 160),
      new THREE.MeshBasicMaterial({ color: 0x6affdf, transparent: true, opacity: 0.42 }),
    );
    const grid = this.createDishTexture();
    const dishVeins = new THREE.Mesh(
      new THREE.PlaneGeometry(184, 184),
      new THREE.MeshBasicMaterial({ map: grid, transparent: true, opacity: 0.22 }),
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
      visual.membrane.material.color.setHex(stressed ? 0xb6ff6a : cell.id === selectedCellId ? 0xfff65a : 0xd5fff0);
      visual.membrane.material.opacity = 0.36 + cell.health * 0.28;
      visual.cytoplasm.material.opacity = stressed ? 0.34 : 0.5 + cell.energy / 260;
      visual.aura.visible = balanced;
      visual.aura.material.opacity = running ? 0.16 + Math.sin(time * 0.004 + cell.id) * 0.06 : 0.16;
      visual.nucleus.scale.setScalar(0.22 + cell.genome.split * 0.1);
      visual.signal.visible = false;

      for (let index = 0; index < visual.organelles.length; index += 1) {
        const organelle = visual.organelles[index];
        if (running) {
          const orbit = time * 0.0006 * (index + 1) + cell.id;
          organelle.position.x += Math.sin(orbit) * 0.001;
          organelle.position.y += Math.cos(orbit) * 0.001;
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
      new THREE.MeshBasicMaterial({ color: 0xd5fff0, transparent: true, opacity: 0.62, depthWrite: false }),
    );
    const cytoplasm = new THREE.Mesh(
      this.createCellBodyGeometry(bodySeed + 29, 0.88, 0.1),
      new THREE.MeshBasicMaterial({ color: this.cellColor(cell, 0.76), transparent: true, opacity: 0.72, depthWrite: false }),
    );
    cytoplasm.rotation.z = 0.08;
    const nucleus = new THREE.Mesh(
      new THREE.CircleGeometry(1, 48),
      new THREE.MeshBasicMaterial({ color: 0xd952ff, transparent: true, opacity: 0.84, depthWrite: false }),
    );
    nucleus.position.set(-0.06, 0.08, 0.18);
    nucleus.scale.set(0.18, 0.24, 1);

    const organelles = Array.from({ length: 13 }, (_, index) => {
      const lane = -0.74 + (index / 12) * 1.48;
      const side = index % 2 === 0 ? 1 : -1;
      const drift = this.seededNoise(cell.id, index + 21) * 0.16;
      const mesh = new THREE.Mesh(
        new THREE.CircleGeometry(0.035 + (index % 4) * 0.012, 18),
        new THREE.MeshBasicMaterial({ color: index % 3 ? 0xffffff : 0x65ffbd, transparent: true, opacity: 0.62 }),
      );
      mesh.position.set(lane, side * (0.12 + Math.abs(drift)), 0.22 + index * 0.002);
      mesh.scale.set(1.25 + Math.abs(drift), 0.8, 1);
      mesh.rotation.z = drift * 2;
      return mesh;
    });

    const cilia = new THREE.LineSegments(
      this.createCiliaGeometry(bodySeed),
      new THREE.LineBasicMaterial({ color: 0xf9fff4, transparent: true, opacity: 0.8, depthWrite: false }),
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
    return { group, membrane, cytoplasm, nucleus, organelles, cilia, aura, signal };
  }

  private createCellBodyGeometry(seed: number, radius: number, wobble: number): THREE.ShapeGeometry {
    const points: THREE.Vector2[] = [];
    const count = 56;
    const stretchX = 1.04 + this.seededNoise(seed, 1) * 0.06;
    const stretchY = 0.78 + this.seededNoise(seed, 2) * 0.05;

    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2;
      const waveA = Math.sin(angle * 3 + seed * 0.017) * wobble;
      const waveB = Math.cos(angle * 5 + seed * 0.011) * wobble * 0.55;
      const noise = this.seededNoise(seed, index + 10) * wobble * 0.7;
      const r = radius * (1 + waveA + waveB + noise);
      points.push(new THREE.Vector2(Math.cos(angle) * r * stretchX, Math.sin(angle) * r * stretchY));
    }

    const shape = new THREE.Shape(points);
    const geometry = new THREE.ShapeGeometry(shape, 12);
    geometry.computeVertexNormals();
    return geometry;
  }

  private createCiliaGeometry(seed: number): THREE.BufferGeometry {
    const positions: number[] = [];
    const count = 72;
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2;
      const noise = this.seededNoise(seed, index + 50) * 0.05;
      const x = Math.cos(angle) * (1.0 + noise);
      const y = Math.sin(angle) * (0.78 + noise * 0.4);
      const normal = new THREE.Vector2(Math.cos(angle) / 1.0, Math.sin(angle) / 0.78).normalize();
      const length = 0.13 + Math.abs(this.seededNoise(seed, index + 90)) * 0.08;
      positions.push(x, y, 0.32, x + normal.x * length, y + normal.y * length, 0.32);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geometry;
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
      mesh.position.set(resource.position.x, resource.position.y, resource.kind === 'light' ? 0.12 : 3);
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
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: resource.kind === 'light' ? 0.26 : 0.86,
      depthWrite: false,
    });

    if (resource.kind === 'glucose') {
      for (let index = 0; index < 6; index += 1) {
        const angle = (index / 6) * Math.PI * 2;
        const mesh = new THREE.Mesh(new THREE.CircleGeometry(0.34, 6), material.clone());
        mesh.position.set(Math.cos(angle) * 0.38, Math.sin(angle) * 0.38, index * 0.002);
        mesh.rotation.z = angle;
        group.add(mesh);
      }
    } else if (resource.kind === 'amino-acid') {
      const spine = new THREE.Mesh(new THREE.CircleGeometry(0.26, 18), material.clone());
      group.add(spine);
      for (let index = 0; index < 4; index += 1) {
        const angle = index * Math.PI * 0.5 + 0.4;
        const mesh = new THREE.Mesh(new THREE.CircleGeometry(0.16, 14), material.clone());
        mesh.position.set(Math.cos(angle) * 0.48, Math.sin(angle) * 0.28, index * 0.002);
        group.add(mesh);
      }
    } else if (resource.kind === 'oxygen') {
      const left = new THREE.Mesh(new THREE.CircleGeometry(0.34, 24), material.clone());
      const right = new THREE.Mesh(new THREE.CircleGeometry(0.34, 24), material.clone());
      left.position.x = -0.22;
      right.position.x = 0.22;
      group.add(left, right);
    } else {
      const outer = new THREE.Mesh(new THREE.RingGeometry(0.58, 1, 44), material.clone());
      const core = new THREE.Mesh(new THREE.CircleGeometry(0.34, 32), material.clone());
      core.material.opacity = 0.16;
      group.add(outer, core);
    }

    return group;
  }

  private syncHazards(hazards: Hazard[], time: number): void {
    const active = new Set<number>();
    for (const hazard of hazards) {
      active.add(hazard.id);
      let mesh = this.hazardVisuals.get(hazard.id);
      if (!mesh) {
        mesh = new THREE.Mesh(
          new THREE.CircleGeometry(1, 40),
        new THREE.MeshBasicMaterial({ color: 0xd91eff, transparent: true, opacity: 0.5, depthWrite: false }),
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
        new THREE.MeshBasicMaterial({ color: 0x784cff, transparent: true, opacity: 0.72 }),
      );
      mesh.position.set(block.position.x, block.position.y, 4);
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

  private screenToWorld(clientX: number, clientY: number): Vec2 {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const point = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(this.dishPlane, point);
    return { x: point.x, y: point.y };
  }
}
