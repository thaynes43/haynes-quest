// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import type { SaveView } from "../../src/shared/contracts";
import type { SceneFrame } from "../../src/game/types";
import { makeEraSave } from "./fixtures";

type Attachment = {
  url: string;
  target: THREE.Object3D;
  valid: () => boolean;
  ready?: (root: THREE.Group, clips: THREE.AnimationClip[]) => void;
};

const harness = vi.hoisted(() => ({
  attachments: [] as Attachment[],
  disposedTrees: [] as THREE.Object3D[],
  assetState: { loading: 0, failed: 0 },
  retries: 0,
  assetDisposals: 0,
  animationDisposals: 0,
}));

vi.mock("three", async () => {
  const actual = await vi.importActual<typeof import("three")>("three");
  class FakeRenderer {
    readonly domElement = document.createElement("canvas");
    readonly shadowMap = { enabled: false, type: 0 };
    readonly renderLists = { dispose: vi.fn() };
    outputColorSpace = actual.SRGBColorSpace;
    toneMapping = actual.NoToneMapping;
    toneMappingExposure = 1;
    setPixelRatio(): void {}
    setSize(): void {}
    render(): void {}
    dispose(): void {}
    forceContextLoss(): void {}
  }
  class FakePmremGenerator {
    fromScene(): { texture: THREE.Texture; dispose: () => void } {
      return { texture: new actual.Texture(), dispose: vi.fn() };
    }
    dispose(): void {}
  }
  return {
    ...actual,
    WebGLRenderer: FakeRenderer,
    PMREMGenerator: FakePmremGenerator,
  };
});

vi.mock("../../src/game/scene-assets", async () => {
  const actual = await vi.importActual<
    typeof import("../../src/game/scene-assets")
  >("../../src/game/scene-assets");
  class FakeSceneAssets {
    attach(
      url: string,
      target: THREE.Object3D,
      valid: () => boolean,
      ready?: (root: THREE.Group, clips: THREE.AnimationClip[]) => void,
    ): void {
      harness.attachments.push({ url, target, valid, ready });
    }
    attachInstances(): void {}
    getState(): { loading: number; failed: number } {
      return { ...harness.assetState };
    }
    retry(): void {
      harness.retries += 1;
    }
    dispose(): void {
      harness.assetDisposals += 1;
    }
  }
  return {
    ...actual,
    SceneAssets: FakeSceneAssets,
    disposeTree: (root: THREE.Object3D): void => {
      harness.disposedTrees.push(root);
      actual.disposeTree(root);
    },
  };
});

vi.mock("../../src/game/enemy-animation", () => ({
  EnemyAnimation: class {
    dispose(): void {
      harness.animationDisposals += 1;
    }
  },
}));

import { createLevelLayout } from "../../src/game/level";
import { GardenScene } from "../../src/game/scene";

function knownModelSave(): SaveView {
  const save = makeEraSave();
  const adventure = save.adventure;
  const activeLevel = adventure?.activeLevel;
  if (!adventure || !activeLevel)
    throw new Error("Known-model fixture needs an active level");
  return {
    ...save,
    adventure: {
      ...adventure,
      activeLevel: {
        ...activeLevel,
        encounters: activeLevel.encounters.map((encounter) =>
          encounter.kind === "ordinary-a"
            ? {
                ...encounter,
                content: {
                  catalogEntryId: "mister-hiss",
                  catalogEntryVersion: "v001",
                  assetId: "mister-hiss",
                  assetVersion: "v001",
                },
              }
            : encounter,
        ),
      },
    },
  };
}

function routeMemorySave(
  firstMemoryState: "released" | "revealed",
): SaveView {
  const save = makeEraSave({ phase: "memory-released" });
  const adventure = save.adventure;
  const activeLevel = adventure?.activeLevel;
  if (!adventure || !activeLevel)
    throw new Error("Route-memory fixture needs an active level");
  const memoryIds = ["memory-1", "memory-2", "memory-3"];
  const memories = save.memories.map((memory, index) => ({
    ...memory,
    role: index === 2 ? ("major" as const) : ("minor" as const),
    state:
      index === 0
        ? firstMemoryState
        : index === 1 || index === 2
          ? ("released" as const)
          : memory.state,
    mediaUrl: `/fixture/${index + 1}.svg`,
  }));
  return {
    ...save,
    memories,
    recoveredIds:
      firstMemoryState === "revealed" ? [memoryIds[0]!] : [],
    adventure: {
      ...adventure,
      planVersion: "era-level-plan-v3",
      activeLevel: {
        ...activeLevel,
        memoryIds,
        minorMemoryIds: [memoryIds[0]!, memoryIds[1]!],
        majorMemoryId: memoryIds[2]!,
      },
      secondaryCooldownRemainingMs: 0,
    },
  };
}

function memoryRoot(id: string): THREE.Object3D {
  const root = harness.attachments.find(
    (attachment) => attachment.target.name === `memory-${id}`,
  )?.target;
  if (!root) throw new Error(`Memory ${id} was not attached to the scene`);
  return root;
}

function frame(overrides: Partial<SceneFrame> = {}): SceneFrame {
  return {
    deltaSeconds: 0,
    moving: false,
    grounded: true,
    attacking: false,
    attackTargetId: null,
    guarding: false,
    enemies: [],
    currentTarget: null,
    ...overrides,
  };
}

