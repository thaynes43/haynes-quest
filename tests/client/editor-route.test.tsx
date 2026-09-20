// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RouteEditor } from "../../src/client/editor/RouteEditor";
import { createLevelEditorProject } from "../../src/shared/editor-project";

let container: HTMLDivElement;
let root: Root;

function change(textarea: HTMLTextAreaElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value",
  )!.set!;
  setter.call(textarea, value);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

function callbacks() {
  return {
    onAddConnection: vi.fn(),
    onUpdateConnection: vi.fn(),
    onRemoveConnection: vi.fn(),
    onSetMainPath: vi.fn(),
    onAddBranch: vi.fn(),
    onUpdateBranch: vi.fn(),
    onRemoveBranch: vi.fn(),
  };
}

describe("level editor route forms", () => {
  it("adds a structurally editable branch seed", async () => {
    const document = createLevelEditorProject({
      projectId: "project-editor-route-add-test",
    }).chapters[0].level;
    const handlers = callbacks();
    await act(async () =>
      root.render(<RouteEditor document={document} {...handlers} />),
    );

    const button = [...container.querySelectorAll("button")].find(
      (candidate) => candidate.textContent === "Add branch",
    )!;
    await act(async () => button.click());

    expect(handlers.onAddBranch).toHaveBeenCalledWith(
      document.mainPath.slice(0, 3),
    );
    expect(handlers.onAddBranch.mock.calls[0]![0]).toHaveLength(3);
  });

  it("cancels a main route edit on Escape without committing", async () => {
    const document = createLevelEditorProject({
      projectId: "project-editor-route-cancel-test",
    }).chapters[0].level;
    const handlers = callbacks();
    await act(async () =>
      root.render(<RouteEditor document={document} {...handlers} />),
    );
    const textarea = container.querySelector("textarea")!;

    await act(async () => {
      textarea.focus();
      change(textarea, "welcome, garden-hop-2");
      textarea.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });

    expect(handlers.onSetMainPath).not.toHaveBeenCalled();
    expect(textarea.value).toBe(document.mainPath.join(", "));
  });
});
