import { describe, expect, it } from "vitest";
import { connectionMatchForCommand } from "../../src/client/editor/editor-command-adapters";
import {
  applyLevelEditorCommand,
  createLevelEditorProject,
} from "../../src/shared/editor-project";

describe("level editor command adapters", () => {
  it("updates a connection with optional authored fields through a strict match", () => {
    const project = createLevelEditorProject({
      projectId: "project-editor-command-adapter-test",
    });
    const connection = project.chapters[0].level.connections.find(
      (candidate) => candidate.safeMissPlatformId,
    )!;
    const replacement = { ...connection, mode: "walk" as const };

    expect(connectionMatchForCommand(connection, 0)).toEqual({
      from: connection.from,
      to: connection.to,
      mode: connection.mode,
      index: 0,
    });
    expect(
      applyLevelEditorCommand(project, {
        type: "connection.update",
        chapterId: "chapter-1",
        match: connectionMatchForCommand(connection, 0),
        connection: replacement,
      }),
    ).toMatchObject({ ok: true });
  });
});
