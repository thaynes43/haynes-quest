// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  commitEditorHistory,
  createEditorHistory,
  isTextEntryTarget,
  redoEditorHistory,
  replaceEditorSelection,
  undoEditorHistory,
} from "../../src/client/editor/editor-history";

describe("level editor history", () => {
  it("bounds transactions and clears redo after a new edit", () => {
    let history = createEditorHistory({
      project: { revision: 0, value: "zero" },
      selection: "a",
    });
    history = commitEditorHistory(
      history,
      { project: { revision: 1, value: "one" }, selection: "b" },
      1,
    );
    history = commitEditorHistory(
      history,
      { project: { revision: 2, value: "two" }, selection: "c" },
      1,
    );
    expect(history.past.map((entry) => entry.project.value)).toEqual(["one"]);
    expect(history.future).toEqual([]);
  });

  it("rebases undo and redo snapshots while restoring their selections", () => {
    const first = createEditorHistory({
      project: { revision: 2, value: "first" },
      selection: "first-selection",
    });
    const edited = commitEditorHistory(first, {
      project: { revision: 3, value: "second" },
      selection: "second-selection",
    });
    const undone = undoEditorHistory(edited, (project) => ({
      ...project,
      revision: 4,
    }));
    expect(undone.present).toEqual({
      project: { revision: 4, value: "first" },
      selection: "first-selection",
    });
    const redone = redoEditorHistory(undone, (project) => ({
      ...project,
      revision: 5,
    }));
    expect(redone.present).toEqual({
      project: { revision: 5, value: "second" },
      selection: "second-selection",
    });
  });

  it("changes selection without creating an edit transaction", () => {
    const history = createEditorHistory({
      project: { revision: 0, value: "same" },
      selection: "before",
    });
    const selected = replaceEditorSelection(history, "after");
    expect(selected.past).toEqual([]);
    expect(selected.present.project).toBe(history.present.project);
    expect(selected.present.selection).toBe("after");
  });

  it("recognizes native text entry targets", () => {
    const input = document.createElement("input");
    const button = document.createElement("button");
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    expect(isTextEntryTarget(input)).toBe(true);
    expect(isTextEntryTarget(editable)).toBe(true);
    expect(isTextEntryTarget(button)).toBe(false);
    expect(isTextEntryTarget(null)).toBe(false);
  });
});
