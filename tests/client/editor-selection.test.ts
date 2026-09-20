import { describe, expect, it } from "vitest";
import { createLevelEditorProject } from "../../src/shared/editor-project";
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

  it("creates stable unique piece IDs", () => {
    expect(uniquePieceId(level, "new-platform")).toBe("new-platform");
    expect(uniquePieceId(level, "welcome")).toBe("welcome-2");
  });
});
