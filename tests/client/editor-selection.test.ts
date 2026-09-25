import { describe, expect, it } from "vitest";
import { createLevelEditorProject, resolveLevelEditorProject } from "../../src/shared/editor-project";
import ratCasinoV2 from "../../src/shared/levels/rat-casino-world-v2.json";
import {
  anchorForSlot,
  objectRows,
  selectionFromIssuePath,
  uniquePieceId,
} from "../../src/client/editor/editor-selection";

const project = createLevelEditorProject({
  projectId: "project-editor-selection-test",
});
const level = project.chapters[0].level;

describe("level editor object selection", () => {
  it("lists course pieces and every fixed gameplay slot", () => {
    const rows = objectRows(level);
    expect(rows.filter((row) => row.group === "Gameplay")).toHaveLength(16);
    expect(rows.some((row) => row.key === "piece:welcome")).toBe(true);
    expect(rows.some((row) => row.key === "anchor:encounter.boss")).toBe(true);
  });

  it("resolves gameplay slots and validation paths to selections", () => {
    expect(anchorForSlot(level, "memory.major")).toBe(
      level.anchors.memories.major,
    );
    expect(
      selectionFromIssuePath(
        level,
        '$.chapters[0].level.anchors.encounters["boss"].arena.minX',
      ),
    ).toEqual({ type: "anchor", slot: "encounter.boss" });
    expect(
      selectionFromIssuePath(level, "$.chapters[0].level.pieces[0].size.x"),
    ).toEqual({ type: "piece", id: "welcome" });
  });

  it("shows a bonus marker only in a chapter that authors one", () => {
    expect(objectRows(level).some((row) => row.key === "anchor:encounter.bonus-1")).toBe(false);
    const bonusLevel = resolveLevelEditorProject(ratCasinoV2).levels["rat-casino-v2"]!.document;
    expect(objectRows(bonusLevel).some((row) => row.key === "anchor:encounter.bonus-1")).toBe(true);
    expect(anchorForSlot(bonusLevel, "encounter.bonus-1")).toEqual(
      bonusLevel.anchors.encounters["bonus-1"],
    );
  });

  it("creates stable unique piece IDs", () => {
    expect(uniquePieceId(level, "new-platform")).toBe("new-platform");
    expect(uniquePieceId(level, "welcome")).toBe("welcome-2");
  });
});
