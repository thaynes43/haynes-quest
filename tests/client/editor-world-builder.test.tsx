// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createLevelEditorProject,
  createWorldEditorProject,
  isLevelEditorProjectV2,
  parseLevelEditorProjectJson,
} from "../../src/shared/editor-project";
import { EDITOR_STORAGE_KEY } from "../../src/client/editor/editor-storage";

vi.mock("../../src/client/editor/EditorViewport", async () => {
  const ReactModule = await import("react");
  return {
    EditorViewport: ReactModule.forwardRef(function EditorViewportStub(
      _props: Readonly<Record<string, unknown>>,
      ref: React.ForwardedRef<unknown>,
    ) {
      ReactModule.useImperativeHandle(ref, () => ({
        frameLevel() {},
        frameSelection() {},
        viewCenter: () => ({ x: 0, y: 0, z: 0 }),
      }));
      return ReactModule.createElement("div", { className: "editor-viewport-stub" });
    }),
  };
});

import { EditorWorkspace } from "../../src/client/editor/EditorWorkspace";

let container: HTMLDivElement;
let root: Root;
let animationFrame: ReturnType<typeof vi.spyOn>;

function button(label: string): HTMLButtonElement {
  const found = [...container.querySelectorAll("button")].find(
    (item) => item.textContent?.trim() === label,
  );
  if (!found) throw new Error(`Missing button: ${label}`);
  return found;
}

async function press(label: string) {
  await act(async () => button(label).click());
}

async function choose(select: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!;
  await act(async () => {
    setter.call(select, value);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function fill(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
    "value",
  )!.set!;
  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function settleAutosave() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 320));
  });
}

