import { useState } from "react";
import { authoredLevelResolverFor } from "../../game/authored-layout";
import type { SaveView } from "../../shared/contracts";
import {
  resolveLevelEditorProject,
  type LevelEditorProject,
} from "../../shared/editor-project";
import { GameScreen } from "../GameScreen";
import { api } from "../api";
import {
  EditorWorkspace,
  type EditorPlaytestRequest,
} from "./EditorWorkspace";

interface EditorPlaytestResponse {
  readonly save: SaveView;
  readonly project: LevelEditorProject;
  readonly fingerprint: string;
}

interface EditorPreview {
  readonly save: SaveView;
  readonly project: LevelEditorProject;
  readonly resolver: ReturnType<typeof authoredLevelResolverFor>;
  readonly fingerprint: string;
}

export function EditorUnavailable() {
  return (
    <main className="editor-unavailable">
      <p>The level editor is available in the private playtest.</p>
      <a href="/">Back to game</a>
    </main>
  );
}

export function EditorApp() {
  const [preview, setPreview] = useState<EditorPreview | null>(null);

  const startPlaytest = async (request: EditorPlaytestRequest) => {
    const response = await api<EditorPlaytestResponse>("/editor/playtests", request);
    const resolved = resolveLevelEditorProject(response.project);
    setPreview({
      save: response.save,
      project: resolved.project,
      resolver: authoredLevelResolverFor(resolved.levels),
      fingerprint: response.fingerprint,
    });
  };

  return (
    <>
      <div className={preview ? "editor-suspended" : undefined}>
        <EditorWorkspace active={!preview} onPlaytest={startPlaytest} />
      </div>
      {preview && (
        <GameScreen
          key={preview.fingerprint}
          initialSave={preview.save}
          onLeave={() => setPreview(null)}
          ephemeral
          authoredLevelResolver={preview.resolver}
          leaveLabel="Back to editor"
          chapterTitles={Object.fromEntries(
            preview.project.chapters.map((chapter) => [
              "routeId" in chapter ? chapter.routeId : chapter.templateRouteId,
              chapter.name,
            ]),
          )}
          chapterSubtitles={Object.fromEntries(
            preview.project.chapters.flatMap((chapter) =>
              "routeId" in chapter && chapter.subtitle
                ? [[chapter.routeId, chapter.subtitle]]
                : [],
            ),
          )}
          chapterDescriptions={Object.fromEntries(
            preview.project.chapters.flatMap((chapter) =>
              "routeId" in chapter
                ? [[
                    chapter.routeId,
                    chapter.description ??
                      "Find the memories, cross the course and face this world's boss.",
                  ]]
                : [],
            ),
          )}
        />
      )}
    </>
  );
}
