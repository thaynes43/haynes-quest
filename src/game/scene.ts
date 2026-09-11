import * as THREE from 'three';
import type { AppearanceStage, SaveView } from '../shared/contracts';
import { getAvatarProportions } from './controller';
import type { LevelLayout } from './level';
import type { PositionSnapshot } from './types';

const palette = {
  parchment: 0xf5ebdc,
  plum: 0x342c46,
  leaf: 0x557363,
  honey: 0xdca953,
  shade: 0x71849a,
  timber: 0x806247,
  stone: 0xafa69c,
  grass: 0x84937a,
};

function matte(color: number, emissive = 0x000000): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, emissive, roughness: 0.92, metalness: 0 });
}

function mesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position?: [number, number, number],
): THREE.Mesh {
  const result = new THREE.Mesh(geometry, material);
  if (position) result.position.set(...position);
  result.castShadow = true;
  result.receiveShadow = true;
  return result;
}

function disposeObject(root: THREE.Object3D): void {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) value.dispose();
      }
      material.dispose();
    }
  });
}

function createTraveler(stage: AppearanceStage): THREE.Group {
  const dimensions = getAvatarProportions(stage);
  const group = new THREE.Group();
  group.name = `temporary-traveler-${stage}`;
  const hoodMaterial = matte(palette.plum);
  const tunicMaterial = matte(palette.leaf);
  const claspMaterial = matte(palette.honey);
  const satchelMaterial = matte(palette.timber);

  const hipY = dimensions.legLength + dimensions.torsoHeight * 0.3;
  const torso = mesh(
    new THREE.CapsuleGeometry(dimensions.colliderRadius * 0.68, dimensions.torsoHeight, 5, 10),
    tunicMaterial,
    [0, hipY, 0],
  );
  torso.rotation.x = dimensions.posture;
  group.add(torso);

  const headY = dimensions.height - dimensions.headRadius;
  const hood = mesh(new THREE.SphereGeometry(dimensions.headRadius, 16, 12), hoodMaterial, [0, headY, 0]);
  hood.scale.set(1.05, 1.12, 1);
  group.add(hood);

  const legRadius = stage === 'infant' ? 0.075 : 0.065;
  for (const side of [-1, 1]) {
    const leg = mesh(
      new THREE.CapsuleGeometry(legRadius, Math.max(0.03, dimensions.legLength - legRadius * 2), 4, 8),
      tunicMaterial.clone(),
      [side * dimensions.colliderRadius * 0.42, dimensions.legLength * 0.48, 0],
    );
    if (stage === 'infant') leg.rotation.x = 0.2;
    group.add(leg);
  }

  const clasp = mesh(new THREE.SphereGeometry(0.045, 10, 8), claspMaterial, [0, headY - dimensions.headRadius * 0.72, -dimensions.headRadius * 0.86]);
  group.add(clasp);
  const satchel = mesh(
    new THREE.BoxGeometry(0.23, 0.2, 0.1),
    satchelMaterial,
    [dimensions.colliderRadius * 0.8, hipY, dimensions.colliderRadius * 0.65],
  );
  satchel.rotation.z = -0.1;
  group.add(satchel);
  return group;
}

function createMemory(id: string, x: number, y: number, z: number): THREE.Group {
  const group = new THREE.Group();
  group.name = `memory-${id}`;
  group.position.set(x, y + 0.82, z);
  group.userData.baseY = group.position.y;
  const wood = matte(palette.timber);
  const glow = matte(palette.honey, 0x6d4617);
  group.add(mesh(new THREE.BoxGeometry(0.76, 0.1, 0.1), wood, [0, 0.43, 0]));
  group.add(mesh(new THREE.BoxGeometry(0.76, 0.1, 0.1), wood.clone(), [0, -0.43, 0]));
  group.add(mesh(new THREE.BoxGeometry(0.1, 0.76, 0.1), wood.clone(), [-0.33, 0, 0]));
  group.add(mesh(new THREE.BoxGeometry(0.1, 0.76, 0.1), wood.clone(), [0.33, 0, 0]));
  group.add(mesh(new THREE.PlaneGeometry(0.54, 0.64), matte(palette.parchment), [0, 0, 0.055]));
  group.add(mesh(new THREE.SphereGeometry(0.095, 12, 8), glow, [0.28, 0.38, 0.08]));
  return group;
}

