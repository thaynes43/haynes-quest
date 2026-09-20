// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthoredLevelDocument } from "../../src/shared/authored-level";
import {
  createLevelEditorProject,
  parseLevelEditorProjectJson,
  type LevelEditorChapterId,
  type LevelEditorProject,
} from "../../src/shared/editor-project";
import { EDITOR_STORAGE_KEY } from "../../src/client/editor/editor-storage";

/**
 * The real viewport needs WebGL, so only its imperative handle is stubbed. Its
 * frame calls are observable because "reframe the camera" must follow a
 * completed section and nothing else.
 */
const viewport = vi.hoisted(() => ({
  frameLevel: vi.fn(),
  frameSelection: vi.fn(),
  viewCenter: vi.fn(() => ({ x: 0, y: 0, z: 0 })),
}));

vi.mock("../../src/client/editor/EditorViewport", async () => {
  const ReactModule = await import("react");
  return {
    EditorViewport: ReactModule.forwardRef(function EditorViewportStub(
      _props: Readonly<Record<string, unknown>>,
      ref: React.ForwardedRef<typeof viewport>,
    ) {
      ReactModule.useImperativeHandle(ref, () => viewport, []);
      return ReactModule.createElement("div", {
        className: "editor-viewport-stub",
      });
    }),
  };
});

import { SectionBuilder } from "../../src/client/editor/SectionBuilder";
import { EditorWorkspace } from "../../src/client/editor/EditorWorkspace";

let container: HTMLDivElement;
let root: Root;
let animationFrame: ReturnType<typeof vi.spyOn>;

function levelFor(chapterId: LevelEditorChapterId): AuthoredLevelDocument {
  const project = createLevelEditorProject({
    projectId: `project-section-builder-${chapterId}`,
  });
  return project.chapters.find((chapter) => chapter.chapterId === chapterId)!
    .level;
}

function field(scope: ParentNode, label: string): HTMLElement {
  const owner = [...scope.querySelectorAll("label.editor-field")].find(
    (candidate) => candidate.querySelector("span")?.textContent === label,
  );
  if (!owner) throw new Error(`No field labelled ${label}`);
  const control = owner.querySelector("select, input");
  if (!control) throw new Error(`Field ${label} has no control`);
  return control as HTMLElement;
}

function selectField(scope: ParentNode, label: string): HTMLSelectElement {
  return field(scope, label) as HTMLSelectElement;
}

function numberField(scope: ParentNode, label: string): HTMLInputElement {
  return field(scope, label) as HTMLInputElement;
}

function options(select: HTMLSelectElement): readonly string[] {
  return [...select.options].map((option) => option.value);
}

async function choose(select: HTMLSelectElement, value: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLSelectElement.prototype,
    "value",
  )!.set!;
  await act(async () => {
    setter.call(select, value);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function commitNumber(
  input: HTMLInputElement,
  text: string,
): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )!.set!;
  await act(async () => {
    input.focus();
    setter.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.blur();
  });
}

function button(scope: ParentNode, text: string): HTMLButtonElement {
  const match = [...scope.querySelectorAll("button")].find(
    (candidate) => candidate.textContent === text,
  );
  if (!match) throw new Error(`No button labelled ${text}`);
  return match;
}

async function press(scope: ParentNode, text: string): Promise<void> {
  const target = button(scope, text);
  await act(async () => target.click());
}

function builder(): HTMLElement {
  const section = container.querySelector<HTMLElement>(
    "section.editor-section-builder",
  );
  if (!section) throw new Error("The section builder is not mounted");
  return section;
}

function readout(scope: ParentNode): string {
  return scope.querySelector('p[role="status"]')!.textContent ?? "";
}

function addSectionButton(scope: ParentNode): HTMLButtonElement {
  return button(scope, "Add section");
}

/** Let the workspace's validation and autosave debounces run. */
async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 320));
  });
}

