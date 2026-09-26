// @vitest-environment jsdom
/**
 * A parody-catalog-v8 family-era boss end to end (PLAN-019 cast integration):
 * a synthetic one-chapter template assigns the landed Blender boss from the
 * catalog, publishes into a family plan for a synthetic child, and the game
 * scene loads that boss's exact GLB for the frozen identity. No real names,
 * birthdays or photos: the children and memories are the family-test fakes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";

type Attachment = {
  url: string;
  target: THREE.Object3D;
  ready?: (root: THREE.Group, clips: THREE.AnimationClip[]) => void;
};

const harness = vi.hoisted(() => ({ attachments: [] as Attachment[], animations: 0 }));

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
  return { ...actual, WebGLRenderer: FakeRenderer, PMREMGenerator: FakePmremGenerator };
});

vi.mock("../../src/game/scene-assets", async () => {
  const actual = await vi.importActual<typeof import("../../src/game/scene-assets")>(
    "../../src/game/scene-assets",
  );
  class FakeSceneAssets {
    attach(
      url: string,
      target: THREE.Object3D,
      _valid: () => boolean,
      ready?: (root: THREE.Group, clips: THREE.AnimationClip[]) => void,
    ): void {
      harness.attachments.push({ url, target, ready });
    }
    attachInstances(): void {}
    getState(): { loading: number; failed: number } {
      return { loading: 0, failed: 0 };
    }
    retry(): void {}
    dispose(): void {}
  }
  return { ...actual, SceneAssets: FakeSceneAssets };
});

vi.mock("../../src/game/enemy-animation", () => ({
  EnemyAnimation: class {
    constructor() {
      harness.animations += 1;
    }
    dispose(): void {}
  },
}));

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createInitialAdventureState } from "../../src/shared/adventure";
import { FAMILY_ABILITY_LADDER, FAMILY_MEMORY_SLOTS } from "../../src/shared/family-plan";
import { parseStoredAdventure } from "../../src/server/adventure-schema";
import { toSaveView } from "../../src/server/domain";
import { prepareEditorPreview } from "../../src/server/editor-preview";
import { buildFamilyWorldPlan, validateFamilyWorldPlan } from "../../src/server/family/plan";
import { rebaseWorldForChild } from "../../src/server/family/rebase";
import { familyWorldView, newFamilySave } from "../../src/server/family/saves";
import type { ChildRecord, PublicationRecord } from "../../src/server/family/store";
import { FamilyTemplateRegistry } from "../../src/server/family/templates";
import { resolveFamilyWorld } from "../../src/client/family/family-world";
import { createLevelLayout } from "../../src/game/level";
import { GardenScene } from "../../src/game/scene";
import { parodyArtwork } from "../../src/game/scene-catalog";
import {
  buildFamilyCatalogBossWorld,
  FAMILY_CATALOG_BOSS_WORLDS,
  type FamilyCatalogBossWorldSpec,
} from "../family-world-fixtures";
import { TEST_CHILD_A, TEST_CHILD_B } from "../server/family/fake-immich";

const TODAY = "2026-09-25";
const REPOSITORY = join(dirname(fileURLToPath(import.meta.url)), "../..");
type Child = { readonly personId: string; readonly birthDate: string };

/** Each boss world with a synthetic child whose first chapter sits inside the boss's window. */
const CASES: ReadonlyArray<{
  readonly spec: FamilyCatalogBossWorldSpec;
  readonly child: Child;
  /** Minor memory dates; the big memory closes the rebased chapter on its target birthday. */
  readonly minors: readonly [string, string];
  readonly height: number;
}> = [
  {
    spec: FAMILY_CATALOG_BOSS_WORLDS.clubhouse,
    child: TEST_CHILD_A,
    minors: ["2016-06-01", "2020-06-01"],
    height: 2.5,
  },
  {
    spec: FAMILY_CATALOG_BOSS_WORLDS.playroom,
    child: TEST_CHILD_B,
    minors: ["2020-06-01", "2023-06-01"],
    height: 2.3,
  },
];

function registryFor(spec: FamilyCatalogBossWorldSpec) {
  return new FamilyTemplateRegistry([
    { id: spec.projectId, version: "v1", project: buildFamilyCatalogBossWorld(spec) },
  ]);
}

function publish({ spec, child, minors }: (typeof CASES)[number]) {
  const template = registryFor(spec).require(spec.projectId, "v1");
  // A one-chapter world's chapter runs to the child's current age (D-03).
  const world = rebaseWorldForChild(template.project, child.birthDate, TODAY);
  const chapter = world.chapters[0]!;
  const dates = { "minor-one": minors[0], "minor-two": minors[1], major: chapter.targetDate };
  const selections = FAMILY_MEMORY_SLOTS.map((slot, index) => ({
    chapterId: chapter.chapterId,
    slot,
    assetId: `20000000-0000-4000-9000-${String(index + 1).padStart(12, "0")}`,
    personId: child.personId,
    localDate: dates[slot],
    caption: slot === "major" ? `Turning ${chapter.recoveredAge}!` : `Synthetic memory ${index + 1}`,
    opaque: `asset-${String(index + 1).padStart(32, "0")}`,
  }));
  return buildFamilyWorldPlan({ template, world, selections, ladder: FAMILY_ABILITY_LADDER });
}

function bossIdentity(spec: FamilyCatalogBossWorldSpec) {
  return {
    catalogEntryId: spec.bossEntryId,
    catalogEntryVersion: "v001",
    assetId: spec.bossEntryId,
    assetVersion: "v001",
  };
}

