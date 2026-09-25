// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SaveView } from "../../src/shared/contracts";
import {
  createLevelEditorProject,
  type LevelEditorProject,
} from "../../src/shared/editor-project";

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  workspaceMounts: 0,
  workspaceUnmounts: 0,
  workspaceProps: [] as Array<{
    active?: boolean;
    onPlaytest(request: unknown): Promise<void>;
    starterProject?: {
      project: LevelEditorProject;
      chapterId: string;
      actionLabel: string;
    };
  }>,
  gameProps: [] as Array<{
    onLeave(): void;
    leaveLabel?: string;
    chapterTitles?: Readonly<Partial<Record<string, string>>>;
    chapterOnlyRouteId?: string;
    authoredLevelResolver?: (routeId: string | undefined) => unknown;
  }>,
}));

vi.mock("../../src/client/api", () => ({ api: mocks.api }));

vi.mock("../../src/client/editor/EditorWorkspace", async () => {
  const ReactModule = await import("react");
  return {
    EditorWorkspace: (props: (typeof mocks.workspaceProps)[number]) => {
      ReactModule.useEffect(() => {
        mocks.workspaceMounts += 1;
        return () => {
          mocks.workspaceUnmounts += 1;
        };
      }, []);
      mocks.workspaceProps.push(props);
      return ReactModule.createElement(
        "button",
        {
          type: "button",
          "data-active": String(props.active),
          onClick: () =>
            void props.onPlaytest({
              project: createLevelEditorProject({
                projectId: "project-editor-app-request",
              }),
              chapterId: "chapter-2",
              scope: "chapter",
            }),
        },
        "Playtest fixture",
      );
    },
  };
});

vi.mock("../../src/client/GameScreen", async () => {
  const ReactModule = await import("react");
  return {
    GameScreen: (props: (typeof mocks.gameProps)[number]) => {
      mocks.gameProps.push(props);
      return ReactModule.createElement(
        "button",
        { type: "button", onClick: props.onLeave },
        props.leaveLabel,
      );
    },
  };
});

import { EditorApp } from "../../src/client/editor/EditorApp";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  mocks.api.mockReset();
  mocks.workspaceMounts = 0;
  mocks.workspaceUnmounts = 0;
  mocks.workspaceProps.length = 0;
  mocks.gameProps.length = 0;
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("level editor preview shell", () => {
  it("keeps the workspace mounted and resolves the frozen response project", async () => {
    const project: LevelEditorProject = createLevelEditorProject({
      projectId: "project-editor-app-response",
      chapterNames: {
        "chapter-1": "Garden edit",
        "chapter-2": "Party edit",
      },
    });
    mocks.api.mockResolvedValue({
      save: { id: "editor-save" } as SaveView,
      project,
      fingerprint: "fixture-fingerprint",
    });

    await act(async () => root.render(<EditorApp />));
    expect(mocks.workspaceMounts).toBe(1);
    expect(mocks.workspaceProps.at(-1)?.active).toBe(true);
    expect(mocks.workspaceProps.at(-1)?.starterProject).toMatchObject({
      chapterId: "rat-casino",
      actionLabel: "Open Rat Casino sample",
      project: {
        schemaVersion: "level-editor-project-v2",
        chapters: expect.arrayContaining([
          expect.objectContaining({
            chapterId: "rat-casino",
            routeId: "rat-casino-v2",
          }),
        ]),
      },
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>("button")!.click();
      await Promise.resolve();
    });

    expect(mocks.api).toHaveBeenCalledWith(
      "/editor/playtests",
      expect.objectContaining({ chapterId: "chapter-2", scope: "chapter" }),
    );
    expect(mocks.workspaceMounts).toBe(1);
    expect(mocks.workspaceUnmounts).toBe(0);
    expect(mocks.workspaceProps.at(-1)?.active).toBe(false);
    const game = mocks.gameProps.at(-1)!;
    expect(game.leaveLabel).toBe("Back to editor");
    expect(game.chapterTitles).toEqual({
      "garden-playground-v2": "Garden edit",
      "besties-playground-v2": "Party edit",
    });
    expect(game.chapterOnlyRouteId).toBe("besties-playground-v2");
    expect(game.authoredLevelResolver?.("garden-playground-v2")).not.toBeNull();

    await act(async () => {
      [...container.querySelectorAll<HTMLButtonElement>("button")]
        .find((button) => button.textContent === "Back to editor")!
        .click();
    });
    expect(mocks.workspaceMounts).toBe(1);
    expect(mocks.workspaceProps.at(-1)?.active).toBe(true);
  });
});
