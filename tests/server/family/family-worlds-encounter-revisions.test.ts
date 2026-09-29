/** New encounter revisions keep old publications frozen while densifying every chapter. */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildFamilyWorldAV7, familyWorldAV7Commands, FAMILY_WORLD_A_V7_COMMANDS_URL, FAMILY_WORLD_A_V7_PROJECT_URL } from "../../../scripts/levels/build-family-world-a-v7.js";
import { buildFamilyWorldBV6, familyWorldBV6Commands, FAMILY_WORLD_B_V6_COMMANDS_URL, FAMILY_WORLD_B_V6_PROJECT_URL } from "../../../scripts/levels/build-family-world-b-v6.js";
import { newFamilySave } from "../../../src/server/family/saves.js";
import { validateSaveRecord } from "../../../src/server/domain.js";
import { validateFamilyWorldPlan } from "../../../src/server/family/plan.js";
import { rebaseWorldForChild } from "../../../src/server/family/rebase.js";
import { FamilyTemplateRegistry } from "../../../src/server/family/templates.js";
import { lintFamilyChapter } from "../../../src/shared/family-world-lint.js";
import { serializeLevelEditorProject } from "../../../src/shared/editor-project.js";
import { familyHarness, HARNESS_TODAY } from "./harness.js";
import { TEST_CHILD_B, TEST_CHILD_C, syntheticLibrary } from "./fake-immich.js";

const registry = new FamilyTemplateRegistry();
const ACTOR = "30000000-0000-4000-8000-000000000001";
const worlds = [
  { id: "family-world-a", old: "v6", next: "v7", child: TEST_CHILD_C, memoryCount: 12, build: buildFamilyWorldAV7, commands: familyWorldAV7Commands, commandsUrl: FAMILY_WORLD_A_V7_COMMANDS_URL, projectUrl: FAMILY_WORLD_A_V7_PROJECT_URL, lintWorld: "a" },
  { id: "family-world-b", old: "v5", next: "v6", child: TEST_CHILD_B, memoryCount: 9, build: buildFamilyWorldBV6, commands: familyWorldBV6Commands, commandsUrl: FAMILY_WORLD_B_V6_COMMANDS_URL, projectUrl: FAMILY_WORLD_B_V6_PROJECT_URL, lintWorld: "b" },
] as const;

