/** Synthetic family release v5: frozen history, exact casts and photo carry. */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildFamilyWorldAV5, familyWorldAV5Commands, FAMILY_A4_V5_SCRIPTED_SCARES, FAMILY_WORLD_A_V5_COMMANDS_URL, FAMILY_WORLD_A_V5_PROJECT_URL } from "../../../scripts/levels/build-family-world-a-v5";
import { buildFamilyWorldBV5, familyWorldBV5Commands, FAMILY_WORLD_B_V5_COMMANDS_URL, FAMILY_WORLD_B_V5_PROJECT_URL } from "../../../scripts/levels/build-family-world-b-v5";
import { parodyArtwork } from "../../../src/game/scene-catalog";
import { validateFamilyWorldPlan } from "../../../src/server/family/plan";
import { rebaseWorldForChild } from "../../../src/server/family/rebase";
import { FamilyTemplateRegistry } from "../../../src/server/family/templates";
import { serializeLevelEditorProject } from "../../../src/shared/editor-project";
import { familyHarness, HARNESS_TODAY } from "./harness";
import { TEST_CHILD_B, TEST_CHILD_C, syntheticLibrary } from "./fake-immich";

const registry = new FamilyTemplateRegistry();
const ACTOR = "30000000-0000-4000-8000-000000000001";
const FROZEN = {
  "family-world-a": [
    "b0bf1dc783d077b69765604cc6e933b779404c84686d076504cb52b844d53008",
    "ceb086efa885920168b5227e52de24b805ebabdc47d1894f1d92a0b14500a3c5",
    "1725587923dce4cfe7e28d2bc04b85e1aea13cf7185c0e6eaec525d0a633c8ca",
    "d743503c54e6a58ff70da15fc945925844e2fa502c816ea50754e3bd318940ac",
  ],
  "family-world-b": [
    "57bf3173a9951cf9987d503a47406a268f00b7eb970f038cfd7ac7394f730a69",
    "aa8c85a2fc59c4d6cbc0c626f66403fc8cfd4d5b6f29c36d1daeb66e4ef48d27",
    "a89c401dc79f58dc6ba738a38a831bc9b1253a130ac7a6dad7aee278a96caae1",
    "5be6486493dee8dcb8685287fb37c1ef4694bf26591bc1a1fbd2d4ca28302e18",
  ],
} as const;
const WORLDS = {
  "family-world-a": {
    child: TEST_CHILD_C, memories: 12, build: buildFamilyWorldAV5, commands: familyWorldAV5Commands,
    commandUrl: FAMILY_WORLD_A_V5_COMMANDS_URL, projectUrl: FAMILY_WORLD_A_V5_PROJECT_URL,
    cast: {
      2: { "ordinary-1": "putty-grunt", "ordinary-2": "lab-robot", "ordinary-3": "putty-grunt", "ordinary-4": "lab-robot", boss: "inator-monster", "bonus-1": "lab-robot" },
      3: { "bonus-1": "radio-host-showman" },
    },
  },
  "family-world-b": {
    child: TEST_CHILD_B, memories: 9, build: buildFamilyWorldBV5, commands: familyWorldBV5Commands,
    commandUrl: FAMILY_WORLD_B_V5_COMMANDS_URL, projectUrl: FAMILY_WORLD_B_V5_PROJECT_URL,
    cast: { 2: { "ordinary-1": "demon-band-idol", "ordinary-2": "demon-band-idol", "ordinary-3": "demon-band-idol", "ordinary-4": "demon-band-idol" } },
  },
} as const;

