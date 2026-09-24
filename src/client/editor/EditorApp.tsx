import { useState } from "react";
import { GameScreen } from "../GameScreen";
import { api } from "../api";
import {
  RAT_CASINO_CHAPTER_ID,
  RAT_CASINO_WORLD_PROJECT,
  resolveEditorPlaytestResponse,
  type EditorPlaytestResponse,
  type ResolvedEditorPlaytest,
} from "../rat-casino-project";
import {
  EditorWorkspace,
  type EditorPlaytestRequest,
} from "./EditorWorkspace";

export function EditorUnavailable() {
  return (
    <main className="editor-unavailable">
      <p>The level editor is available in the private playtest.</p>
      <a href="/">Back to game</a>
    </main>
  );
}

export function EditorApp() {
  const [preview, setPreview] = useState<
    (ResolvedEditorPlaytest & { chapterOnlyRouteId?: string }) | null
  >(null);

  const startPlaytest = async (request: EditorPlaytestRequest) => {
    const response = await api<EditorPlaytestResponse>("/editor/playtests", request);
    const resolved = resolveEditorPlaytestResponse(response);
    const chapter = resolved.project.chapters.find(
      (candidate) => candidate.chapterId === request.chapterId,
    );
    setPreview({
      ...resolved,
      ...(request.scope === "chapter" && chapter
        ? { chapterOnlyRouteId: "routeId" in chapter
            ? chapter.routeId
            : chapter.templateRouteId }
        : {}),
    });
  };

  return (
    <>
      <div className={preview ? "editor-suspended" : undefined}>
        <EditorWorkspace
          active={!preview}
          onPlaytest={startPlaytest}
          starterProject={{
            project: RAT_CASINO_WORLD_PROJECT,
            chapterId: RAT_CASINO_CHAPTER_ID,
            actionLabel: "Open Rat Casino sample",
            confirmation:
              "Open the Rat Casino sample? Your current draft will download first, and Undo can restore it in this editor.",
          }}
        />
      </div>
      {preview && (
        <GameScreen
          key={preview.fingerprint}
          initialSave={preview.save}
          onLeave={() => setPreview(null)}
          ephemeral
          authoredLevelResolver={preview.resolver}
          leaveLabel="Back to editor"
          chapterTitles={preview.chapterTitles}
          chapterSubtitles={preview.chapterSubtitles}
          chapterDescriptions={preview.chapterDescriptions}
          chapterOnlyRouteId={preview.chapterOnlyRouteId}
        />
      )}
    </>
  );
}