beforeEach(() => {
  window.localStorage.clear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  animationFrame = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
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

describe("complete world editor", () => {
  it("adds an independent level and stores its new theme in the v2 project", async () => {
    await act(async () => root.render(<EditorWorkspace onPlaytest={vi.fn(async () => {})} />));
    await press("Add level");
    await press("From garden course");
    expect(container.querySelectorAll(".editor-world-levels li")).toHaveLength(3);

    const theme = [...container.querySelectorAll("label.editor-field")]
      .find((item) => item.querySelector("span")?.textContent === "World theme")
      ?.querySelector("select") as HTMLSelectElement;
    expect(theme).toBeTruthy();
    await choose(theme, "arcade");
    await settleAutosave();

    const project = parseLevelEditorProjectJson(window.localStorage.getItem(EDITOR_STORAGE_KEY)!);
    expect(isLevelEditorProjectV2(project)).toBe(true);
    if (!isLevelEditorProjectV2(project)) throw new Error("Expected a world project");
    expect(project.chapters).toHaveLength(3);
    expect(project.chapters[2]?.level.theme).toBe("arcade");
    expect(project.chapters[2]?.routeId).toMatch(/^draft-world-/);
    expect(project.chapters[2]?.level.id).toBe(project.chapters[2]?.routeId);
    expect(project.chapters[0]?.routeId).toBe("chapter-1-route");
  });

  it("upgrades an older draft while preserving its course geometry", async () => {
    const old = createLevelEditorProject({ projectId: "project-existing-draft" });
    window.localStorage.setItem(EDITOR_STORAGE_KEY, JSON.stringify(old));
    await act(async () => root.render(<EditorWorkspace onPlaytest={vi.fn(async () => {})} />));
    await press("World");
    await press("Upgrade this draft");
    await settleAutosave();

    const project = parseLevelEditorProjectJson(window.localStorage.getItem(EDITOR_STORAGE_KEY)!);
    expect(isLevelEditorProjectV2(project)).toBe(true);
    if (!isLevelEditorProjectV2(project)) throw new Error("Expected a world project");
    expect(project.chapters[0]?.level.pieces).toEqual(old.chapters[0].level.pieces);
    expect(project.chapters[1]?.level.pieces).toEqual(old.chapters[1].level.pieces);
  });

  it("creates a draft encounter identity without attaching an asset URL", async () => {
    await act(async () => root.render(<EditorWorkspace onPlaytest={vi.fn(async () => {})} />));
    const firstEncounter = container.querySelector(".editor-world-encounter")!;
    await act(async () => firstEncounter.querySelector<HTMLButtonElement>("button")!.click());
    const form = firstEncounter.querySelector<HTMLFormElement>("form")!;
    const input = (label: string) => [...form.querySelectorAll("label")]
      .find((item) => item.querySelector("span")?.textContent === label)
      ?.querySelector("input, textarea") as HTMLInputElement | HTMLTextAreaElement;
    await fill(input("Name"), "Captain Rattle");
    expect(input("Stable ID").value).toBe("enemy-captain-rattle");
    await fill(input("Stable ID"), "enemy-clockwork-rattle-v1");
    await fill(input("Recognizable reference"), "A fictional clockwork toy");
    await fill(input("Visual joke"), "Its enormous wind-up key squeaks");
    await fill(input("Obstacle or attack"), "A slow zigzag hop");
    await act(async () => form.querySelector<HTMLButtonElement>('button[type="submit"]')!.click());
    await settleAutosave();

    const project = parseLevelEditorProjectJson(window.localStorage.getItem(EDITOR_STORAGE_KEY)!);
    if (!isLevelEditorProjectV2(project)) throw new Error("Expected a world project");
    expect(project.enemyCandidates).toHaveLength(1);
    expect(project.enemyCandidates[0]?.id).toBe("enemy-clockwork-rattle-v1");
    expect(project.enemyCandidates[0]?.name).toBe("Captain Rattle");
    expect(project.chapters[0]?.encounterSlots["ordinary-1"]).toEqual({
      source: "candidate",
      candidateId: project.enemyCandidates[0]?.id,
    });
    expect(JSON.stringify(project.enemyCandidates)).not.toMatch(/assetUrl|https?:\/\//);
  });

  it("downloads the current draft before opening a sample and keeps the replacement undoable", async () => {
    const current = createWorldEditorProject({
      projectId: "project-before-sample",
      name: "Current draft",
    });
    const sample = createWorldEditorProject({
      projectId: "project-rat-casino-sample",
      name: "Rat Casino sample",
    });
    window.localStorage.setItem(EDITOR_STORAGE_KEY, JSON.stringify(current));
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    const createObjectUrl = vi.fn(() => "blob:editor-backup");
    const revokeObjectUrl = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectUrl,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectUrl,
    });

    await act(async () =>
      root.render(
        <EditorWorkspace
          onPlaytest={vi.fn(async () => {})}
          starterProject={{
            project: sample,
            chapterId: "chapter-2",
            actionLabel: "Open Rat Casino sample",
            confirmation: "Open sample?",
          }}
        />,
      ),
    );
    await press("Open Rat Casino sample");
    await settleAutosave();

    expect(confirm).toHaveBeenCalledWith("Open sample?");
    expect(createObjectUrl).toHaveBeenCalledOnce();
    expect(anchorClick).toHaveBeenCalledOnce();
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:editor-backup");
    let saved = parseLevelEditorProjectJson(
      window.localStorage.getItem(EDITOR_STORAGE_KEY)!,
    );
    expect(saved).toMatchObject({
      projectId: "project-rat-casino-sample",
      name: "Rat Casino sample",
      revision: 1,
    });
    expect(
      (container.querySelector('select[aria-label="Chapter"]') as HTMLSelectElement)
        .value,
    ).toBe("chapter-2");

    await press("Undo");
    await settleAutosave();
    saved = parseLevelEditorProjectJson(
      window.localStorage.getItem(EDITOR_STORAGE_KEY)!,
    );
    expect(saved).toMatchObject({
      projectId: "project-before-sample",
      name: "Current draft",
      revision: 2,
    });
    confirm.mockRestore();
    anchorClick.mockRestore();
    delete (URL as unknown as { createObjectURL?: unknown }).createObjectURL;
    delete (URL as unknown as { revokeObjectURL?: unknown }).revokeObjectURL;
  });
});