function savedDraft(): LevelEditorProject {
  const raw = window.localStorage.getItem(EDITOR_STORAGE_KEY);
  if (raw === null) throw new Error("Nothing was autosaved");
  return parseLevelEditorProjectJson(raw);
}

function savedPieceIds(chapterId: LevelEditorChapterId): readonly string[] {
  return savedDraft()
    .chapters.find((chapter) => chapter.chapterId === chapterId)!
    .level.pieces.map((piece) => piece.id);
}

function savedChapter(chapterId: LevelEditorChapterId) {
  return savedDraft().chapters.find(
    (chapter) => chapter.chapterId === chapterId,
  )!.level;
}

beforeEach(() => {
  window.localStorage.clear();
  container = window.document.createElement("div");
  window.document.body.append(container);
  root = createRoot(container);
  viewport.frameLevel.mockClear();
  viewport.frameSelection.mockClear();
  viewport.viewCenter.mockClear();
  viewport.viewCenter.mockReturnValue({ x: 0, y: 0, z: 0 });
  animationFrame = vi
    .spyOn(window, "requestAnimationFrame")
    .mockImplementation((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  animationFrame.mockRestore();
  window.localStorage.clear();
});

describe("section builder form", () => {
  it("opens on the shipped opening span of either chapter", async () => {
    const onBuild = vi.fn();
    await act(async () =>
      root.render(
        <SectionBuilder
          document={levelFor("chapter-1")}
          onBuild={onBuild}
          onSelectStart={vi.fn()}
        />,
      ),
    );
    expect(selectField(builder(), "Start platform").value).toBe("welcome");
    expect(selectField(builder(), "Rejoin platform").value).toBe("picnic");
    expect(selectField(builder(), "Shape").value).toBe("arch");
    expect(selectField(builder(), "Side").value).toBe("left");
    expect(numberField(builder(), "Climbing steps").value).toBe("4");
    expect(numberField(builder(), "Rise per step").value).toBe("0.3");
    expect(readout(builder())).toBe("7 platforms · top surface 1.2 units");
    expect(addSectionButton(builder()).disabled).toBe(false);
    // Moving supports cannot carry a fixed climb and are never offered.
    expect(options(selectField(builder(), "Start platform"))).not.toContain(
      "garden-ferry",
    );

    await act(async () =>
      root.render(
        <SectionBuilder
          document={levelFor("chapter-2")}
          onBuild={onBuild}
          onSelectStart={vi.fn()}
        />,
      ),
    );
    expect(selectField(builder(), "Start platform").value).toBe(
      "party-welcome",
    );
    expect(selectField(builder(), "Rejoin platform").value).toBe(
      "party-picnic",
    );
    expect(readout(builder())).toBe("7 platforms · top surface 1.2 units");
    expect(onBuild).not.toHaveBeenCalled();
  });

  it("refuses a fractional step count while still accepting a fractional rise", async () => {
    const onBuild = vi.fn();
    await act(async () =>
      root.render(
        <SectionBuilder
          document={levelFor("chapter-1")}
          onBuild={onBuild}
          onSelectStart={vi.fn()}
        />,
      ),
    );
    const steps = numberField(builder(), "Climbing steps");

    // A fraction that rounds back to the held value used to stay on screen
    // while the command kept building the integer underneath it.
    await commitNumber(steps, "4.4");
    expect(steps.value).toBe("4");
    expect(readout(builder())).toBe("7 platforms · top surface 1.2 units");

    await commitNumber(steps, "3.5");
    expect(steps.value).toBe("4");
    expect(readout(builder())).toBe("7 platforms · top surface 1.2 units");

    await commitNumber(steps, "5");
    expect(steps.value).toBe("5");
    expect(readout(builder())).toBe("9 platforms · top surface 1.5 units");

    const rise = numberField(builder(), "Rise per step");
    await commitNumber(rise, "0.25");
    expect(rise.value).toBe("0.25");
    expect(readout(builder())).toBe("9 platforms · top surface 1.25 units");

    await press(builder(), "Add section");
    expect(onBuild).toHaveBeenCalledOnce();
    expect(onBuild).toHaveBeenCalledWith({
      fromPlatformId: "welcome",
      toPlatformId: "picnic",
      pattern: "arch",
      side: "left",
      steps: 5,
      rise: 0.25,
    });
  });

  it("moves a late start to a rejoin that fits instead of the finish platform", async () => {
    const onSelectStart = vi.fn();
    await act(async () =>
      root.render(
        <SectionBuilder
          document={levelFor("chapter-1")}
          onBuild={vi.fn()}
          onSelectStart={onSelectStart}
        />,
      ),
    );
    await choose(selectField(builder(), "Start platform"), "woodland-rest");

    expect(onSelectStart).toHaveBeenCalledWith("woodland-rest");
    const rejoin = selectField(builder(), "Rejoin platform");
    expect(rejoin.value).toBe("memory-grove");
    expect(rejoin.value).not.toBe("garden-reward");
    expect(options(rejoin)).toContain("garden-reward");
    expect(readout(builder())).toBe("6 platforms · top surface 1.2 units");
    expect(addSectionButton(builder()).disabled).toBe(false);
  });

  it("shows a repairable fit issue and blocks a span that cannot hold the section", async () => {
    const onBuild = vi.fn();
    await act(async () =>
      root.render(
        <SectionBuilder
          document={levelFor("chapter-1")}
          onBuild={onBuild}
          onSelectStart={vi.fn()}
        />,
      ),
    );
    await choose(selectField(builder(), "Start platform"), "garden-hop-1");

    expect(selectField(builder(), "Rejoin platform").value).toBe(
      "garden-hop-2",
    );
    const status = builder().querySelector('p[role="status"]')!;
    expect(status.className).toBe("editor-section-warning");
    expect(status.textContent).toContain(
      "they are 4.2m apart. Use fewer climbing steps, or platforms further apart.",
    );
    expect(addSectionButton(builder()).disabled).toBe(true);

    await act(async () => addSectionButton(builder()).click());
    expect(onBuild).not.toHaveBeenCalled();
  });

  it("follows a viewport selection made after the panel is open", async () => {
    const onSelectStart = vi.fn();
    const level = levelFor("chapter-1");
    const render = (selectedPlatformId?: string) =>
      act(async () =>
        root.render(
          <SectionBuilder
            document={level}
            selectedPlatformId={selectedPlatformId}
            onBuild={vi.fn()}
            onSelectStart={onSelectStart}
          />,
        ),
      );

    await render();
    expect(selectField(builder(), "Start platform").value).toBe("welcome");

    await render("woodland-rest");
    expect(selectField(builder(), "Start platform").value).toBe(
      "woodland-rest",
    );
    expect(selectField(builder(), "Rejoin platform").value).toBe(
      "memory-grove",
    );
    // Following the viewport must not echo a selection back to it.
    expect(onSelectStart).not.toHaveBeenCalled();

    // A support the builder cannot start from leaves the form alone.
    await render("garden-ferry");
    expect(selectField(builder(), "Start platform").value).toBe(
      "woodland-rest",
    );
  });
});

describe("section builder inside the workspace", () => {
  async function openWorkspace(): Promise<void> {
    await act(async () =>
      root.render(<EditorWorkspace onPlaytest={vi.fn(async () => {})} />),
    );
    await press(container.querySelector(".editor-left-rail")!, "Add");
  }

  function projectStatus(): string {
    return container.querySelector(".editor-project-status")!.textContent ?? "";
  }

  it("commits a whole section as one undoable, autosaved edit", async () => {
    await openWorkspace();
    await press(builder(), "Add section");

    expect(projectStatus()).toBe("Ready to play");
    expect(container.querySelector(".editor-banner")).toBeNull();
    expect(viewport.frameSelection).toHaveBeenCalledOnce();

    await settle();
    const level = savedChapter("chapter-1");
    const stepIds = level.pieces
      .map((piece) => piece.id)
      .filter((id) => id.startsWith("arch-step-"));
    expect(stepIds).toEqual([
      "arch-step-1",
      "arch-step-2",
      "arch-step-3",
      "arch-step-4",
      "arch-step-5",
      "arch-step-6",
      "arch-step-7",
    ]);
    expect(
      level.pieces.filter((piece) => piece.id.startsWith("arch-checkpoint-")),
    ).toHaveLength(stepIds.length);
    expect(level.branches.at(-1)).toEqual(["welcome", ...stepIds, "picnic"]);
    // The main course and its required progression are untouched.
    expect(level.mainPath).toEqual(levelFor("chapter-1").mainPath);

    await press(container, "Undo");
    expect(projectStatus()).toBe("Ready to play");
    await settle();
    expect(
      savedPieceIds("chapter-1").filter((id) => id.startsWith("arch-")),
    ).toEqual([]);
    expect(button(container, "Redo").disabled).toBe(false);

    await press(container, "Redo");
    await settle();
    expect(
      savedPieceIds("chapter-1").filter((id) => id.startsWith("arch-step-")),
    ).toEqual(stepIds);
  });

  it("keeps the draft ready and the camera still when the command rejects a section", async () => {
    await openWorkspace();
    await choose(selectField(builder(), "Start platform"), "picnic");
    await choose(selectField(builder(), "Rejoin platform"), "winding-east");
    await choose(selectField(builder(), "Side"), "right");
    await commitNumber(numberField(builder(), "Climbing steps"), "3");

    // The fit preflight passes; only the published validators reject this one.
    expect(readout(builder())).toBe("5 platforms · top surface 0.9 units");
    expect(addSectionButton(builder()).disabled).toBe(false);
    const framesBefore = viewport.frameSelection.mock.calls.length;

    await press(builder(), "Add section");

    const banner = container.querySelector('.editor-banner[role="alert"]');
    expect(banner?.textContent).toContain("would add a new problem");
    expect(projectStatus()).toBe("Ready to play");
    expect(container.querySelector(".editor-issue-summary")).toBeNull();
    expect(button(container, "Undo").disabled).toBe(true);
    expect(viewport.frameSelection.mock.calls).toHaveLength(framesBefore);

    await settle();
    expect(projectStatus()).toBe("Ready to play");
    expect(
      savedPieceIds("chapter-1").filter((id) => id.startsWith("arch-")),
    ).toEqual([]);

    await press(container.querySelector(".editor-banner")!, "Dismiss");
    expect(container.querySelector(".editor-banner")).toBeNull();
  });

  it("names the first Level 2 zigzag section after the shape, not the shipped hops", async () => {
    await openWorkspace();
    await choose(
      container.querySelector<HTMLSelectElement>(
        'select[aria-label="Chapter"]',
      )!,
      "chapter-2",
    );
    await choose(selectField(builder(), "Shape"), "zigzag");
    await press(builder(), "Add section");
    await settle();

    const first = savedPieceIds("chapter-2");
    // "zigzag-hop-1/2" ship with the template and must not reserve the name.
    expect(first).toContain("zigzag-hop-1");
    expect(first).toContain("zigzag-step-1");
    expect(first).toContain("zigzag-checkpoint-1");
    expect(first.some((id) => id.startsWith("zigzag-2-"))).toBe(false);

    await choose(selectField(builder(), "Start platform"), "ribbon-rest");
    await choose(selectField(builder(), "Rejoin platform"), "party-dock");
    await press(builder(), "Add section");
    await settle();

    const second = savedPieceIds("chapter-2");
    expect(second).toContain("zigzag-2-step-1");
    expect(second).toContain("zigzag-step-1");
    expect(projectStatus()).toBe("Ready to play");
    // Level 1 keeps its own naming sequence.
    expect(
      savedPieceIds("chapter-1").some((id) => id.startsWith("zigzag-")),
    ).toBe(false);
  });
});