describe.each(worlds)("$id@$next denser encounters", (world) => {
  const old = registry.require(world.id, world.old);
  const next = registry.require(world.id, world.next);

  it("replays its editor commands and preserves the frozen world, ages, memories and cast", () => {
    expect(readFileSync(world.commandsUrl, "utf8")).toBe(`${JSON.stringify(world.commands(), null, 2)}\n`);
    expect(readFileSync(world.projectUrl, "utf8")).toBe(serializeLevelEditorProject(world.build()));
    expect(next.fingerprint).not.toBe(old.fingerprint);
    expect(next.ageBands).toEqual(old.ageBands);
    expect(next.project.catalogVersion).toBe(old.project.catalogVersion);
    expect(next.friendlyCatalogVersion).toBe(old.friendlyCatalogVersion);
    expect(next.project.chapters).toHaveLength(old.project.chapters.length);
    for (const [index, chapter] of next.project.chapters.entries()) {
      const prior = old.project.chapters[index]!;
      expect(chapter.chapterId).toBe(prior.chapterId);
      expect(chapter.routeId).toBe(prior.routeId);
      expect(chapter.recoveredAge).toEqual(prior.recoveredAge);
      expect(chapter.representedDateRange).toEqual(prior.representedDateRange);
      expect(chapter.previewMemories).toEqual(prior.previewMemories);
      expect(chapter.level.anchors.memories).toEqual(prior.level.anchors.memories);
      expect(chapter.level.anchors.pickups).toEqual(prior.level.anchors.pickups);
      expect(chapter.level.anchors.friendlies).toEqual(prior.level.anchors.friendlies);
      expect(chapter.level.mainPath).toEqual(prior.level.mainPath);
      expect(chapter.level.connections).toEqual(prior.level.connections);
      expect(chapter.bossPrerequisiteDefeats).toBe(2);
      expect(prior.bossPrerequisiteDefeats).toBeUndefined();
      const slots = Object.keys(chapter.encounterSlots);
      expect(slots).toEqual(expect.arrayContaining(["ordinary-1", "ordinary-2", "ordinary-3", "ordinary-4", "bonus-1", "bonus-2", "boss"]));
      expect(slots).toHaveLength(7);
      for (const slot of ["ordinary-1", "ordinary-2", "ordinary-3", "ordinary-4", "boss"] as const) {
        expect(chapter.encounterSlots[slot]).toEqual(prior.encounterSlots[slot]);
        expect(chapter.level.anchors.encounters[slot]).toEqual(prior.level.anchors.encounters[slot]);
      }
      for (const slot of ["bonus-1", "bonus-2"] as const) {
        expect(chapter.encounterSlots[slot]?.source).toBe("catalog");
        expect(chapter.level.anchors.encounters[slot]?.kind).not.toBe("boss");
      }
      expect(lintFamilyChapter(chapter.level, { world: world.lintWorld }).filter((finding) => finding.severity === "error")).toEqual([]);
    }
    expect(registry.require(world.id, world.old).fingerprint).toBe(old.fingerprint);
    expect(rebaseWorldForChild(next.project, world.child.birthDate, HARNESS_TODAY).chapters)
      .toEqual(rebaseWorldForChild(old.project, world.child.birthDate, HARNESS_TODAY).chapters);
  });

  it("carries synthetic photos and captions through Update world while old started saves keep their plan", async () => {
    const harness = familyHarness({
      people: world.id === "family-world-a" ? [{ id: world.child.personId, name: world.child.name, birthDate: world.child.birthDate }] : [],
      assets: syntheticLibrary(world.child),
    });
    const [person] = await harness.service.lookupPeople(world.child.name);
    const child = await harness.service.createChild({
      immichName: world.child.name, personChoiceId: person!.id, displayName: "Synthetic Child",
      birthDate: world.child.birthDate, templateId: world.id, templateVersion: world.old,
    }, ACTOR);
    let draft = await harness.service.autoPick(child.id, ACTOR);
    draft = await harness.service.setCaption(child.id, draft.revision, next.project.chapters[0]!.chapterId, "minor-one", "Synthetic day at the park", ACTOR);
    const first = await harness.service.publish(child.id, draft.revision, randomUUID(), ACTOR);
    const before = (await harness.familyStore.getPublication(first.publicationId))!;
    const storedChild = (await harness.familyStore.getChild(child.id))!;
    const started = newFamilySave({ publication: before, child: storedChild, startedBy: ACTOR, now: new Date() });
    const upgrade = await harness.service.upgradeTemplate(child.id, {
      templateId: world.id, templateVersion: world.next, expectedRevision: draft.revision,
    }, ACTOR);
    expect(upgrade).toMatchObject({ carried: world.memoryCount, total: world.memoryCount, needsPhoto: 0 });
    expect(upgrade.draft.publishable).toBe(true);
    expect(upgrade.draft.chapters[0]!.slots[0]).toMatchObject({ caption: "Synthetic day at the park", captionEdited: true });
    await harness.service.publish(child.id, upgrade.draft.revision, randomUUID(), ACTOR);
    const after = (await harness.familyStore.latestPublication(child.id))!;
    expect(after.memories).toEqual(before.memories);
    expect(after.plan.template).toEqual({ id: world.id, version: world.next, fingerprint: next.fingerprint });
    expect(after.plan.levels.map((level) => level.bossPrerequisiteDefeats)).toEqual(next.project.chapters.map(() => 2));
    expect(validateFamilyWorldPlan(after.plan, { birthDate: after.birthDate, memories: after.memories })).toEqual([]);
    expect(validateSaveRecord(started).adventurePlan).toEqual(before.plan);
    expect(started.adventurePlan).toMatchObject({ template: { id: world.id, version: world.old, fingerprint: old.fingerprint } });
  });
});
