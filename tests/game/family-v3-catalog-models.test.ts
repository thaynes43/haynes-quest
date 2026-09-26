// @vitest-environment jsdom
/**
 * The parody-catalog-v10 family-era models in the real v3 world templates
 * (PLAN-019 cast integration). `family-world-a@v3` and `family-world-b@v3`
 * publish into family plans for synthetic children, and the game scene loads
 * each new model's exact GLB for every encounter it fills in chapters one and
 * two, the same way the family-catalog-boss test loads a landed boss. No real
 * names, birthdays or photos: the children and memories are fakes.
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
import { createAdventureStateAtLevel, createInitialAdventureState, type AdventurePlan } from "../../src/shared/adventure";
import { addDays, FAMILY_ABILITY_LADDER, FAMILY_MEMORY_SLOTS } from "../../src/shared/family-plan";
import { parseStoredAdventure } from "../../src/server/adventure-schema";
import { toSaveView } from "../../src/server/domain";
import { buildFamilyWorldPlan, validateFamilyWorldPlan } from "../../src/server/family/plan";
import { rebaseWorldForChild } from "../../src/server/family/rebase";
import { familyWorldView, newFamilySave } from "../../src/server/family/saves";
import type { ChildRecord, PublicationRecord } from "../../src/server/family/store";
import { FamilyTemplateRegistry } from "../../src/server/family/templates";
import { resolveFamilyWorld } from "../../src/client/family/family-world";
import { createLevelLayout } from "../../src/game/level";
import { GardenScene } from "../../src/game/scene";
import { parodyArtwork } from "../../src/game/scene-catalog";

const TODAY = "2026-09-25";
const REPOSITORY = join(dirname(fileURLToPath(import.meta.url)), "../..");
const registry = new FamilyTemplateRegistry();

/** Synthetic children the worlds are offered to (fictional birthdays). */
const CHILDREN = {
  "family-world-a": { personId: "00000000-0000-4000-8000-0000000000a3", birthDate: "2015-03-10" },
  "family-world-b": { personId: "00000000-0000-4000-8000-0000000000b3", birthDate: "2020-02-29" },
} as const;

/** Each new model, the chapter it fills and the encounters it fills there. */
const CASES = [
  { world: "family-world-a", chapter: 0, model: "gadget-helper", slots: ["encounter-1", "encounter-2", "encounter-3", "encounter-4"], height: 1.118245 },
  { world: "family-world-a", chapter: 1, model: "mischief-kitten", slots: ["encounter-1", "encounter-2", "encounter-3", "encounter-4", "encounter-bonus-1"], height: 0.9186895485603485 },
  { world: "family-world-a", chapter: 1, model: "rival-mayor", slots: ["boss"], height: 2.4745 },
  { world: "family-world-b", chapter: 0, model: "yes-yes-veggie", slots: ["encounter-1", "encounter-2", "encounter-3", "encounter-4"], height: 0.997798 },
  { world: "family-world-b", chapter: 1, model: "bin-chicken", slots: ["encounter-1", "encounter-2", "encounter-3", "encounter-4"], height: 1.2570000538098558 },
  { world: "family-world-b", chapter: 1, model: "magic-house", slots: ["boss"], height: 2.898 },
] as const;

function publish(world: keyof typeof CHILDREN) {
  const child = CHILDREN[world];
  const template = registry.require(world, "v3");
  const rebased = rebaseWorldForChild(template.project, child.birthDate, TODAY);
  let index = 0;
  const selections = rebased.chapters.flatMap((chapter) =>
    FAMILY_MEMORY_SLOTS.map((slot) => {
      index += 1;
      return {
        chapterId: chapter.chapterId,
        slot,
        assetId: `20000000-0000-4000-9000-${String(index).padStart(12, "0")}`,
        personId: child.personId,
        localDate: slot === "major" ? chapter.targetDate : addDays(chapter.startDate, slot === "minor-one" ? 60 : 300),
        caption: slot === "major" ? `Turning ${chapter.recoveredAge}!` : `Synthetic memory ${index}`,
        opaque: `asset-${String(index).padStart(32, "0")}`,
      };
    }),
  );
  return { child, ...buildFamilyWorldPlan({ template, world: rebased, selections, ladder: FAMILY_ABILITY_LADDER }) };
}

