import { describe, expect, it, vi } from "vitest";
import {
  LEVEL_EDITOR_PROJECT_MAX_BYTES,
  LevelEditorProjectValidationError,
} from "../../src/shared/editor-project";
import {
  EDITOR_STORAGE_KEY,
  ensureImportSize,
  loadEditorDraft,
  readableProjectFilename,
  saveEditorDraft,
} from "../../src/client/editor/editor-storage";

describe("level editor browser storage helpers", () => {
  it("distinguishes an empty slot, a project and a corrupt saved draft", () => {
    expect(loadEditorDraft({ getItem: () => null }, JSON.parse)).toEqual({
      kind: "empty",
    });
    expect(
      loadEditorDraft({ getItem: () => '{"ok":true}' }, JSON.parse),
    ).toEqual({ kind: "project", project: { ok: true } });
    expect(loadEditorDraft({ getItem: () => "{" }, JSON.parse)).toEqual({
      kind: "corrupt",
      raw: "{",
    });
  });

  it("writes only the versioned project key", () => {
    const setItem = vi.fn();
    saveEditorDraft({ setItem }, "project-json");
    expect(setItem).toHaveBeenCalledWith(EDITOR_STORAGE_KEY, "project-json");
  });

  it("uses the shared import byte limit and shared error wording", () => {
    expect(() => ensureImportSize("{}")).not.toThrow();
    expect(() =>
      ensureImportSize("x".repeat(LEVEL_EDITOR_PROJECT_MAX_BYTES + 1)),
    ).toThrow(LevelEditorProjectValidationError);
    try {
      ensureImportSize("x".repeat(LEVEL_EDITOR_PROJECT_MAX_BYTES + 1));
    } catch (error) {
      expect((error as LevelEditorProjectValidationError).issues[0]?.message).toBe(
        `JSON data must be no larger than ${LEVEL_EDITOR_PROJECT_MAX_BYTES} bytes`,
      );
    }
  });

  it("creates a readable deterministic export filename", () => {
    expect(readableProjectFilename("  My Block Party!  ")).toBe(
      "my-block-party.json",
    );
    expect(readableProjectFilename("🎈")).toBe("untitled-adventure.json");
  });
});
