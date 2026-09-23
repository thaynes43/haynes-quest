import { describe, expect, it } from "vitest";

import { draftEncounterLabel } from "../../src/client/era";
import type { EncounterView } from "../../src/shared/contracts";

function candidate(id: string, name: string): EncounterView {
  return {
    id,
    role: "ordinary",
    kind: "ordinary-a",
    maxHp: 4,
    hp: 4,
    attackDamage: 2,
    defeated: false,
    available: true,
    content: {
      catalogEntryId: `editor-candidate-${id}`,
      catalogEntryVersion: "draft-v1",
      assetId: "neutral-enemy-placeholder",
      assetVersion: "v001",
      displayName: name,
      placeholder: "neutral-candidate-v1",
    },
  };
}

describe("draft encounter target label", () => {
  it("shows the frozen identity of the nearby encounter even when two share a behavior kind", () => {
    const encounters = [
      candidate("arcade-rusher", "Arcade Rusher"),
      candidate("arcade-jester", "Arcade Jester"),
    ];
    expect(draftEncounterLabel(encounters, "arcade-rusher")).toBe("Arcade Rusher");
    expect(draftEncounterLabel(encounters, "arcade-jester")).toBe("Arcade Jester");
    expect(draftEncounterLabel(encounters, "missing")).toBeUndefined();
    expect(draftEncounterLabel([{ ...encounters[0]!, defeated: true }], "arcade-rusher"))
      .toBeUndefined();
  });
});