/** A household save on `world`'s plan, started at chapter `chapter`. */
function sceneAt(world: keyof typeof CHILDREN, chapter: number) {
  const { child, plan, memories, versions } = publish(world);
  const publication = {
    id: "30000000-0000-4000-8000-000000000003",
    childId: "30000000-0000-4000-8000-00000000003c",
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
  // Chapter two starts as if chapter one was completed legitimately.
  const state = createAdventureStateAtLevel(record.adventurePlan as AdventurePlan, chapter);
  Object.assign(record, {
    adventureState: state,
    ageYears: state.ageYears,
    abilities: [...state.abilities],
    appearanceStage: state.appearanceStage,
    recoveredIds: [...state.revealedMemoryIds],
  });
  const save = toSaveView(record, new Date(1_000));
  const { resolver } = resolveFamilyWorld(familyWorldView(record));
  const scene = new GardenScene(document.createElement("div"), createLevelLayout(save, resolver), save);
  const routeId = plan.levels[chapter]!.routeId;
  return { scene, save, routeId };
}

describe("the parody-catalog-v10 models in the v3 family worlds", () => {
  beforeEach(() => {
    harness.attachments.length = 0;
    harness.animations = 0;
  });

  afterEach(() => vi.restoreAllMocks());

  it.each(["family-world-a", "family-world-b"] as const)(
    "%s@v3 publishes a valid plan that freezes each new model's catalog identity",
    (world) => {
      const { child, plan, memories } = publish(world);
      expect(plan.catalogVersion).toBe("parody-catalog-v10");
      expect(plan.template).toMatchObject({ id: world, version: "v3" });
      expect(validateFamilyWorldPlan(plan, { birthDate: child.birthDate, memories })).toEqual([]);
      expect(() => parseStoredAdventure(plan, createInitialAdventureState(plan))).not.toThrow();
      for (const entry of CASES.filter((item) => item.world === world)) {
        const level = plan.levels[entry.chapter]!;
        for (const slot of entry.slots) {
          const encounter = level.encounters.find((item) => item.id === `${level.routeId}-${slot}`)!;
          expect(encounter.content, `${entry.model} ${slot}`).toEqual({
            catalogEntryId: entry.model,
            catalogEntryVersion: "v001",
            assetId: entry.model,
            assetVersion: "v001",
          });
        }
      }
      // A plan claiming v9 no longer validates the v10 cast.
      expect(
        validateFamilyWorldPlan({ ...plan, catalogVersion: "parody-catalog-v9" }, { birthDate: child.birthDate, memories }),
      ).toContain("level.cast");
    },
  );

  for (const entry of CASES) {
    it(`${entry.world}@v3 chapter ${entry.chapter + 1}: the scene loads ${entry.model}'s exact GLB for each of its encounters`, () => {
      const { scene, routeId } = sceneAt(entry.world, entry.chapter);
      const url = `/studio/assets/media/${entry.model}/v001/${entry.model}.glb`;
      const artwork = parodyArtwork({
        catalogEntryId: entry.model,
        catalogEntryVersion: "v001",
        assetId: entry.model,
        assetVersion: "v001",
      });
      expect(artwork).toMatchObject({ kind: "single", url, height: entry.height, contactFraction: 0.625 });
      expect(existsSync(join(REPOSITORY, "docs", url.replace(/^\/studio\//, "")))).toBe(true);

      const enemies = (scene as unknown as { enemies: Map<string, { model: THREE.Group }> }).enemies;
      const attachments = harness.attachments.filter((attachment) => attachment.url === url);
      expect(attachments).toHaveLength(entry.slots.length);
      for (const [index, slot] of entry.slots.entries()) {
        const model = enemies.get(`${routeId}-${slot}`)?.model;
        expect(model, slot).toBeDefined();
        expect(attachments[index]!.target, slot).toBe(model);
        // The neutral fallback waits for the GLB; no candidate placeholder.
        expect(model!.getObjectByName("encounter-artwork-fallback")?.parent).toBe(model);
        expect(model!.getObjectByName("enemy-candidate-placeholder")).toBeUndefined();
        // The health bar sits just above the model's logged height.
        const hp = model!.parent!.children.find(
          (child) => child instanceof THREE.Mesh && child.geometry instanceof THREE.PlaneGeometry,
        );
        expect(hp?.position.y, slot).toBeCloseTo(entry.height + 0.2, 6);
      }
      // Chapters one and two cast only catalog models: nothing is a placeholder.
      expect(
        [...enemies.values()].filter((visual) => visual.model.getObjectByName("enemy-candidate-placeholder")),
      ).toEqual([]);
      expect((scene as unknown as { unsupportedContentCount: number }).unsupportedContentCount).toBe(0);

      // Loading the GLB swaps each fallback for the exact model and animates it.
      for (const [index, attachment] of attachments.entries()) {
        const exact = new THREE.Group();
        exact.name = `exact-${entry.model}-${index}`;
        attachment.target.add(exact);
        const fallback = attachment.target.getObjectByName("encounter-artwork-fallback");
        attachment.ready?.(exact, []);
        expect(fallback?.parent ?? null).toBeNull();
        expect(attachment.target.getObjectByName(exact.name)).toBe(exact);
      }
      expect(harness.animations).toBe(attachments.length);
      scene.dispose();
    });
  }

  it("keeps chapter three's candidates on placeholder art (no model has landed)", () => {
    const { scene, routeId } = sceneAt("family-world-a", 2);
    const enemies = (scene as unknown as { enemies: Map<string, { model: THREE.Group }> }).enemies;
    expect(
      [...enemies.entries()]
        .filter(([, visual]) => visual.model.getObjectByName("enemy-candidate-placeholder"))
        .map(([id]) => id)
        .sort(),
    ).toEqual(
      ["boss", "encounter-1", "encounter-2", "encounter-3", "encounter-4", "encounter-bonus-1"]
        .map((slot) => `${routeId}-${slot}`)
        .sort(),
    );
    scene.dispose();
  });
});
