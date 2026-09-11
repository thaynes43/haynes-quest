import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
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
} from "./types";
import { disposeTree, modelUrls, SceneAssets } from "./scene-assets";
import {
  createEncounterStudy,
  groundRing,
  material,
  palettes,
  shapeMesh,
} from "./scene-art";
import { equipmentArtwork, parodyArtwork } from "./scene-catalog";
import { EnemyAnimation } from "./enemy-animation";
import { enemyAttackRange } from "./combat";
import { TravelerEquipment } from "./traveler-equipment";

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
};

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
  private attackAt = -10;
  private unsupportedContentCount = 0;

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
    for (const enemy of this.enemies.values()) enemy.animation?.dispose();
    this.enemies.clear();
    this.obbyVisual = null;
    this.scene.remove(this.world);
    disposeTree(this.world);
    this.world = new THREE.Group();
    this.world.name = `era-world-${save.adventure?.activeLevel?.eraYear ?? "complete"}`;
    this.scene.add(this.world);
    this.cameraYaw = 0;
    this.cameraPitch = 0.4;
    this.cameraPlaced = false;
    const period = save.adventure?.activeLevel?.periodId;
    const later = period
      ? period === "remix-runway-v1" || period === "remix-runway-v2"
      : (save.adventure?.activeLevel?.eraYear ?? 2020) >= 2024;
    const palette = later ? palettes.fair : palettes.orchard;
    const sky = level.course && !later ? 0xcde5ef : palette.sky;
    this.scene.background = new THREE.Color(sky);
    this.scene.fog = new THREE.Fog(sky, 20, 52);
    this.sun.color.setHex(level.course ? 0xfff4df : palette.light);
    this.renderer.toneMappingExposure = later ? 0.85 : 0.82;
    const generation = this.routeGeneration;
    const valid = () => !this.disposed && generation === this.routeGeneration;
    const ground = shapeMesh(
      new THREE.PlaneGeometry(64, 110, 48, 80),
      material(level.course ? 0x88c1c5 : palette.grass),
      [0, level.course ? -1.4 : -0.045, -13],
    );
    ground.rotation.x = -Math.PI / 2;
    ground.castShadow = false;
    this.world.add(ground);
    if (level.course) {
      this.obbyVisual = new ObbyScene(level.course, later);
      this.world.add(this.obbyVisual.root);
      for (const side of [-1, 1])
        this.world.add(
          shapeMesh(
            new THREE.BoxGeometry(16, 1.4, 80),
            material(palette.grass),
            [side * 17.5, -0.7, -13],
          ),
        );
    }
    const pathPlacements: THREE.Matrix4[] = [];
    for (let z = 4; z >= -26; z -= 2) {
      const xs = z < -18 ? [-2, 0, 2] : [Math.sin(z * 0.22) * 0.45];
      for (const x of xs) {
        if (level.course && (later || !this.onIsland(level.course, x, z, 1.05)))
          continue;
        const tile = new THREE.Group();
        tile.position.set(x, -0.012, z);
        tile.rotation.y = z % 4 ? Math.PI : 0;
        tile.updateMatrix();
        pathPlacements.push(tile.matrix.clone());
      }
    }
    this.assets.attachInstances(
      modelUrls.path,
      this.world,
      pathPlacements,
      valid,
      {
        castShadow: false,
      },
    );
    const groundColor = new THREE.Color(
      level.course ? 0x88c1c5 : palette.grass,
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
    for (let i = 0; i < 16; i++) {
      const side = i % 2 ? 1 : -1;
      const tree = new THREE.Group();
      tree.position.set(
        side * ((level.course ? 10.1 : 7.1) + (i % 3) * 0.85),
        0,
        4 - Math.floor(i / 2) * 4.8,
      );
      tree.scale.setScalar(1.1 + (i % 4) * 0.13);
      tree.rotation.y = i * 1.7;
      tree.updateMatrix();
      treePlacements.push(tree.matrix.clone());
      if (i % 2 === 0) {
        const stone = new THREE.Group();
        stone.position.set(
          -side * (level.course ? 9.9 : 6.5),
          -0.04,
          tree.position.z - 2.2,
        );
        stone.rotation.y = i * 2.1;
        stone.scale.setScalar(0.8 + (i % 3) * 0.1);
        stone.updateMatrix();
        stonePlacements.push(stone.matrix.clone());
      }
    }
    this.assets.attachInstances(
      modelUrls.tree,
      this.world,
      treePlacements,
      valid,
    );
    this.assets.attachInstances(
      modelUrls.stone,
      this.world,
      stonePlacements,
      valid,
    );
    for (let i = 0; i < 8; i++) {
      const hill = shapeMesh(
        new THREE.SphereGeometry(5 + (i % 3), 16, 8),
        material(i % 2 ? palette.leaf : palette.mist),
        [(i % 2 ? 1 : -1) * (16 + (i % 3)), -2, 10 - Math.floor(i / 2) * 14],
      );
      hill.scale.y = 0.7;
      hill.castShadow = false;
      hill.receiveShadow = false;
      this.world.add(hill);
    }
    this.addMeadow(later, level.course);
    if (!level.course) this.addEraDetails(later);
    const gate = new THREE.Group();
    gate.position.set(level.finish.x, 0, level.finish.z);
    gate.scale.setScalar(1.4);
    this.world.add(gate);
    this.assets.attach(modelUrls.gate, gate, valid);
    for (const placement of level.memories) {
      const memory = new THREE.Group();
      memory.position.set(placement.position.x, 0, placement.position.z);
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
      pickup.position.set(placement.position.x, 0, placement.position.z);
      const display = new THREE.Group();
      const artwork = equipmentArtwork(placement.kind, data?.tier ?? 1);
      this.assets.attach(artwork.url, display, valid);
      display.name = "display";
      display.position.y = 0.85;
      pickup.add(display, groundRing(0.53, 0xffd78c));
      this.world.add(pickup);
      this.pickups.set(placement.id, pickup);
    }
    for (const placement of level.encounters) {
      const root = new THREE.Group();
      root.position.set(placement.position.x, 0, placement.position.z);
      const content = save.adventure?.activeLevel?.encounters.find(
        (item) => item.id === placement.id,
      )?.content;
      const artwork = content ? parodyArtwork(content) : null;
      if (content && !artwork) this.unsupportedContentCount += 1;
      const model = content
        ? new THREE.Group()
        : createEncounterStudy(placement.kind, later);
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
      if (artwork)
        this.assets.attach(artwork.url, model, valid, (loaded, clips) => {
          visual.animation = new EnemyAnimation(
            loaded,
            clips,
            artwork.contactFraction,
          );
        });
    }
    this.updateProgress(save);
  }

  updateProgress(save: SaveView): void {
    if (this.disposed) return;
    this.save = save;
    for (const [id, root] of this.memories) {
      const memory = save.memories.find((item) => item.id === id);
      root.visible = Boolean(
        memory && memory.state !== "locked" && memory.state !== "consumed",
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
      reloadRequired: this.unsupportedContentCount > 0,
    };
    return state;
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
    const dt = frame?.deltaSeconds ?? 0;
    const elapsed = (this.visualTime += dt);
    if (frame?.obby)
      this.obbyVisual?.update(frame.obby, frame.checkpointId ?? null);
    (this.guardRing.material as THREE.MeshBasicMaterial).opacity =
      frame?.recovering ? 0.6 : 0.8;
    this.traveler.position.set(position.x, position.y, position.z);
    this.traveler.rotation.y = facing;
    if (frame?.attacking && !this.previousAttack) this.attackAt = elapsed;
    this.previousAttack = frame?.attacking ?? false;
    const attackTime = elapsed - this.attackAt;
    this.slash.visible = attackTime < 0.28;
    this.slash.rotation.z = -1.3 + attackTime * 12;
    this.slash.position.y = this.stage === "infant" ? 0.45 : 0.78;
    this.guardRing.visible = Boolean(frame?.guarding || frame?.recovering);

    const desiredClip =
      !frame?.grounded && this.clips.has("jump")
        ? "jump"
        : frame?.moving
          ? "move"
          : "idle";
    this.equipment?.resetPose();
    this.playClip(desiredClip);
    this.mixer?.update(dt);
    this.equipment?.pose(attackTime, frame?.guarding ?? false);
    const dimensions = getAvatarProportions(this.stage);
    this.target.set(
      position.x,
      position.y + dimensions.cameraTargetHeight + 0.3,
      position.z - 0.5,
    );
    const distance = this.camera.aspect < 0.85 ? 6.2 : 4.9;
    const flat = Math.cos(this.cameraPitch) * distance;
    this.desiredCamera.set(
      position.x + Math.sin(this.cameraYaw) * flat,
      position.y +
        dimensions.cameraTargetHeight +
        Math.sin(this.cameraPitch) * distance,
      position.z + Math.cos(this.cameraYaw) * flat,
    );
    this.camera.position.lerp(
      this.desiredCamera,
      this.cameraPlaced ? 1 - Math.exp(-dt * 14) : 1,
    );
    this.cameraPlaced = true;
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
    for (const enemy of frame?.enemies ?? [])
      this.animateEnemy(enemy, elapsed, frame?.currentTarget === enemy.id, dt);
    if (this.particles)
      this.particles.rotation.y = Math.sin(elapsed * 0.03) * 0.02;
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
    this.mixer?.stopAllAction();
    if (this.avatarRoot) this.mixer?.uncacheRoot(this.avatarRoot);
    this.avatarRoot = null;
    for (const enemy of this.enemies.values()) enemy.animation?.dispose();
    disposeTree(this.world);
    disposeTree(this.traveler);
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
  ): void {
    const visual = this.enemies.get(enemy.id);
    if (!visual) return;
    visual.root.position.set(
      enemy.position.x,
      enemy.position.y,
      enemy.position.z,
    );
    visual.model.rotation.y = enemy.facing;
    const dormant =
      visual.boss &&
      this.save.adventure?.activeLevel?.encounters.some(
        (item) => item.role === "ordinary" && !item.defeated,
      );
    const defeated = enemy.phase === "defeated";
    const animation = visual.animation?.update(enemy, deltaSeconds);
    visual.root.visible = animation?.visible ?? !defeated;
    if (enemy.hp < visual.lastHp) visual.hitUntil = elapsed + 0.2;
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

  private addMeadow(later: boolean, course?: ObbyCourse): void {
    const bladeGeometry = new THREE.BufferGeometry();
    bladeGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [
          -0.028, 0, 0, 0.028, 0, 0, 0.035, 0.2, 0.015, -0.024, 0, -0.015,
          0.008, 0.15, -0.025, -0.055, 0.25, -0.018, 0, 0, -0.026, 0, 0, 0.026,
          -0.02, 0.18, 0.038,
        ],
        3,
      ),
    );
    bladeGeometry.computeVertexNormals();
    const grassMat = material(later ? 0x729496 : 0x91a771);
    grassMat.side = THREE.DoubleSide;
    const grass = new THREE.InstancedMesh(bladeGeometry, grassMat, 900);
    const flowers = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.035, 5, 4),
      material(later ? 0xd7b7dd : 0xffe9af),
      160,
    );
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 900; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side * (1.55 + ((i * 43) % 87) / 17);
      const z = 4 - ((i * 31) % 355) / 10;
      dummy.position.set(x, 0, z);
      dummy.rotation.set(0, i * 1.7, 0);
      dummy.scale.setScalar(0.55 + (i % 9) / 11);
      // Keep the final battle floor clear and readable.
      if (
        (z < -18 && Math.abs(x) < 3.2) ||
        (course &&
          (later ||
            Math.abs(x) < 4.5 ||
            i % 3 !== 0 ||
            !this.onIsland(course, x, z, 0.3)))
      )
        dummy.scale.setScalar(0);
      dummy.updateMatrix();
      grass.setMatrixAt(i, dummy.matrix);
      if (i < 160) {
        dummy.position.y = 0.13;
        dummy.scale.multiplyScalar(0.8);
        dummy.updateMatrix();
        flowers.setMatrixAt(i, dummy.matrix);
      }
    }
    grass.receiveShadow = true;
    flowers.receiveShadow = true;
    this.world.add(grass, flowers);
    const positions = new Float32Array(180 * 3);
    for (let i = 0; i < 180; i++) {
      positions[i * 3] = ((i * 47) % 180) / 10 - 9;
      positions[i * 3 + 1] = 0.3 + ((i * 31) % 70) / 20;
      positions[i * 3 + 2] = 4 - ((i * 23) % 350) / 10;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.particles = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color: later ? 0xcfbbff : 0xffdf8b,
        size: 0.035,
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
      }),
    );
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