describe("GardenScene fallback and attack lifecycle", () => {
  beforeEach(() => {
    harness.attachments.length = 0;
    harness.disposedTrees.length = 0;
    harness.assetState = { loading: 0, failed: 0 };
    harness.retries = 0;
    harness.assetDisposals = 0;
    harness.animationDisposals = 0;
  });

  afterEach(() => vi.restoreAllMocks());

  it("keeps a known-model fallback through failure, then swaps and disposes it without removing the exact model", () => {
    const save = knownModelSave();
    const scene = new GardenScene(
      document.createElement("div"),
      createLevelLayout(save),
      save,
    );
    const attachment = harness.attachments.find((candidate) =>
      candidate.target.getObjectByName("encounter-artwork-fallback"),
    );
    if (!attachment) throw new Error("Known encounter attachment was not queued");
    const fallback = attachment.target.getObjectByName(
      "encounter-artwork-fallback",
    ) as THREE.Group;

    harness.assetState = { loading: 1, failed: 0 };
    expect(scene.getMediaState()).toMatchObject({ loading: 1, failed: 0 });
    expect(fallback.parent).toBe(attachment.target);
    harness.assetState = { loading: 0, failed: 1 };
    expect(scene.getMediaState()).toMatchObject({ loading: 0, failed: 1 });
    expect(fallback.parent).toBe(attachment.target);
    scene.retryMedia();
    expect(harness.retries).toBe(1);
    expect(fallback.parent).toBe(attachment.target);

    const exact = new THREE.Group();
    exact.name = "exact-mister-hiss";
    const exactMesh = new THREE.Mesh(
      new THREE.BoxGeometry(),
      new THREE.MeshBasicMaterial(),
    );
    exact.add(exactMesh);
    const geometryDispose = vi.spyOn(exactMesh.geometry, "dispose");
    const materialDispose = vi.spyOn(
      exactMesh.material as THREE.Material,
      "dispose",
    );
    attachment.target.add(exact);
    attachment.ready?.(exact, []);

    expect(fallback.parent).toBeNull();
    expect(harness.disposedTrees).toContain(fallback);
    expect(attachment.target.getObjectByName("exact-mister-hiss")).toBe(exact);
    expect(exact.parent).toBe(attachment.target);

    const nextSave = makeEraSave({ levelIndex: 1, revision: 1 });
    scene.rebuildRoute(createLevelLayout(nextSave), nextSave);
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
    expect(harness.animationDisposals).toBe(1);
    scene.dispose();
    expect(harness.assetDisposals).toBe(1);
  });

  it("restarts consecutive primary and secondary poses from their attempt sequence", () => {
    const save = makeEraSave();
    const scene = new GardenScene(
      document.createElement("div"),
      createLevelLayout(save),
      save,
    );
    const avatar = (
      scene as unknown as { avatarVisual: THREE.Group }
    ).avatarVisual;
    const position = { x: 0, y: 0, z: 0 };

    scene.render(position, 0, 0, frame({ attacking: true, attackSequence: 1 }));
    scene.render(
      position,
      0,
      0,
      frame({ deltaSeconds: 0.19, attacking: true, attackSequence: 1 }),
    );
    expect(avatar.rotation.x).toBeCloseTo(-0.15, 6);
    expect(avatar.rotation.z).toBeCloseTo(0.1, 6);
    scene.render(
      position,
      0,
      0,
      frame({ deltaSeconds: 0.01, attacking: true, attackSequence: 2 }),
    );
    expect(avatar.rotation.x).toBeCloseTo(0, 6);
    expect(avatar.rotation.z).toBeCloseTo(0, 6);

    scene.render(
      position,
      0,
      0,
      frame({ deltaSeconds: 0.4, attackSequence: 2 }),
    );
    scene.render(
      position,
      0,
      0,
      frame({ secondaryAttacking: true, attackSequence: 3 }),
    );
    scene.render(
      position,
      0,
      0,
      frame({
        deltaSeconds: 0.2,
        secondaryAttacking: true,
        attackSequence: 3,
      }),
    );
    expect(avatar.rotation.x).toBeCloseTo(-0.15, 6);
    expect(avatar.rotation.z).toBeCloseTo(-0.1, 6);
    scene.render(
      position,
      0,
      0,
      frame({
        deltaSeconds: 0.01,
        secondaryAttacking: true,
        attackSequence: 4,
      }),
    );
    expect(avatar.rotation.x).toBeCloseTo(0, 6);
    expect(avatar.rotation.z).toBeCloseTo(0, 6);
    scene.dispose();
  });

  it("removes a contacted route memory from the world after recovery", () => {
    const released = routeMemorySave("released");
    const scene = new GardenScene(
      document.createElement("div"),
      createLevelLayout(released),
      released,
    );
    const root = memoryRoot("memory-1");
    expect(root.visible).toBe(true);
    expect(scene.inspectVisuals().memories).toContainEqual({
      id: "memory-1",
      visible: true,
    });

    scene.updateProgress(routeMemorySave("revealed"));

    expect(root.visible).toBe(false);
    expect(scene.inspectVisuals().memories).toContainEqual({
      id: "memory-1",
      visible: false,
    });
    scene.dispose();
  });

  it("keeps an archived revealed memory visible until bundle consumption", () => {
    const released = makeEraSave({ phase: "memory-released" });
    const scene = new GardenScene(
      document.createElement("div"),
      createLevelLayout(released),
      released,
    );
    const root = memoryRoot("memory-1");
    expect(root.visible).toBe(true);

    scene.updateProgress(
      makeEraSave({
        phase: "memory-released",
        revealedCount: 1,
        revision: 1,
      }),
    );

    expect(root.visible).toBe(true);
    expect(scene.inspectVisuals().memories).toContainEqual({
      id: "memory-1",
      visible: true,
    });
    scene.dispose();
  });
});
