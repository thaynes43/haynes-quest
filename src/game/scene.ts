import { grassPlacements } from "./foliage";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { BestiesScene } from "./besties-scene";
import { CasinoScene } from "./casino-scene";
import type { CollectiblePlacement, CollectiblePlan } from "./casino-tokens";
import { EffectsScene } from "./effects-scene";
import { TokenScene } from "./token-scene";
import type { BestiesFrame, BestieActorId } from "./besties";
import { FriendlyScene } from "./friendly-scene";
import { ObbyScene } from "./obby-scene";
import type { ObbyCourse } from "./obby";
import type { AppearanceStage, SaveView } from "../shared/contracts";
import { getAvatarProportions } from "./controller";
import type { LevelLayout } from "./level";
import type {
  EnemyFrame,
  PositionSnapshot,
  SceneFrame,
  SceneMediaState,
  SceneVisualInspection,
} from "./types";
import { disposeTree, modelUrls, SceneAssets } from "./scene-assets";
import {
  createEncounterStudy,
  groundRing,
  material,
  shapeMesh,
} from "./scene-art";
import { equipmentArtwork, parodyArtwork } from "./scene-catalog";
import { EnemyAnimation } from "./enemy-animation";
import { enemyAttackRange } from "./combat";
import { bossRequiresOrdinaryDefeats } from "../shared/encounter-availability";
import { growthCameraScale } from "../shared/abilities";
import { TravelerEquipment } from "./traveler-equipment";
import {
  resolveRuntimeWorldTheme,
  type RuntimeWorldTheme,
} from "./world-themes";

type PhotoState = {
  url: string;
  attempts: number;
  loading: boolean;
  failed: boolean;
  loaded: boolean;
  timer?: ReturnType<typeof setTimeout>;
  controller?: AbortController;
  objectUrl?: string;
};
type EncounterVisual = {
  root: THREE.Group;
  model: THREE.Group;
  warning: THREE.Mesh;
  marker: THREE.Mesh;
  hp: THREE.Mesh;
  boss: boolean;
  lastHp: number;
  hitUntil: number;
  authored: boolean;
  animation?: EnemyAnimation;
  besties?: BestiesScene;
};

function setInstanceTransform(
  mesh: THREE.InstancedMesh,
  index: number,
  dummy: THREE.Object3D,
  position: readonly [number, number, number],
  scale: readonly [number, number, number],
  rotationY = 0,
): void {
  dummy.position.set(...position);
  dummy.rotation.set(0, rotationY, 0);
  dummy.scale.set(...scale);
  dummy.updateMatrix();
  mesh.setMatrixAt(index, dummy.matrix);
}

function finishInstances(mesh: THREE.InstancedMesh): void {
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
}