describe("a parody-catalog-v8 family-era boss", () => {
  beforeEach(() => {
    harness.attachments.length = 0;
    harness.animations = 0;
  });

  afterEach(() => vi.restoreAllMocks());

  for (const entry of CASES) {
    const { spec, child } = entry;

    it(`${spec.bossEntryId}: publishes into a family plan the save validator accepts`, () => {
      expect(registryFor(spec).offeredFor(child.birthDate, TODAY).map((template) => template.id)).toEqual([
        spec.projectId,
      ]);
      const { plan, memories } = publish(entry);
      expect(plan.catalogVersion).toBe("parody-catalog-v8");
      const level = plan.levels[0]!;
      expect(level.periodId).toBe(spec.ordinary.periodId);
      const boss = level.encounters.at(-1)!;
      expect(boss).toMatchObject({ id: `${spec.chapter.routeId}-boss`, role: "boss", kind: "boss", maxHp: 8, attackDamage: 3 });
      expect(boss.content).toEqual(bossIdentity(spec));
      expect(level.encounters.slice(0, 4).map((encounter) => [encounter.kind, encounter.content.placeholder])).toEqual(
        Array.from({ length: 4 }, () => ["ordinary-a", "neutral-candidate-v1"]),
      );
      expect(validateFamilyWorldPlan(plan, { birthDate: child.birthDate, memories })).toEqual([]);
      expect(() => parseStoredAdventure(plan, createInitialAdventureState(plan))).not.toThrow();

      // The frozen identity resolves to the published model file.
      const artwork = parodyArtwork(boss.content);
      expect(artwork).toMatchObject({ id: spec.bossEntryId, kind: "single", height: entry.height, contactFraction: 0.625 });
      if (artwork?.kind !== "single") throw new Error("Expected a single-model boss");
      expect(existsSync(join(REPOSITORY, "docs", artwork.url.replace(/^\/studio\//, "")))).toBe(true);

      // The same boss is not in v7: a plan claiming v7 no longer validates its cast.
      expect(
        validateFamilyWorldPlan({ ...plan, catalogVersion: "parody-catalog-v7" }, { birthDate: child.birthDate, memories }),
      ).toContain("level.cast");
    });

    it(`${spec.bossEntryId}: freezes the catalog boss into an editor-world preview plan`, () => {
      const prepared = prepareEditorPreview(buildFamilyCatalogBossWorld(spec));
      if (!prepared.ok || !prepared.bundle.world) throw new Error("Expected a world preview");
      const plan = prepared.bundle.world.plan;
      expect(plan.catalogVersion).toBe("parody-catalog-v8");
      expect(plan.levels[0]!.encounters.at(-1)!.content).toEqual(bossIdentity(spec));
      expect(() =>
        parseStoredAdventure(plan, createInitialAdventureState(plan), { allowEditorPreviewPlan: true }),
      ).not.toThrow();
    });

    it(`${spec.bossEntryId}: the scene loads the boss's exact model for the frozen identity`, () => {
      const { plan, memories, versions } = publish(entry);
      const publication = {
        id: "30000000-0000-4000-8000-000000000001",
        childId: "30000000-0000-4000-8000-00000000000c",
        birthDate: child.birthDate,
        plan,
        memories,
        versions,
      } as unknown as PublicationRecord;
      const record = newFamilySave({
        publication,
        child: { id: publication.childId, displayName: "Synthetic Child" } as unknown as ChildRecord,
        startedBy: "40000000-0000-4000-8000-00000000000a",
        now: new Date(1_000),
      });
      const save = toSaveView(record, new Date(1_000));
      const { resolver } = resolveFamilyWorld(familyWorldView(record));
      const scene = new GardenScene(document.createElement("div"), createLevelLayout(save, resolver), save);

      const url = `/studio/assets/media/${spec.bossEntryId}/v001/${spec.bossEntryId}.glb`;
      const bossAttachments = harness.attachments.filter((attachment) => attachment.url === url);
      expect(bossAttachments).toHaveLength(1);
      const model = bossAttachments[0]!.target;
      const fallback = model.getObjectByName("encounter-artwork-fallback");
      expect(fallback?.parent).toBe(model);
      // The health bar sits just above the model's measured height.
      const hp = model.parent!.children.find(
        (child) => child instanceof THREE.Mesh && child.geometry instanceof THREE.PlaneGeometry,
      );
      expect(hp?.position.y).toBeCloseTo(entry.height + 0.2, 6);
      // The four ordinaries keep the neutral candidate art; no identity is unknown.
      const enemies = (scene as unknown as { enemies: Map<string, { model: THREE.Group }> }).enemies;
      expect(
        [...enemies.entries()]
          .filter(([, visual]) => visual.model.getObjectByName("enemy-candidate-placeholder"))
          .map(([id]) => id),
      ).toEqual([1, 2, 3, 4].map((index) => `${spec.chapter.routeId}-encounter-${index}`));
      expect(enemies.get(`${spec.chapter.routeId}-boss`)?.model).toBe(model);
      expect((scene as unknown as { unsupportedContentCount: number }).unsupportedContentCount).toBe(0);

      // Loading the GLB swaps the fallback for the exact model and animates it.
      const exact = new THREE.Group();
      exact.name = `exact-${spec.bossEntryId}`;
      model.add(exact);
      bossAttachments[0]!.ready?.(exact, []);
      expect(fallback?.parent).toBeNull();
      expect(model.getObjectByName(exact.name)).toBe(exact);
      expect(harness.animations).toBe(1);
      scene.dispose();
    });
  }

  it("is not offered to a child whose first chapter falls outside the boss window", () => {
    expect(registryFor(FAMILY_CATALOG_BOSS_WORLDS.clubhouse).offeredFor("2017-01-01", TODAY)).toEqual([]);
    expect(registryFor(FAMILY_CATALOG_BOSS_WORLDS.playroom).offeredFor("2017-06-01", TODAY)).toEqual([]);
  });
});