describe.each(Object.entries(WORLDS) as [keyof typeof WORLDS, (typeof WORLDS)[keyof typeof WORLDS]][])("%s@v5", (world, spec) => {
  const v4 = registry.require(world, "v4");
  const v5 = registry.require(world, "v5");

  it("replays the new command history and keeps v1–v4 fingerprints", () => {
    expect(registry.list().filter((entry) => entry.id === world).map((entry) => entry.version)).toEqual(["v1", "v2", "v3", "v4", "v5"]);
    for (const [index, fingerprint] of FROZEN[world].entries())
      expect(registry.require(world, `v${index + 1}`).fingerprint).toBe(fingerprint);
    expect(readFileSync(spec.commandUrl, "utf8")).toBe(`${JSON.stringify(spec.commands(), null, 2)}\n`);
    expect(readFileSync(spec.projectUrl, "utf8")).toBe(serializeLevelEditorProject(spec.build()));
    expect(v5.project.catalogVersion).toBe("parody-catalog-v11");
    expect(v5.fingerprint).not.toBe(v4.fingerprint);
  });

  it("changes the intended candidate slots to exact GLBs without altering old chapters or dates", () => {
    expect(v5.project.chapters.map((chapter) => [chapter.chapterId, chapter.routeId, chapter.recoveredAge, chapter.representedDateRange])).toEqual(
      v4.project.chapters.map((chapter) => [chapter.chapterId, chapter.routeId, chapter.recoveredAge, chapter.representedDateRange]),
    );
    expect(v5.ageBands).toEqual(v4.ageBands);
    expect(v5.project.enemyCandidates).toEqual([]);
    if (world === "family-world-a") {
      expect(FAMILY_A4_V5_SCRIPTED_SCARES).toEqual([
        { id: "foyer-ticket-flash", encounterSlot: "ordinary-1", position: { x: 0, y: 0, z: -2.5 }, radius: 1.3 },
        { id: "rat-pit-runway-lunge", encounterSlot: "boss", position: { x: -25.5, y: 16.5, z: -139.5 }, radius: 1.8 },
      ]);
      expect(v4.project.chapters[3]!.level.scriptedScares).toBeUndefined();
      expect(v5.project.chapters[3]!.level.scriptedScares).toEqual(FAMILY_A4_V5_SCRIPTED_SCARES);
      expect(v5.project.chapters[3]!.level.scare).toBe(2);
    }
    for (const [index, slots] of Object.entries(spec.cast))
      for (const [slot, id] of Object.entries(slots) as [string, string][]) {
        const old = (v4.project.chapters[Number(index)]!.encounterSlots as Record<string, unknown>)[slot];
        expect(old).toEqual({ source: "candidate", candidateId: id });
        expect((v5.project.chapters[Number(index)]!.encounterSlots as Record<string, unknown>)[slot]).toEqual({ source: "catalog", catalogEntryId: id, catalogEntryVersion: "v001" });
        expect(parodyArtwork({ catalogEntryId: id, catalogEntryVersion: "v001", assetId: id, assetVersion: "v001" })).toMatchObject({
          kind: "single", id, url: `/studio/assets/media/${id}/v001/${id}.glb`, contactFraction: 0.625,
        });
      }
    const rebased = (project: typeof v4.project) => rebaseWorldForChild(project, spec.child.birthDate, HARNESS_TODAY).chapters.map((chapter) =>
      [chapter.chapterId, chapter.startAge, chapter.recoveredAge, chapter.startDate, chapter.targetDate]);
    expect(rebased(v5.project)).toEqual(rebased(v4.project));
  });

  it("upgrades a v4 synthetic child to v5 carrying all photos and captions", async () => {
    const harness = familyHarness({
      people: world === "family-world-a" ? [{ id: spec.child.personId, name: spec.child.name, birthDate: spec.child.birthDate }] : [],
      assets: syntheticLibrary(spec.child),
    });
    const [person] = await harness.service.lookupPeople(spec.child.name);
    const child = await harness.service.createChild({
      immichName: spec.child.name, personChoiceId: person!.id, displayName: "Synthetic Child",
      birthDate: spec.child.birthDate, templateId: world, templateVersion: "v4",
    }, ACTOR);
    const picked = await harness.service.autoPick(child.id, ACTOR);
    expect(picked).toMatchObject({ publishable: true, templateVersion: "v4" });
    const first = await harness.service.publish(child.id, picked.revision, randomUUID(), ACTOR);
    const before = (await harness.familyStore.getPublication(first.publicationId))!;
    const upgrade = await harness.service.upgradeTemplate(child.id, {
      templateId: world, templateVersion: "v5", expectedRevision: picked.revision,
    }, ACTOR);
    expect(upgrade).toMatchObject({ carried: spec.memories, total: spec.memories, needsPhoto: 0 });
    expect(upgrade.draft).toMatchObject({ templateVersion: "v5", publishable: true });
    await harness.service.publish(child.id, upgrade.draft.revision, randomUUID(), ACTOR);
    const after = (await harness.familyStore.latestPublication(child.id))!;
    expect(after.memories).toEqual(before.memories);
    expect(after.plan.template).toEqual({ id: world, version: "v5", fingerprint: v5.fingerprint });
    expect(after.plan.catalogVersion).toBe("parody-catalog-v11");
    expect(validateFamilyWorldPlan(after.plan, { birthDate: after.birthDate, memories: after.memories })).toEqual([]);
    if (world === "family-world-a") {
      expect(after.plan.levels[3]!.authoredLevel.scriptedScares).toEqual(FAMILY_A4_V5_SCRIPTED_SCARES);
      const tampered = {
        ...after.plan,
        levels: after.plan.levels.map((level, index) => {
          if (index !== 3) return level;
          const { scriptedScares: _scriptedScares, ...authoredLevel } = level.authoredLevel;
          return { ...level, authoredLevel };
        }),
      };
      expect(validateFamilyWorldPlan(tampered, { birthDate: after.birthDate, memories: after.memories })).toContain("plan.geometry-fingerprint");
    }
    expect(registry.newestUpgrade(world, "v5", spec.child.birthDate, HARNESS_TODAY)).toBeNull();
  });
});