export class GardenScene {
  readonly canvas: HTMLCanvasElement;
  cameraYaw = 0;
  cameraPitch = 0.4;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(48, 1, 0.08, 100);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly assets = new SceneAssets();
  private readonly environment: THREE.WebGLRenderTarget;
  private obbyVisual: ObbyScene | null = null;
  private friendlyVisual: FriendlyScene | null = null;
  private casinoVisual: CasinoScene | null = null;
  private readonly resizeObserver: ResizeObserver | null;
  private readonly sun = new THREE.DirectionalLight(0xffedce, 2.1);
  private readonly target = new THREE.Vector3();
  private readonly desiredCamera = new THREE.Vector3();
  private world = new THREE.Group();
  private traveler = new THREE.Group();
  private avatarVisual = new THREE.Group();
  private equipment: TravelerEquipment | null = null;
  private avatarRoot: THREE.Group | null = null;
  private visualTime = 0;
  private guardRing = groundRing(0.67, 0xadcfe2, 0.8);
  private slash: THREE.Mesh;
  private readonly spell = new THREE.Group();
  private readonly spellCore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.065, 1, 8),
    new THREE.MeshBasicMaterial({
      color: 0xf4eaff,
      transparent: true,
      depthWrite: false,
    }),
  );
  private readonly spellGlow = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.14, 1, 8),
    new THREE.MeshBasicMaterial({
      color: 0xad78ff,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  private readonly spellImpact = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.17, 1),
    new THREE.MeshBasicMaterial({
      color: 0xffedab,
      transparent: true,
      depthWrite: false,
    }),
  );
  private particles: THREE.Points | null = null;
  private memories = new Map<string, THREE.Group>();
  private photos = new Map<string, PhotoState>();
  private pickups = new Map<string, THREE.Group>();
  private enemies = new Map<string, EncounterVisual>();
  private stage: AppearanceStage;
  private save: SaveView;
  private mixer: THREE.AnimationMixer | null = null;
  private clips = new Map<string, THREE.AnimationAction>();
  private currentClip = "";
  private routeGeneration = 0;
  private avatarGeneration = 0;
  private disposed = false;
  private cameraPlaced = false;
  private previousAttack = false;
  private lastAttackSequence = -1;
  private attackAt = -10;
  private secondaryAt = -10;
  private previousSecondary = false;
  private unsupportedContentCount = 0;
  private readonly effects = new EffectsScene();
  private tokens: TokenScene | null = null;
  /** Smoothed camera position; shake is added on top so it never accumulates. */
  private readonly cameraRig = new THREE.Vector3();
  private wasGrounded = true;
  /** Visual time of a predicted contact per enemy, to skip the confirming flinch. */
  private readonly anticipated = new Map<string, number>();

  constructor(
    private readonly container: HTMLElement,
    level: LevelLayout,
    save: SaveView,
  ) {
    this.save = save;
    this.stage = save.appearance.stage;
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.canvas = this.renderer.domElement;
    this.canvas.dataset.questCanvas = "true";
    Object.assign(this.canvas.style, {
      display: "block",
      width: "100%",
      height: "100%",
      touchAction: "none",
    });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    const room = new RoomEnvironment();
    const generator = new THREE.PMREMGenerator(this.renderer);
    this.environment = generator.fromScene(room, 0.04);
    this.scene.environment = this.environment.texture;
    this.scene.environmentIntensity = 0.3;
    room.dispose();
    generator.dispose();
    container.append(this.canvas);
    this.scene.add(new THREE.HemisphereLight(0xfff5e5, 0x607c8c, 1.15));
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, {
      left: -11,
      right: 11,
      top: 13,
      bottom: -13,
      near: 0.5,
      far: 40,
    });
    this.sun.shadow.bias = -0.00025;
    this.sun.shadow.normalBias = 0.025;
    this.scene.add(this.sun, this.sun.target);
    this.scene.add(this.traveler);
    this.traveler.add(this.avatarVisual, this.guardRing);
    this.guardRing.visible = false;
    this.slash = shapeMesh(
      new THREE.TorusGeometry(0.9, 0.024, 5, 36, Math.PI * 1.2),
      new THREE.MeshBasicMaterial({
        color: 0xffdc8b,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
      }),
    );
    this.slash.rotation.x = Math.PI / 2;
    this.slash.position.set(0, 0.5, -0.3);
    this.slash.visible = false;
    this.traveler.add(this.slash);
    this.spell.add(this.spellCore, this.spellGlow, this.spellImpact);
    this.spell.visible = false;
    this.scene.add(this.spell);
    this.scene.add(this.effects.root);
    this.loadTraveler();
    this.rebuildRoute(level, save);
    const Observer = container.ownerDocument.defaultView?.ResizeObserver;
    this.resizeObserver = Observer ? new Observer(() => this.resize()) : null;
    this.resizeObserver?.observe(container);
    container.ownerDocument.defaultView?.addEventListener(
      "resize",
      this.resize,
    );
    this.resize();
  }

  rebuildRoute(level: LevelLayout, save: SaveView): void {
    this.routeGeneration += 1;
    this.unsupportedContentCount = 0;
    this.save = save;
    for (const photo of this.photos.values()) {
      if (photo.timer) clearTimeout(photo.timer);
      photo.controller?.abort();
      if (photo.objectUrl) URL.revokeObjectURL(photo.objectUrl);
    }
    this.photos.clear();
    this.memories.clear();
    this.pickups.clear();
    for (const enemy of this.enemies.values()) {
      enemy.animation?.dispose();
      enemy.besties?.dispose();
    }
    this.enemies.clear();
    this.effects.clear();
    this.anticipated.clear();
    this.tokens?.dispose();
    this.tokens = null;
    this.obbyVisual = null;
    this.friendlyVisual?.dispose();
    this.friendlyVisual = null;
    this.casinoVisual?.dispose();
    this.casinoVisual = null;
    this.scene.remove(this.world);
    disposeTree(this.world);
    this.particles = null;
    this.world = new THREE.Group();
    this.world.name = `era-world-${save.adventure?.activeLevel?.eraYear ?? "complete"}`;
    this.scene.add(this.world);
    this.cameraYaw = 0;
    this.cameraPitch = 0.4;
    this.cameraPlaced = false;
    const period = save.adventure?.activeLevel?.periodId;
    const later = period
      ? period === "remix-runway-v1" ||
        period === "remix-runway-v2" ||
        period === "besties-obby-v1"
      : (save.adventure?.activeLevel?.eraYear ?? 2020) >= 2024;
    const worldTheme = resolveRuntimeWorldTheme(level.authored, later);
    const palette = worldTheme.palette;
    const environmentAssets = worldTheme.environment.assets;
    this.world.userData.worldTheme = worldTheme.id;
    this.world.userData.environmentKitState = worldTheme.environment.state;
    const sky = level.course ? worldTheme.course.sky : palette.sky;
    this.scene.background = new THREE.Color(sky);
    this.scene.fog = new THREE.Fog(sky, 20, 52);
    this.sun.color.setHex(
      level.course ? worldTheme.course.light : palette.light,
    );
    this.renderer.toneMappingExposure = worldTheme.course.exposure;
    const routeCenterX = level.authored ? (level.minX + level.maxX) / 2 : 0;
    const routeCenterZ = level.authored ? (level.minZ + level.maxZ) / 2 : -13;
    const routeDepth = level.authored ? level.maxZ - level.minZ : 30;
    const routeWidth = level.authored ? level.maxX - level.minX : 12;
    const generation = this.routeGeneration;
    const valid = () => !this.disposed && generation === this.routeGeneration;
    const ground = shapeMesh(
      new THREE.PlaneGeometry(
        level.authored ? routeWidth + 40 : 64,
        level.authored ? routeDepth + 50 : 110,
        48,
        80,
      ),
      material(level.course ? worldTheme.course.ground : palette.grass),
      [routeCenterX, level.course ? -1.4 : -0.045, routeCenterZ],
    );
    ground.rotation.x = -Math.PI / 2;
    ground.castShadow = false;
    this.world.add(ground);
    if (level.course) {
      this.obbyVisual = new ObbyScene(level.course, worldTheme.obby);
      this.world.add(this.obbyVisual.root);
      for (const side of [-1, 1])
        this.world.add(
          shapeMesh(
            new THREE.BoxGeometry(
              16,
              1.4,
              level.authored ? routeDepth + 35 : 80,
            ),
            material(palette.grass),
            [
              level.authored
                ? side < 0
                  ? level.minX - 8
                  : level.maxX + 8
                : side * 17.5,
              -0.7,
              routeCenterZ,
            ],
          ),
        );
    }
    const pathPlacements: THREE.Matrix4[] = [];
    if (level.authored && level.course) {
      for (const platform of level.course.platforms) {
        if (
          platform.motion ||
          !worldTheme.usesPathTiles ||
          platform.size.x < 4 ||
          platform.center.y + platform.size.y / 2 > 0.01
        )
          continue;
        const near = platform.center.z + platform.size.z / 2 - 1;
        const far = platform.center.z - platform.size.z / 2 + 1;
        for (let z = far; z <= near; z += 2.2) {
          const tile = new THREE.Object3D();
          tile.position.set(platform.center.x, -0.012, z);
          tile.updateMatrix();
          pathPlacements.push(tile.matrix.clone());
        }
      }
    } else {
      for (let z = 4; z >= -26; z -= 2) {
        const xs = z < -18 ? [-2, 0, 2] : [Math.sin(z * 0.22) * 0.45];
        for (const x of xs) {
          if (
            level.course &&
            (!worldTheme.usesPathTiles ||
              !this.onIsland(level.course, x, z, 1.05))
          )
            continue;
          const tile = new THREE.Group();
          tile.position.set(x, -0.012, z);
          tile.rotation.y = z % 4 ? Math.PI : 0;
          tile.updateMatrix();
          pathPlacements.push(tile.matrix.clone());
        }
      }
    }
    if (environmentAssets)
      this.assets.attachInstances(
        environmentAssets.path,
        this.world,
        pathPlacements,
        valid,
        {
          castShadow: false,
        },
      );
    const groundColor = new THREE.Color(
      level.course ? worldTheme.course.ground : palette.grass,
    );
    const groundPositions = ground.geometry.getAttribute("position");
    const colors = new Float32Array(groundPositions.count * 3);
    for (let i = 0; i < groundPositions.count; i++) {
      const x = groundPositions.getX(i),
        y = groundPositions.getY(i);
      const variation =
        0.88 +
        (Math.sin(x * 0.44 + Math.cos(y * 0.3)) + Math.cos(y * 0.7 + x * 0.2)) *
          0.065;
      const color = groundColor.clone().multiplyScalar(variation);
      colors.set([color.r, color.g, color.b], i * 3);
    }
    ground.geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    (ground.material as THREE.MeshStandardMaterial).color.setHex(0xffffff);
    (ground.material as THREE.MeshStandardMaterial).vertexColors = true;
    // Repeat the catalog geometry in batches while preserving every placement.
    const treePlacements: THREE.Matrix4[] = [];
    const stonePlacements: THREE.Matrix4[] = [];
    for (let i = 0; i < (level.authored ? 28 : 16); i++) {
      const side = i % 2 ? 1 : -1;
      const tree = new THREE.Group();
      tree.position.set(
        level.authored
          ? (side < 0 ? level.minX - 2 : level.maxX + 2) + side * (i % 3) * 0.85
          : side * ((level.course ? 10.1 : 7.1) + (i % 3) * 0.85),
        0,
        level.authored
          ? level.maxZ - (Math.floor(i / 2) * routeDepth) / 13
          : 4 - Math.floor(i / 2) * 4.8,
      );
      tree.scale.setScalar(1.1 + (i % 4) * 0.13);
      tree.rotation.y = i * 1.7;
      tree.updateMatrix();
      treePlacements.push(tree.matrix.clone());
      if (i % 2 === 0) {
        const stone = new THREE.Group();
        stone.position.set(
          level.authored
            ? side > 0
              ? level.minX - 1
              : level.maxX + 1
            : -side * (level.course ? 9.9 : 6.5),
          -0.04,
          tree.position.z - 2.2,
        );
        stone.rotation.y = i * 2.1;
        stone.scale.setScalar(0.8 + (i % 3) * 0.1);
        stone.updateMatrix();
        stonePlacements.push(stone.matrix.clone());
      }
    }
    // Keep large landing areas planted while preserving activity and resident clearances.
    if (level.authored && level.course) {
      const anchors = [
        ...level.memories,
        ...level.pickups,
        ...level.encounters,
        ...(level.friendlies ?? []),
      ].map((entry) => entry.position);
      for (const platform of level.course.platforms) {
        if (platform.motion || platform.size.x < 9 || platform.size.z < 6)
          continue;
        for (const side of [-1, 1]) {
          const x = platform.center.x + side * (platform.size.x / 2 - 0.55);
          const z = platform.center.z + platform.size.z / 2 - 1.1;
          if (
            anchors.some(
              (anchor) => Math.hypot(anchor.x - x, anchor.z - z) < 2.5,
            )
          )
            continue;
          const planting = new THREE.Object3D();
          planting.position.set(x, platform.center.y + platform.size.y / 2, z);
          planting.rotation.y = side * z * 0.35;
          planting.scale.setScalar(worldTheme.environmentScale);
          planting.updateMatrix();
          treePlacements.push(planting.matrix.clone());
        }
      }
    } else {
      // Bring the existing canopy into view without filling the route or jump gaps.
      if (level.course) {
        for (const z of [1.7, -5.5, -11.7, -25.2]) {
          for (const side of [-1, 1]) {
            const planting = new THREE.Object3D();
            planting.position.set(side * 5.55, 0, z);
            planting.rotation.y = side * z * 0.35;
            planting.scale.setScalar(worldTheme.environmentScale);
            planting.updateMatrix();
            treePlacements.push(planting.matrix.clone());
          }
        }
      }
    }
    if (environmentAssets) {
      this.assets.attachInstances(
        environmentAssets.tree,
        this.world,
        treePlacements,
        valid,
      );
      this.assets.attachInstances(
        environmentAssets.stone,
        this.world,
        stonePlacements,
        valid,
      );
    }
    if (worldTheme.environment.state === "pending-kit") {
      this.addPendingWorldScenery(worldTheme, level);
    } else if (worldTheme.environment.state === "prepared-kit") {
      this.casinoVisual = new CasinoScene(
        level,
        this.assets,
        valid,
        period === "rat-casino-v1" &&
          !save.adventure?.activeLevel?.encounters.some(
            (enemy) => enemy.content?.assetId === "golden-after-hours-rat",
          ),
      );
      this.world.add(this.casinoVisual.root);
    } else {
      for (let i = 0; i < (level.authored ? 12 : 8); i++) {
        const hill = shapeMesh(
          new THREE.SphereGeometry(5 + (i % 3), 16, 8),
          material(i % 2 ? palette.leaf : palette.mist),
          [
            level.authored
              ? i % 2
                ? level.maxX + 10
                : level.minX - 10
              : (i % 2 ? 1 : -1) * (16 + (i % 3)),
            -2,
            level.authored
              ? level.maxZ - (Math.floor(i / 2) * routeDepth) / 5
              : 10 - Math.floor(i / 2) * 14,
          ],
        );
        hill.name = `outdoor-hill-${i + 1}`;
        hill.scale.y = 0.7;
        hill.castShadow = false;
        hill.receiveShadow = false;
        this.world.add(hill);
      }
      this.addMeadow(
        worldTheme.meadow,
        level.course,
        level.authored ? level : undefined,
      );
    }
    if (!level.course) this.addEraDetails(later);
    const gate = new THREE.Group();
    gate.position.set(level.finish.x, level.finish.y, level.finish.z);
    gate.scale.setScalar(worldTheme.environment.state === "prepared-kit" ? 1 : 1.4);
    this.world.add(gate);
    if (environmentAssets)
      this.assets.attach(environmentAssets.gate, gate, valid);
    else if (worldTheme.environment.state === "prepared-kit") {
      gate.name = "casino-exit-arch";
      this.assets.attach(
        "/studio/assets/media/rat-casino-kit/v001/marquee-arch.glb",
        gate,
        valid,
      );
    }
    else this.addPendingEnvironmentMarker(gate, worldTheme);
    for (const placement of level.memories) {
      const memory = new THREE.Group();
      memory.position.set(
        placement.position.x,
        placement.position.y,
        placement.position.z,
      );
      memory.rotation.y = Math.PI;
      memory.scale.setScalar(1.7);
      memory.name = `memory-${placement.id}`;
      this.world.add(memory);
      this.memories.set(placement.id, memory);
      this.assets.attach(modelUrls.keepsake, memory, valid, () =>
        this.updateProgress(this.save),
      );
      const ring = groundRing(0.55, palette.accent, 0.6);
      memory.add(ring);
    }
    for (const placement of level.pickups) {
      const data = save.adventure?.activeLevel?.pickups.find(
        (item) => item.pickupId === placement.id,
      );
      const pickup = new THREE.Group();
      pickup.position.copy(placement.position);
      const display = new THREE.Group();
      const artwork = equipmentArtwork(placement.kind, data?.tier ?? 1);
      this.assets.attach(artwork.url, display, valid);
      display.name = "display";
      display.position.y = 0.85;
      pickup.add(display, groundRing(0.53, 0xffd78c));
      this.world.add(pickup);
      this.pickups.set(placement.id, pickup);
    }
    this.friendlyVisual = new FriendlyScene(level, this.assets, valid);
    this.world.add(this.friendlyVisual.root);
    for (const placement of level.encounters) {
      const root = new THREE.Group();
      root.position.copy(placement.position);
      const content = save.adventure?.activeLevel?.encounters.find(
        (item) => item.id === placement.id,
      )?.content;
      const artwork = content ? parodyArtwork(content) : null;
      if (content && !artwork && content.placeholder !== "neutral-candidate-v1")
        this.unsupportedContentCount += 1;
      const model = new THREE.Group();
      const fallback =
        artwork?.kind === "duo"
          ? null
          : createEncounterStudy(placement.kind, later);
      if (fallback) {
        fallback.name =
          content?.placeholder === "neutral-candidate-v1"
            ? "enemy-candidate-placeholder"
            : "encounter-artwork-fallback";
        model.add(fallback);
      }
      root.add(model);
      const boss = placement.role === "boss";
      const warning = groundRing(enemyAttackRange(placement.role), 0xed735d);
      root.add(warning);
      warning.visible = false;
      const marker = groundRing(boss ? 0.9 : 0.5, 0xffdea0, 0.5);
      root.add(marker);
      marker.visible = false;
      const hp = shapeMesh(
        new THREE.PlaneGeometry(boss ? 1.1 : 0.65, 0.065),
        new THREE.MeshBasicMaterial({
          color: 0xf0c778,
          side: THREE.DoubleSide,
        }),
        [0, artwork ? artwork.height + 0.2 : boss ? 2.25 : 1.45, 0],
      );
      root.add(hp);
      this.world.add(root);
      const visual: EncounterVisual = {
        root,
        model,
        warning,
        marker,
        hp,
        boss,
        lastHp: -1,
        hitUntil: 0,
        authored: Boolean(artwork),
      };
      this.enemies.set(placement.id, visual);
      if (artwork?.kind === "duo") {
        visual.besties = new BestiesScene(this.assets, valid, artwork.models);
        model.add(visual.besties.root);
      } else if (artwork)
        this.assets.attach(artwork.url, model, valid, (loaded, clips) => {
          visual.animation = new EnemyAnimation(
            loaded,
            clips,
            artwork.contactFraction,
          );
          if (fallback) {
            fallback.removeFromParent();
            disposeTree(fallback);
          }
        });
    }
    this.updateProgress(save);
  }

  updateProgress(save: SaveView): void {
    if (this.disposed) return;
    this.save = save;
    this.friendlyVisual?.sync(save);
    for (const [id, root] of this.memories) {
      const memory = save.memories.find((item) => item.id === id);
      root.visible = Boolean(
        memory &&
        (memory.state === "released" ||
          (!save.adventure?.activeLevel?.majorMemoryId &&
            memory.state === "revealed")),
      );
      if (!memory?.mediaUrl || !root.visible) continue;
      let picture: THREE.Mesh | undefined;
      root.traverse((object) => {
        if (
          object instanceof THREE.Mesh &&
          (object.name === "PhotoSurface" ||
            (Array.isArray(object.material)
              ? object.material
              : [object.material]
            ).some((mat) => mat.name === "PhotoSurface"))
        )
          picture = object;
      });
      if (!picture) continue;
      const prior = this.photos.get(id);
      if (
        prior?.url === memory.mediaUrl &&
        (prior.loaded || prior.loading || prior.failed || prior.timer)
      )
        continue;
      const state: PhotoState = {
        url: memory.mediaUrl,
        attempts: 0,
        loading: false,
        failed: false,
        loaded: false,
      };
      this.photos.set(id, state);
      this.loadPhoto(id, picture, state);
    }
    for (const [id, pickup] of this.pickups)
      pickup.visible = !save.adventure?.activeLevel?.pickups.find(
        (item) => item.pickupId === id,
      )?.collected;
    if (save.appearance.stage !== this.stage) {
      this.stage = save.appearance.stage;
      this.loadTraveler();
    }
    this.equipment?.update(
      save.adventure?.inventory ?? [],
      save.adventure?.equippedId ?? null,
    );
  }

  getMediaState(): SceneMediaState {
    const assets = this.assets.getState();
    const state: SceneMediaState & { reloadRequired?: boolean } = {
      loading:
        assets.loading +
        [...this.photos.values()].filter((item) => item.loading || item.timer)
          .length,
      failed:
        assets.failed +
        [...this.photos.values()].filter((item) => item.failed).length +
        this.unsupportedContentCount,
      reloadRequired: false,
    };
    return state;
  }

  inspectVisuals(): SceneVisualInspection {
    const besties = [...this.enemies.values()].flatMap(
      (enemy) => enemy.besties?.inspectVisuals() ?? [],
    );
    return {
      memories: [...this.memories.entries()].map(([id, root]) => ({
        id,
        visible: root.visible,
      })),
      ...(besties.length > 0 ? { besties } : {}),
      ...(this.tokens ? { collectibles: this.tokens.inspect() } : {}),
      particles: this.effects.aliveCount,
    };
  }

  /** Shows a level's casino tokens and tickets; `null` removes them. */
  setCollectibles(
    plan: CollectiblePlan | null,
    collected: ReadonlySet<string> = new Set(),
  ): void {
    if (this.disposed) return;
    this.tokens?.dispose();
    this.tokens = plan ? new TokenScene(plan, collected) : null;
    if (this.tokens) this.world.add(this.tokens.root);
  }

  /** Pops a touched token or ticket with a sparkle. */
  collectItem(item: CollectiblePlacement): void {
    const at = this.tokens?.collect(item.id, this.visualTime);
    if (at) this.effects.emit(item.kind === "ticket" ? "ticket" : "token", at);
  }

  /** Squashes a v4 bounce pad that just launched the player (DESIGN-025). */
  bouncePad(platformId: string): void {
    this.obbyVisual?.squash(platformId, this.visualTime);
  }

  /**
   * Marks a swing the client has accepted. The server's confirming HP drop
   * for this enemy then doesn't replay the flinch that contact already played.
   */
  expectHit(encounterId: string): void {
    this.anticipated.set(encounterId, this.visualTime);
    this.enemies.get(encounterId)?.animation?.expectHit();
  }

  /** Plays contact now: the target at `at` flinches and sparks fly. */
  anticipateHit(encounterId: string, at: PositionSnapshot): void {
    const visual = this.enemies.get(encounterId);
    if (visual && !visual.besties) {
      visual.hitUntil = this.visualTime + 0.2;
      visual.animation?.anticipateHit();
    }
    // Sparks leave the side facing the traveler, where the swing lands,
    // rather than from inside the target's body.
    const towardX = this.traveler.position.x - at.x;
    const towardZ = this.traveler.position.z - at.z;
    const distance = Math.hypot(towardX, towardZ);
    const surface = distance > 0 ? Math.min(0.45, distance / 2) / distance : 0;
    this.effects.emit("hit", {
      x: at.x + towardX * surface,
      y: at.y + 0.9,
      z: at.z + towardZ * surface,
    });
  }

  /** A confetti burst where an enemy was defeated. */
  celebrate(encounterId: string, boss: boolean): void {
    const visual = this.enemies.get(encounterId);
    if (!visual) return;
    const { x, y, z } = visual.root.position;
    this.effects.emit(boss ? "boss-defeat" : "defeat", { x, y: y + 1, z });
  }

  retryMedia(): void {
    this.assets.retry();
    for (const [id, state] of this.photos)
      if (state.failed) {
        state.failed = false;
        this.photos.delete(id);
      }
    this.updateProgress(this.save);
  }

  adjustCamera(
    lookX: number,
    lookY: number,
    deltaSeconds: number,
    pointerX: number,
    pointerY: number,
  ): void {
    this.cameraYaw -= lookX * deltaSeconds * 1.8 + pointerX * 0.006;
    this.cameraPitch = THREE.MathUtils.clamp(
      this.cameraPitch + lookY * deltaSeconds * 1.25 + pointerY * 0.004,
      0.3,
      0.85,
    );
  }

  render(
    position: PositionSnapshot,
    facing: number,
    _elapsed: number,
    frame?: SceneFrame,
  ): void {
    if (this.disposed) return;
    // Hit-stop holds animation time only; the camera follows in real time.
    const dt = frame?.visualDeltaSeconds ?? frame?.deltaSeconds ?? 0;
    const realDt = frame?.deltaSeconds ?? dt;
    const elapsed = (this.visualTime += dt);
    if (frame?.obby)
      this.obbyVisual?.update(
        frame.obby,
        frame.checkpointId ?? null,
        this.visualTime,
      );
    (this.guardRing.material as THREE.MeshBasicMaterial).opacity =
      frame?.recovering ? 0.6 : 0.8;
    this.traveler.position.set(position.x, position.y, position.z);
    const grounded = frame?.grounded ?? true;
    if (grounded && !this.wasGrounded && !frame?.recovering)
      this.effects.emit("landing", position);
    this.wasGrounded = grounded;
    this.traveler.rotation.y = facing;
    const newAttack =
      frame?.attackSequence !== undefined &&
      frame.attackSequence !== this.lastAttackSequence;
    if (frame?.attacking && (newAttack || !this.previousAttack))
      this.attackAt = elapsed;
    this.previousAttack = frame?.attacking ?? false;
    const attackTime = elapsed - this.attackAt;
    if (frame?.secondaryAttacking && (newAttack || !this.previousSecondary))
      this.secondaryAt = elapsed;
    this.previousSecondary = frame?.secondaryAttacking ?? false;
    this.lastAttackSequence = frame?.attackSequence ?? -1;
    const secondaryTime = elapsed - this.secondaryAt;
    const attackLean = Math.sin(
      Math.min(1, Math.max(0, attackTime / 0.38)) * Math.PI,
    );
    const secondaryLean = Math.sin(
      Math.min(1, Math.max(0, secondaryTime / 0.4)) * Math.PI,
    );
    this.avatarVisual.rotation.x = -0.15 * (attackLean + secondaryLean);
    this.avatarVisual.rotation.z = 0.1 * (attackLean - secondaryLean);
    const airborneStretch = frame && !frame.grounded ? 1.06 : 1;
    this.avatarVisual.scale.set(
      1 / Math.sqrt(airborneStretch),
      airborneStretch,
      1 / Math.sqrt(airborneStretch),
    );
    // DESIGN-025 D-02: growth levels scale the visual only; the collider and
    // every older level's presentation are unchanged.
    if (frame?.growthScale !== undefined)
      this.avatarVisual.scale.multiplyScalar(frame.growthScale);
    const ranged =
      (this.save.adventure?.inventory.find(
        (item) => item.id === this.save.adventure?.equippedId,
      )?.tier ?? 1) > 1;
    this.slash.visible = (!ranged && attackTime < 0.38) || secondaryTime < 0.4;
    this.slash.rotation.z = -1.3 + attackTime * 12;
    this.slash.position.y = this.stage === "infant" ? 0.45 : 0.78;
    this.guardRing.visible = Boolean(frame?.guarding || frame?.recovering);
    const spellTarget =
      (frame?.attackTargetId
        ? this.enemies
            .get(frame.attackTargetId)
            ?.besties?.targetPosition(position)
        : null) ??
      frame?.enemies.find((enemy) => enemy.id === frame.attackTargetId)
        ?.position ??
      (frame?.attackTargetId
        ? this.friendlyVisual?.targetPosition(frame.attackTargetId)
        : null);
    this.spell.visible = Boolean(
      ranged && spellTarget && attackTime >= 0 && attackTime < 0.28,
    );
    if (this.spell.visible && spellTarget) {
      const origin = new THREE.Vector3(
        position.x,
        position.y + 0.78,
        position.z,
      );
      const destination = new THREE.Vector3(
        spellTarget.x,
        spellTarget.y + 0.75,
        spellTarget.z,
      );
      const direction = destination.sub(origin);
      const distanceToTarget = direction.length();
      if (distanceToTarget > 0.001) {
        direction.divideScalar(distanceToTarget);
        origin.addScaledVector(
          direction,
          Math.min(0.35, distanceToTarget * 0.2),
        );
        this.spell.position.copy(origin);
        this.spell.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          direction,
        );
        const length = Math.max(
          0.01,
          (distanceToTarget - 0.35) * Math.min(1, attackTime / 0.09),
        );
        for (const mesh of [this.spellCore, this.spellGlow]) {
          mesh.position.y = length / 2;
          mesh.scale.y = length;
        }
        const fade = Math.min(1, (0.28 - attackTime) / 0.1);
        this.spellCore.material.opacity = fade;
        this.spellGlow.material.opacity = fade * 0.3;
        this.spellImpact.position.y = length;
        this.spellImpact.scale.setScalar(0.7 + Math.sin(attackTime * 22) * 0.3);
        this.spellImpact.material.opacity = fade;
      }
    }

    const desiredClip =
      !frame?.grounded && this.clips.has("jump")
        ? "jump"
        : frame?.interacting && this.clips.has("interact")
          ? "interact"
          : frame?.moving
            ? "move"
            : "idle";
    this.equipment?.resetPose();
    this.playClip(desiredClip);
    this.clips.get("move")?.setEffectiveTimeScale(1.3);
    this.mixer?.update(dt);
    this.equipment?.pose(attackTime, frame?.guarding ?? false, secondaryTime);
    const dimensions = getAvatarProportions(this.stage);
    this.target.set(
      position.x,
      position.y + dimensions.cameraTargetHeight + 0.3,
      position.z - 0.5,
    );
    const duoInView = frame?.besties && frame.besties.phase !== "inactive";
    const baseDistance =
      this.camera.aspect < 0.85 ? (duoInView ? 8.6 : 6.2) : 4.9;
    const distance =
      frame?.growthScale !== undefined
        ? baseDistance * growthCameraScale(frame.growthScale)
        : baseDistance;
    const flat = Math.cos(this.cameraPitch) * distance;
    this.desiredCamera.set(
      position.x + Math.sin(this.cameraYaw) * flat,
      position.y +
        dimensions.cameraTargetHeight +
        Math.sin(this.cameraPitch) * distance,
      position.z + Math.cos(this.cameraYaw) * flat,
    );
    if (this.cameraPlaced)
      this.cameraRig.lerp(this.desiredCamera, 1 - Math.exp(-realDt * 14));
    else this.cameraRig.copy(this.desiredCamera);
    this.cameraPlaced = true;
    this.camera.position.copy(this.cameraRig);
    const shake = frame?.cameraShake;
    if (shake) {
      this.camera.position.x += shake.x;
      this.camera.position.y += shake.y;
      this.camera.position.z += shake.z;
    }
    this.camera.lookAt(this.target);
    this.sun.position.set(position.x - 7, 13, position.z + 6);
    this.sun.target.position.set(position.x, 0, position.z - 4);
    for (const pickup of this.pickups.values()) {
      const display = pickup.getObjectByName("display");
      if (display) {
        display.rotation.y = elapsed * 0.65;
        display.position.y =
          0.8 + Math.sin(elapsed * 2 + pickup.position.z) * 0.08;
      }
    }
    this.friendlyVisual?.update(dt, elapsed, position, this.camera);
    this.casinoVisual?.update(dt);
    for (const enemy of frame?.enemies ?? [])
      this.animateEnemy(
        enemy,
        elapsed,
        frame?.currentTarget === enemy.id,
        dt,
        frame?.besties,
        frame?.bestiesHitActorId,
        position,
      );
    if (this.particles)
      this.particles.rotation.y = Math.sin(elapsed * 0.03) * 0.02;
    this.tokens?.update(elapsed);
    this.effects.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.routeGeneration++;
    this.avatarGeneration++;
    for (const state of this.photos.values()) {
      if (state.timer) clearTimeout(state.timer);
      state.controller?.abort();
      if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
    }
    this.photos.clear();
    this.resizeObserver?.disconnect();
    this.container.ownerDocument.defaultView?.removeEventListener(
      "resize",
      this.resize,
    );
    this.equipment?.dispose();
    this.equipment = null;
    this.friendlyVisual?.dispose();
    this.casinoVisual?.dispose();
    this.tokens?.dispose();
    this.tokens = null;
    this.effects.dispose();
    this.mixer?.stopAllAction();
    if (this.avatarRoot) this.mixer?.uncacheRoot(this.avatarRoot);
    this.avatarRoot = null;
    for (const enemy of this.enemies.values()) {
      enemy.animation?.dispose();
      enemy.besties?.dispose();
    }
    disposeTree(this.world);
    disposeTree(this.traveler);
    disposeTree(this.spell);
    this.assets.dispose();
    this.environment.dispose();
    this.renderer.renderLists.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }

  private loadTraveler(): void {
    const generation = ++this.avatarGeneration;
    this.equipment?.dispose();
    this.equipment = null;
    this.mixer?.stopAllAction();
    if (this.avatarRoot) this.mixer?.uncacheRoot(this.avatarRoot);
    this.avatarRoot = null;
    this.mixer = null;
    this.clips.clear();
    this.currentClip = "";
    this.traveler.remove(this.avatarVisual);
    disposeTree(this.avatarVisual);
    this.avatarVisual = new THREE.Group();
    this.traveler.add(this.avatarVisual);
    this.assets.attach(
      modelUrls[this.stage],
      this.avatarVisual,
      () => !this.disposed && generation === this.avatarGeneration,
      (root, clips) => {
        const required =
          this.stage === "child"
            ? ["idle", "move", "interact", "jump"]
            : ["idle", "move", "interact"];
        if (required.some((name) => !clips.some((clip) => clip.name === name)))
          throw new Error("Traveler is missing a required movement clip");
        const equipment = new TravelerEquipment(
          root,
          this.stage,
          this.assets,
          () => !this.disposed && generation === this.avatarGeneration,
        );
        this.avatarRoot = root;
        this.equipment = equipment;
        this.mixer = new THREE.AnimationMixer(root);
        for (const clip of clips) {
          const action = this.mixer.clipAction(clip);
          if (clip.name === "jump" || clip.name === "interact") {
            action.setLoop(THREE.LoopOnce, 1);
            action.clampWhenFinished = true;
          }
          this.clips.set(clip.name, action);
        }
        this.playClip("idle");
        this.equipment.update(
          this.save.adventure?.inventory ?? [],
          this.save.adventure?.equippedId ?? null,
        );
      },
    );
  }

  private playClip(name: string): void {
    if (name === this.currentClip) return;
    const next = this.clips.get(name) ?? this.clips.get("idle");
    if (!next) return;
    this.clips.get(this.currentClip)?.fadeOut(0.13);
    next.reset().fadeIn(0.13).play();
    this.currentClip = name;
  }

  private loadPhoto(id: string, picture: THREE.Mesh, state: PhotoState): void {
    const generation = this.routeGeneration;
    const valid = () =>
      !this.disposed &&
      generation === this.routeGeneration &&
      this.photos.get(id) === state;
    const releaseUrl = () => {
      if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
      state.objectUrl = undefined;
    };
    const failed = () => {
      releaseUrl();
      if (!valid()) return;
      state.loading = false;
      if (state.attempts < 3)
        state.timer = setTimeout(() => {
          state.timer = undefined;
          this.loadPhoto(id, picture, state);
        }, state.attempts * 1500);
      else state.failed = true;
    };
    state.loading = true;
    state.failed = false;
    state.attempts++;
    state.controller = new AbortController();
    // Fetch through the owned media route before decoding. A document-origin
    // blob also avoids opaque SVG origins when a browser uploads to WebGL.
    void fetch(state.url, {
      credentials: "same-origin",
      cache: "no-store",
      signal: state.controller.signal,
    })
      .then(async (response) => {
        if (
          !response.ok ||
          !response.headers.get("content-type")?.startsWith("image/")
        )
          throw new Error("MEDIA_UNAVAILABLE");
        const blob = await response.blob();
        if (!valid()) return;
        state.objectUrl = URL.createObjectURL(blob);
        new THREE.TextureLoader().load(
          state.objectUrl,
          (texture) => {
            releaseUrl();
            if (!valid()) {
              texture.dispose();
              return;
            }
            try {
              const image = texture.image as HTMLImageElement;
              picture.geometry.computeBoundingBox();
              const size = picture.geometry.boundingBox?.getSize(
                new THREE.Vector3(),
              );
              const width = 512;
              const height = Math.round(
                width * (size && size.x > 0 ? size.y / size.x : 0.506 / 0.308),
              );
              const canvas =
                this.container.ownerDocument.createElement("canvas");
              canvas.width = width;
              canvas.height = Math.max(1, Math.min(2048, height));
              const context = canvas.getContext("2d");
              if (!context || !image.naturalWidth || !image.naturalHeight)
                throw new Error("MEDIA_DECODE_FAILED");
              context.fillStyle = "#eadbbf";
              context.fillRect(0, 0, width, canvas.height);
              const scale = Math.min(
                width / image.naturalWidth,
                canvas.height / image.naturalHeight,
              );
              context.drawImage(
                image,
                (width - image.naturalWidth * scale) / 2,
                (canvas.height - image.naturalHeight * scale) / 2,
                image.naturalWidth * scale,
                image.naturalHeight * scale,
              );
              context.getImageData(0, 0, 1, 1);
              const photoTexture = new THREE.CanvasTexture(canvas);
              photoTexture.colorSpace = THREE.SRGBColorSpace;
              photoTexture.flipY = false;
              texture.dispose();
              const old = Array.isArray(picture.material)
                ? picture.material
                : [picture.material];
              for (const mat of old) mat.dispose();
              picture.material = new THREE.MeshStandardMaterial({
                color: 0xffffff,
                map: photoTexture,
                roughness: 0.95,
                vertexColors: false,
                side: THREE.DoubleSide,
              });
              state.loading = false;
              state.loaded = true;
            } catch {
              texture.dispose();
              failed();
            }
          },
          undefined,
          failed,
        );
      })
      .catch(failed);
  }

  private animateEnemy(
    enemy: EnemyFrame,
    elapsed: number,
    targeted: boolean,
    deltaSeconds: number,
    besties?: BestiesFrame,
    bestiesHitActorId?: BestieActorId | null,
    playerPosition?: PositionSnapshot,
  ): void {
    const visual = this.enemies.get(enemy.id);
    if (!visual) return;
    visual.root.position.set(
      enemy.position.x,
      enemy.position.y,
      enemy.position.z,
    );
    if (visual.besties && besties) {
      visual.besties.update(
        besties,
        deltaSeconds,
        enemy.hp,
        elapsed,
        bestiesHitActorId,
        playerPosition,
      );
      visual.model.rotation.y = 0;
      visual.warning.visible =
        visual.marker.visible =
        visual.hp.visible =
          false;
      return;
    }
    visual.model.rotation.y = enemy.facing;
    // Only routes that still gate the boss behind its ordinaries render it
    // dormant. Share the rule with combat and the server so a v2 boss is never
    // fought with a hidden health bar.
    const activeLevel = this.save.adventure?.activeLevel;
    const dormant =
      visual.boss &&
      bossRequiresOrdinaryDefeats(
        activeLevel?.routeId,
        activeLevel?.bossGate,
      ) &&
      activeLevel?.encounters.some(
        (item) => item.role === "ordinary" && !item.defeated,
      );
    const defeated = enemy.phase === "defeated";
    const animation = visual.animation?.update(enemy, deltaSeconds);
    visual.root.visible = animation?.visible ?? !defeated;
    if (enemy.hp < visual.lastHp) {
      // A predicted contact already flinched (or will at contact); don't repeat it.
      const predicted = this.anticipated.get(enemy.id);
      if (predicted === undefined || elapsed - predicted > 1.5)
        visual.hitUntil = elapsed + 0.2;
      this.anticipated.delete(enemy.id);
    }
    visual.lastHp = enemy.hp;
    visual.model.scale.setScalar(
      animation ? 1 - animation.vanish : elapsed < visual.hitUntil ? 0.9 : 1,
    );
    visual.marker.visible = targeted && !defeated;
    visual.warning.visible =
      enemy.phase === "windup" || enemy.phase === "strike";
    // Show the entire danger area from the start of the warning.
    visual.warning.scale.setScalar(1);
    (visual.warning.material as THREE.MeshBasicMaterial).opacity =
      enemy.phase === "strike" ? 1 : 0.4 + enemy.windupProgress * 0.5;
    visual.hp.visible = !dormant && enemy.hp < enemy.maxHp && !defeated;
    visual.hp.scale.x = Math.max(0.01, enemy.hp / enemy.maxHp);
    visual.hp.quaternion.copy(this.camera.quaternion);
    if (visual.authored) return;
    const motion = visual.model.getObjectByName("motion");
    if (motion) {
      motion.position.y =
        Math.sin(elapsed * (enemy.phase === "chasing" ? 8 : 2.3)) *
        (dormant ? 0.007 : 0.035);
      motion.rotation.z =
        enemy.phase === "windup"
          ? Math.sin(elapsed * 23) * enemy.windupProgress * 0.045
          : 0;
      motion.traverse((object) => {
        if (object.name.startsWith("wing-"))
          object.rotation.y = Math.sin(elapsed * 7) * 0.35;
        if (object.name === "halo")
          object.rotation.z = elapsed * (enemy.phase === "windup" ? 5 : 0.5);
        if (object.name.startsWith("arm-"))
          object.rotation.z =
            (object.position.x < 0 ? 1 : -1) *
            (enemy.phase === "windup" ? enemy.windupProgress * 1.2 : 0.05);
        if (
          object.name.startsWith("leg-") ||
          object.name.startsWith("dancer-leg-")
        )
          object.rotation.x =
            enemy.phase === "chasing"
              ? Math.sin(elapsed * 8 + object.position.x * 8) * 0.35
              : 0;
        if (object.name.startsWith("ribbon-") || object.name === "tail")
          object.rotation.y = Math.sin(elapsed * 3) * 0.35;
      });
    }
  }

  private onIsland(
    course: ObbyCourse,
    x: number,
    z: number,
    inset = 0,
  ): boolean {
    return course.platforms.some(
      (platform) =>
        !platform.motion &&
        Math.abs(x - platform.center.x) <= platform.size.x / 2 - inset &&
        Math.abs(z - platform.center.z) <= platform.size.z / 2 - inset,
    );
  }

  private addPendingWorldScenery(
    theme: RuntimeWorldTheme,
    level: LevelLayout,
  ): void {
    if (theme.environment.state !== "pending-kit") return;
    const root = new THREE.Group();
    root.name = `${theme.id}-pending-kit-placeholder-scenery`;
    root.userData.environmentKitState = theme.environment.state;
    root.userData.worldTheme = theme.id;
    if (theme.id === "arcade") this.addArcadePlaceholders(root, theme, level);
    if (theme.id === "toybox") this.addToyboxPlaceholders(root, theme, level);
    this.world.add(root);
  }

  private addArcadePlaceholders(
    root: THREE.Group,
    theme: RuntimeWorldTheme,
    level: LevelLayout,
  ): void {
    const rowFractions = [0.045, 0.12, 0.23, 0.38, 0.57, 0.78] as const;
    const cabinetCount = rowFractions.length * 2;
    const dummy = new THREE.Object3D();
    const silhouettes = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      material(0xffffff),
      cabinetCount * 3,
    );
    silhouettes.name = "arcade-cabinet-silhouettes";
    silhouettes.castShadow = true;
    const screenMaterial = material(theme.palette.light, theme.palette.light);
    screenMaterial.color.multiplyScalar(0.38);
    screenMaterial.emissiveIntensity = 0.32;
    const screens = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      screenMaterial,
      cabinetCount,
    );
    screens.name = "arcade-cabinet-honey-screens";
    const controls = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.08, 8, 6),
      material(theme.palette.accent),
      cabinetCount * 2,
    );
    controls.name = "arcade-cabinet-cherry-controls";

    const routeDepth = Math.max(1, level.maxZ - level.minZ);
    for (let index = 0; index < cabinetCount; index++) {
      const side = index % 2 === 0 ? -1 : 1;
      const row = Math.floor(index / 2);
      const z = level.maxZ - rowFractions[row]! * routeDepth;
      const x = this.pendingSidePosition(level, z, side, 0.55, 0.55);
      const facing = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      const bodyIndex = index * 3;
      setInstanceTransform(
        silhouettes,
        bodyIndex,
        dummy,
        [x, 0.08, z],
        [1, 0.16, 1.08],
        facing,
      );
      setInstanceTransform(
        silhouettes,
        bodyIndex + 1,
        dummy,
        [x, 0.72, z],
        [0.72, 1.44, 0.86],
        facing,
      );
      setInstanceTransform(
        silhouettes,
        bodyIndex + 2,
        dummy,
        [x, 1.56, z],
        [0.82, 0.3, 0.96],
        facing,
      );
      const cabinetColor = new THREE.Color(
        index % 4 < 2 ? theme.palette.grass : theme.palette.leaf,
      );
      silhouettes.setColorAt(bodyIndex, cabinetColor);
      silhouettes.setColorAt(bodyIndex + 1, cabinetColor);
      silhouettes.setColorAt(bodyIndex + 2, cabinetColor);
      const faceX = x + (side < 0 ? 0.45 : -0.45);
      setInstanceTransform(
        screens,
        index,
        dummy,
        [faceX, 1.08, z],
        [0.5, 0.48, 0.035],
        facing,
      );
      for (const controlSide of [-1, 1])
        setInstanceTransform(
          controls,
          index * 2 + (controlSide > 0 ? 1 : 0),
          dummy,
          [faceX + (side < 0 ? 0.025 : -0.025), 0.67, z + controlSide * 0.16],
          [1, 1, 1],
        );
    }
    finishInstances(silhouettes);
    finishInstances(screens);
    finishInstances(controls);

    const strings = 3;
    const bulbsPerString = 9;
    const lights = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.08, 8, 6),
      material(theme.palette.light, theme.palette.light),
      strings * bulbsPerString,
    );
    lights.name = "arcade-warm-string-lights";
    (lights.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.65;
    const highestSurface = Math.max(
      level.checkpoint.y,
      level.finish.y,
      ...(level.course?.platforms.map(
        (platform) => platform.center.y + platform.size.y / 2,
      ) ?? []),
    );
    const lightMinX = level.minX + Math.min(1, (level.maxX - level.minX) / 4);
    const lightMaxX = level.maxX - Math.min(1, (level.maxX - level.minX) / 4);
    let lightIndex = 0;
    for (let string = 0; string < strings; string++) {
      const z = level.maxZ - ((string + 1) * routeDepth) / (strings + 1);
      for (let bulb = 0; bulb < bulbsPerString; bulb++) {
        const across = bulb / (bulbsPerString - 1);
        setInstanceTransform(
          lights,
          lightIndex++,
          dummy,
          [
            THREE.MathUtils.lerp(lightMinX, lightMaxX, across),
            highestSurface + 3.2 - Math.sin(across * Math.PI) * 0.28,
            z,
          ],
          [1, 1, 1],
        );
      }
    }
    finishInstances(lights);
    const floorTiles = this.createPendingFloorTiles(
      "arcade-plum-floor-tiles",
      theme.palette.grass,
      level,
      112,
    );
    const guidance = this.createPendingRouteGuidance(
      "arcade-honey-route-guidance",
      theme.palette.light,
      level,
      48,
    );
    root.add(silhouettes, screens, controls, lights, floorTiles, guidance);
  }

  private addToyboxPlaceholders(
    root: THREE.Group,
    theme: RuntimeWorldTheme,
    level: LevelLayout,
  ): void {
    const dummy = new THREE.Object3D();
    const peachTransforms: Array<{
      position: [number, number, number];
      rotation: number;
    }> = [];
    const blueTransforms: typeof peachTransforms = [];
    const accents: Array<[number, number, number]> = [];
    const routeDepth = Math.max(1, level.maxZ - level.minZ);
    const rowFractions = [0.04, 0.14, 0.3, 0.55] as const;
    const towerCount = rowFractions.length * 2;
    for (let tower = 0; tower < towerCount; tower++) {
      const side = tower % 2 === 0 ? -1 : 1;
      const row = Math.floor(tower / 2);
      const baseZ = level.maxZ - rowFractions[row]! * routeDepth;
      const baseX = this.pendingSidePosition(level, baseZ, side, 0.7, 0.7);
      for (let layer = 0; layer < 3; layer++) {
        const transform = {
          position: [
            baseX + side * (layer % 2) * 0.12,
            0.38 + layer * 0.76,
            baseZ + (layer % 2 ? 0.12 : -0.1),
          ] as [number, number, number],
          rotation: (tower + layer) * 0.11,
        };
        (layer % 2 === 0 ? peachTransforms : blueTransforms).push(transform);
      }
      accents.push([baseX + side * 0.08, 2.72, baseZ]);
    }
    const createBlocks = (
      name: string,
      color: number,
      transforms: typeof peachTransforms,
    ): THREE.InstancedMesh => {
      const blocks = new THREE.InstancedMesh(
        new THREE.BoxGeometry(1, 1, 1),
        material(color),
        transforms.length,
      );
      blocks.name = name;
      blocks.castShadow = true;
      transforms.forEach((transform, index) =>
        setInstanceTransform(
          blocks,
          index,
          dummy,
          transform.position,
          [0.9, 0.72, 0.9],
          transform.rotation,
        ),
      );
      finishInstances(blocks);
      return blocks;
    };
    const peach = createBlocks(
      "toybox-soft-blocks-peach",
      theme.obby.platformSide,
      peachTransforms,
    );
    const blue = createBlocks(
      "toybox-soft-blocks-blue",
      theme.obby.platformRails ?? theme.palette.leaf,
      blueTransforms,
    );
    const honey = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.15, 10, 7),
      material(theme.palette.accent, theme.palette.accent),
      accents.length,
    );
    honey.name = "toybox-honey-accents";
    (honey.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3;
    accents.forEach((position, index) =>
      setInstanceTransform(honey, index, dummy, position, [1, 1, 1]),
    );
    finishInstances(honey);
    const floorTiles = this.createPendingFloorTiles(
      "toybox-blue-playmat-tiles",
      theme.obby.platformRails ?? theme.palette.leaf,
      level,
      92,
    );
    const guidance = this.createPendingRouteGuidance(
      "toybox-honey-route-guidance",
      theme.palette.accent,
      level,
      40,
    );
    root.add(peach, blue, honey, floorTiles, guidance);
  }

  private pendingSidePosition(
    level: LevelLayout,
    z: number,
    side: -1 | 1,
    halfWidth: number,
    halfDepth: number,
  ): number {
    let edge = level.checkpoint.x + side * 3.5;
    for (const platform of level.course?.platforms ?? []) {
      const motionX =
        platform.motion?.axis === "x" ? Math.abs(platform.motion.distance) : 0;
      const motionZ =
        platform.motion?.axis === "z" ? Math.abs(platform.motion.distance) : 0;
      const near = platform.center.z + platform.size.z / 2 + motionZ;
      const far = platform.center.z - platform.size.z / 2 - motionZ;
      if (z + halfDepth + 0.45 < far || z - halfDepth - 0.45 > near) continue;
      const platformEdge =
        platform.center.x + side * (platform.size.x / 2 + motionX);
      edge =
        side < 0 ? Math.min(edge, platformEdge) : Math.max(edge, platformEdge);
    }
    let candidate = edge + side * (halfWidth + 0.55);
    for (let attempt = 0; attempt < 20; attempt++) {
      if (this.pendingSceneryClear(level, candidate, z, halfWidth, halfDepth))
        return candidate;
      candidate += side * 0.4;
    }
    return candidate;
  }

  private pendingSceneryClear(
    level: LevelLayout,
    x: number,
    z: number,
    halfWidth: number,
    halfDepth: number,
  ): boolean {
    const clearance = 0.45;
    for (const platform of level.course?.platforms ?? []) {
      const motionX =
        platform.motion?.axis === "x" ? Math.abs(platform.motion.distance) : 0;
      const motionZ =
        platform.motion?.axis === "z" ? Math.abs(platform.motion.distance) : 0;
      if (
        Math.abs(x - platform.center.x) <=
          halfWidth + platform.size.x / 2 + motionX + clearance &&
        Math.abs(z - platform.center.z) <=
          halfDepth + platform.size.z / 2 + motionZ + clearance
      )
        return false;
    }
    for (const encounter of level.encounters) {
      const arena = encounter.arena;
      if (
        arena &&
        x + halfWidth + clearance >= arena.minX &&
        x - halfWidth - clearance <= arena.maxX &&
        z + halfDepth + clearance >= arena.minZ &&
        z - halfDepth - clearance <= arena.maxZ
      )
        return false;
    }
    const objectives = [
      ...level.memories,
      ...level.pickups,
      ...(level.friendlies ?? []),
      { position: level.checkpoint },
      { position: level.finish },
    ];
    return objectives.every(
      ({ position }) =>
        Math.abs(x - position.x) > halfWidth + 1.25 ||
        Math.abs(z - position.z) > halfDepth + 1.25,
    );
  }

  private pendingDetailClear(
    level: LevelLayout,
    x: number,
    z: number,
  ): boolean {
    for (const encounter of level.encounters) {
      const arena = encounter.arena;
      if (
        arena &&
        x >= arena.minX - 0.25 &&
        x <= arena.maxX + 0.25 &&
        z >= arena.minZ - 0.25 &&
        z <= arena.maxZ + 0.25
      )
        return false;
    }
    return [
      ...level.memories,
      ...level.pickups,
      ...(level.friendlies ?? []),
    ].every(({ position }) => Math.hypot(x - position.x, z - position.z) > 1.1);
  }

  private createPendingFloorTiles(
    name: string,
    color: number,
    level: LevelLayout,
    maxInstances: number,
  ): THREE.InstancedMesh {
    const transforms: Array<{
      position: [number, number, number];
      scale: [number, number, number];
    }> = [];
    const platforms = [...(level.course?.platforms ?? [])]
      .filter((platform) => !platform.motion)
      .sort((left, right) => right.center.z - left.center.z);
    for (const platform of platforms) {
      const columns = Math.max(
        1,
        Math.min(6, Math.floor((platform.size.x - 0.35) / 1.45)),
      );
      const rows = Math.max(
        1,
        Math.min(12, Math.floor((platform.size.z - 0.35) / 1.45)),
      );
      const cellX = (platform.size.x - 0.35) / columns;
      const cellZ = (platform.size.z - 0.35) / rows;
      for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
          if ((row + column) % 2 !== 0) continue;
          const x =
            platform.center.x -
            platform.size.x / 2 +
            0.175 +
            cellX * (column + 0.5);
          const z =
            platform.center.z -
            platform.size.z / 2 +
            0.175 +
            cellZ * (row + 0.5);
          if (!this.pendingDetailClear(level, x, z)) continue;
          transforms.push({
            position: [x, platform.center.y + platform.size.y / 2 + 0.009, z],
            scale: [cellX * 0.72, 0.018, cellZ * 0.72],
          });
          if (transforms.length >= maxInstances) break;
        }
        if (transforms.length >= maxInstances) break;
      }
      if (transforms.length >= maxInstances) break;
    }
    const surface = material(color, color);
    surface.emissiveIntensity = 0.12;
    const tiles = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      surface,
      transforms.length,
    );
    tiles.name = name;
    const dummy = new THREE.Object3D();
    transforms.forEach((transform, index) =>
      setInstanceTransform(
        tiles,
        index,
        dummy,
        transform.position,
        transform.scale,
      ),
    );
    finishInstances(tiles);
    return tiles;
  }

  private createPendingRouteGuidance(
    name: string,
    color: number,
    level: LevelLayout,
    maxInstances: number,
  ): THREE.InstancedMesh {
    const transforms: Array<{
      position: [number, number, number];
      scale: [number, number, number];
    }> = [];
    const platforms = [...(level.course?.platforms ?? [])]
      .filter((platform) => !platform.motion)
      .sort((left, right) => right.center.z - left.center.z);
    for (const platform of platforms) {
      const segments = Math.max(
        1,
        Math.min(4, Math.floor(platform.size.z / 4)),
      );
      for (let segment = 0; segment < segments; segment++) {
        const z =
          platform.center.z -
          platform.size.z / 2 +
          ((segment + 0.5) * platform.size.z) / segments;
        if (!this.pendingDetailClear(level, platform.center.x, z)) continue;
        transforms.push({
          position: [
            platform.center.x,
            platform.center.y + platform.size.y / 2 + 0.022,
            z,
          ],
          scale: [
            Math.min(1.4, Math.max(0.5, platform.size.x * 0.22)),
            0.025,
            0.16,
          ],
        });
        if (transforms.length >= maxInstances) break;
      }
      if (transforms.length >= maxInstances) break;
    }
    const surface = material(color, color);
    surface.emissiveIntensity = 0.48;
    const guidance = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      surface,
      transforms.length,
    );
    guidance.name = name;
    const dummy = new THREE.Object3D();
    transforms.forEach((transform, index) =>
      setInstanceTransform(
        guidance,
        index,
        dummy,
        transform.position,
        transform.scale,
      ),
    );
    finishInstances(guidance);
    return guidance;
  }

  private addPendingEnvironmentMarker(
    root: THREE.Group,
    theme: RuntimeWorldTheme,
  ): void {
    if (theme.environment.state !== "pending-kit") return;
    root.name = theme.environment.fallbackName;
    root.userData.environmentKitState = theme.environment.state;
    root.userData.worldTheme = theme.id;
    const surface = material(theme.palette.accent);
    for (const x of [-0.72, 0.72])
      root.add(
        shapeMesh(new THREE.BoxGeometry(0.18, 1.55, 0.18), surface, [
          x,
          0.78,
          0,
        ]),
      );
    root.add(
      shapeMesh(new THREE.BoxGeometry(1.62, 0.18, 0.18), surface, [0, 1.53, 0]),
    );
  }

  private addMeadow(
    palette: RuntimeWorldTheme["meadow"],
    course?: ObbyCourse,
    authoredLevel?: LevelLayout,
  ): void {
    const bladeGeometry = new THREE.BufferGeometry();
    bladeGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [
          -0.055, 0, 0, 0.055, 0, 0, 0.06, 0.33, 0.025, -0.05, 0, -0.025, 0.016,
          0.26, -0.04, -0.085, 0.4, -0.03, 0, 0, -0.05, 0, 0, 0.05, -0.03, 0.31,
          0.065,
        ],
        3,
      ),
    );
    bladeGeometry.computeVertexNormals();
    const grassMat = material(palette.grass);
    grassMat.side = THREE.DoubleSide;
    const clearZones = authoredLevel
      ? [
          ...authoredLevel.encounters.flatMap((entry) =>
            entry.arena ? [entry.arena] : [],
          ),
          ...[
            ...authoredLevel.memories,
            ...authoredLevel.pickups,
            ...(authoredLevel.friendlies ?? []),
          ].map(({ position }) => ({
            minX: position.x - 1,
            maxX: position.x + 1,
            minZ: position.z - 1,
            maxZ: position.z + 1,
          })),
        ]
      : [];
    const planting = grassPlacements(
      course,
      authoredLevel ? { clearZones, maxInstances: 4400 } : undefined,
    );
    const grass = new THREE.InstancedMesh(
      bladeGeometry,
      grassMat,
      planting.length,
    );
    grass.name = "route-grass";
    const flowerCount = Math.ceil(planting.length / 13);
    const flowers = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.06, 5, 4),
      material(palette.flower),
      flowerCount,
    );
    flowers.name = "route-flowers";
    const dummy = new THREE.Object3D();
    let flowerIndex = 0;
    for (let i = 0; i < planting.length; i++) {
      const plant = planting[i]!;
      dummy.position.set(plant.x, plant.y, plant.z);
      dummy.rotation.set(0, plant.rotation, 0);
      dummy.scale.setScalar(plant.scale);
      dummy.updateMatrix();
      grass.setMatrixAt(i, dummy.matrix);
      if (i % 13 === 0) {
        dummy.position.y = plant.y + 0.28;
        dummy.scale.multiplyScalar(1.1);
        dummy.updateMatrix();
        flowers.setMatrixAt(flowerIndex++, dummy.matrix);
      }
    }
    grass.receiveShadow = true;
    flowers.receiveShadow = true;
    this.world.add(grass, flowers);
    const positions = new Float32Array(180 * 3);
    for (let i = 0; i < 180; i++) {
      positions[i * 3] = authoredLevel
        ? authoredLevel.minX +
          (((i * 47) % 180) / 180) * (authoredLevel.maxX - authoredLevel.minX)
        : ((i * 47) % 180) / 10 - 9;
      positions[i * 3 + 1] = 0.3 + ((i * 31) % 70) / 20;
      positions[i * 3 + 2] = authoredLevel
        ? authoredLevel.maxZ -
          (((i * 23) % 350) / 350) * (authoredLevel.maxZ - authoredLevel.minZ)
        : 4 - ((i * 23) % 350) / 10;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.particles = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color: palette.particles,
        size: 0.035,
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
      }),
    );
    this.particles.name = "route-particles";
    this.world.add(this.particles);
  }

  private addEraDetails(later: boolean): void {
    for (let i = 0; i < 8; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side * 5.4,
        z = -2 - Math.floor(i / 2) * 7;
      if (later) {
        const pole = shapeMesh(
          new THREE.CylinderGeometry(0.05, 0.08, 2.6, 8),
          material(0x775d51),
          [x, 1.3, z],
        );
        this.world.add(pole);
        const loop = shapeMesh(
          new THREE.TorusGeometry(0.43, 0.08, 8, 32),
          material(i % 3 ? 0xb5a1dc : 0x87b6b9, 0x2b2444),
          [x, 2.35, z],
        );
        loop.rotation.y = side * 0.3;
        this.world.add(loop);
        for (let j = 0; j < 3; j++) {
          const pennant = shapeMesh(
            new THREE.ConeGeometry(0.14, 0.4, 3),
            material(j % 2 ? 0xd7abbd : 0xd8bf80),
            [x - side * (0.4 + j * 0.3), 2.2 - j * 0.1, z],
          );
          pennant.rotation.z = Math.PI;
          this.world.add(pennant);
        }
      } else {
        for (let j = 0; j < 3; j++) {
          const block = shapeMesh(
            new THREE.BoxGeometry(0.6, 0.6, 0.6),
            material(j % 2 ? 0xc99e63 : 0x8c7160),
            [x + Math.sin(j * 3) * 0.4, 0.3 + j * 0.52, z],
          );
          block.rotation.y = j * 0.27;
          this.world.add(block);
        }
      }
    }
  }

  private readonly resize = (): void => {
    if (this.disposed) return;
    const width = Math.max(1, this.container.clientWidth),
      height = Math.max(1, this.container.clientHeight);
    this.renderer.setPixelRatio(
      Math.min(
        1.75,
        this.container.ownerDocument.defaultView?.devicePixelRatio ?? 1,
      ),
    );
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  };
}