function createGateway(position: PositionSnapshot): THREE.Group {
  const group = new THREE.Group();
  group.name = 'finish-gateway';
  group.position.set(position.x, position.y, position.z);
  const timber = matte(palette.timber);
  group.add(mesh(new THREE.BoxGeometry(0.22, 1.75, 0.22), timber, [-0.82, 0.87, 0]));
  group.add(mesh(new THREE.BoxGeometry(0.22, 1.75, 0.22), timber.clone(), [0.82, 0.87, 0]));
  const crescent = mesh(new THREE.TorusGeometry(0.82, 0.11, 10, 24, Math.PI), timber.clone(), [0, 1.72, 0]);
  group.add(crescent);
  const lantern = mesh(new THREE.SphereGeometry(0.14, 12, 8), matte(palette.honey, 0x7a531c), [0, 1.42, 0]);
  group.add(lantern);
  return group;
}

function createTree(x: number, z: number, scale: number): THREE.Group {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const trunk = mesh(new THREE.CylinderGeometry(0.12 * scale, 0.18 * scale, 1.05 * scale, 8), matte(palette.timber), [0, 0.52 * scale, 0]);
  const crown = mesh(new THREE.SphereGeometry(0.6 * scale, 12, 9), matte(palette.leaf), [0, 1.35 * scale, 0]);
  crown.scale.y = 1.15;
  group.add(trunk, crown);
  return group;
}

function createWorld(level: LevelLayout): { root: THREE.Group; memories: Map<string, THREE.Group> } {
  const root = new THREE.Group();
  root.name = 'temporary-garden-greybox';
  const routeCenterZ = (level.minZ + level.maxZ) / 2;
  const routeDepth = level.maxZ - level.minZ;
  const grass = mesh(new THREE.BoxGeometry(18, 0.16, routeDepth + 8), matte(palette.grass), [0, -0.13, routeCenterZ]);
  root.add(grass);
  const path = mesh(new THREE.BoxGeometry(5.6, 0.08, routeDepth), matte(palette.parchment), [0, -0.035, routeCenterZ]);
  root.add(path);
  if (level.step) {
    const raisedDepth = level.step.z - level.minZ;
    const raised = mesh(
      new THREE.BoxGeometry(5.6, level.step.height, raisedDepth),
      matte(palette.stone),
      [0, level.step.height / 2, level.minZ + raisedDepth / 2],
    );
    root.add(raised);
  }

  const memories = new Map<string, THREE.Group>();
  for (const placement of level.memories) {
    const keepsake = createMemory(placement.id, placement.position.x, placement.position.y, placement.position.z);
    memories.set(placement.id, keepsake);
    root.add(keepsake);
  }
  root.add(createGateway(level.finish));

  for (let index = 0, z = 0; z > level.minZ; index += 1, z -= 7) {
    const side = index % 2 === 0 ? -1 : 1;
    root.add(createTree(side * (4.1 + (index % 3) * 0.55), z - 2, 0.85 + (index % 2) * 0.15));
    const stone = mesh(new THREE.DodecahedronGeometry(0.26 + (index % 2) * 0.08, 0), matte(palette.stone), [-side * 3.25, 0.2, z - 4.5]);
    stone.scale.y = 0.65;
    root.add(stone);
  }
  return { root, memories };
}

export class GardenScene {
  readonly canvas: HTMLCanvasElement;
  cameraYaw = 0;
  cameraPitch = 0.34;

  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(48, 1, 0.1, 120);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly clockTarget = new THREE.Vector3();
  private readonly resizeObserver: ResizeObserver | null;
  private worldRoot: THREE.Group;
  private memories: Map<string, THREE.Group>;
  private traveler: THREE.Group;
  private stage: AppearanceStage;
  private disposed = false;

  constructor(
    private readonly container: HTMLElement,
    level: LevelLayout,
    save: SaveView,
  ) {
    this.stage = save.appearance.stage;
    this.scene.background = new THREE.Color(palette.parchment);
    this.scene.fog = new THREE.Fog(palette.parchment, 18, 58);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.canvas = this.renderer.domElement;
    this.canvas.dataset.questCanvas = 'true';
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.touchAction = 'none';
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.append(this.canvas);

    const hemisphere = new THREE.HemisphereLight(0xffe8c4, palette.shade, 1.8);
    this.scene.add(hemisphere);
    const sun = new THREE.DirectionalLight(0xffd59a, 2.4);
    sun.position.set(-6, 10, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -8;
    sun.shadow.camera.right = 8;
    sun.shadow.camera.top = 12;
    sun.shadow.camera.bottom = -12;
    this.scene.add(sun);

    const world = createWorld(level);
    this.worldRoot = world.root;
    this.memories = world.memories;
    this.scene.add(this.worldRoot);
    this.traveler = createTraveler(this.stage);
    this.scene.add(this.traveler);
    this.updateProgress(save);

    const ResizeObserverConstructor = container.ownerDocument.defaultView?.ResizeObserver;
    this.resizeObserver = ResizeObserverConstructor
      ? new ResizeObserverConstructor(() => this.resize())
      : null;
    this.resizeObserver?.observe(container);
    container.ownerDocument.defaultView?.addEventListener('resize', this.resize);
    this.resize();
  }

  rebuildRoute(level: LevelLayout, save: SaveView): void {
    this.scene.remove(this.worldRoot);
    disposeObject(this.worldRoot);
    const world = createWorld(level);
    this.worldRoot = world.root;
    this.memories = world.memories;
    this.scene.add(this.worldRoot);
    this.updateProgress(save);
  }

  updateProgress(save: SaveView): void {
    const recovered = new Set(save.recoveredIds);
    for (const [id, memory] of this.memories) memory.visible = !recovered.has(id);
    if (save.appearance.stage !== this.stage) this.setStage(save.appearance.stage);
  }

  adjustCamera(lookX: number, lookY: number, deltaSeconds: number, pointerX: number, pointerY: number): void {
    this.cameraYaw -= lookX * deltaSeconds * 1.8 + pointerX * 0.006;
    this.cameraPitch = THREE.MathUtils.clamp(
      this.cameraPitch + lookY * deltaSeconds * 1.25 + pointerY * 0.004,
      0.18,
      0.72,
    );
  }

  render(position: PositionSnapshot, facing: number, elapsedSeconds: number): void {
    if (this.disposed) return;
    this.traveler.position.set(position.x, position.y, position.z);
    this.traveler.rotation.y = facing;
    const dimensions = getAvatarProportions(this.stage);
    this.clockTarget.set(position.x, position.y + dimensions.cameraTargetHeight, position.z);
    const distance = 4.4;
    const horizontalDistance = Math.cos(this.cameraPitch) * distance;
    this.camera.position.set(
      position.x + Math.sin(this.cameraYaw) * horizontalDistance,
      position.y + dimensions.cameraTargetHeight + Math.sin(this.cameraPitch) * distance,
      position.z + Math.cos(this.cameraYaw) * horizontalDistance,
    );
    this.camera.lookAt(this.clockTarget);
    for (const memory of this.memories.values()) {
      memory.rotation.y = elapsedSeconds * 0.45;
      memory.position.y = Number(memory.userData.baseY) + Math.sin(elapsedSeconds * 1.8 + memory.position.z) * 0.045;
    }
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.resizeObserver?.disconnect();
    this.container.ownerDocument.defaultView?.removeEventListener('resize', this.resize);
    disposeObject(this.worldRoot);
    disposeObject(this.traveler);
    this.renderer.renderLists.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }

  private setStage(stage: AppearanceStage): void {
    const position = this.traveler.position.clone();
    const rotation = this.traveler.rotation.clone();
    this.scene.remove(this.traveler);
    disposeObject(this.traveler);
    this.traveler = createTraveler(stage);
    this.traveler.position.copy(position);
    this.traveler.rotation.copy(rotation);
    this.scene.add(this.traveler);
    this.stage = stage;
  }

  private readonly resize = (): void => {
    if (this.disposed) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(2, this.container.ownerDocument.defaultView?.devicePixelRatio ?? 1));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  };
}
