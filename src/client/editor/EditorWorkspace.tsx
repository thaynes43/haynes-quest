import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  AuthoredConnection,
  AuthoredLevelPiece,
  AuthoredPosition,
} from "../../shared/authored-level";
import {
  LEVEL_EDITOR_PROJECT_MAX_BYTES,
  LevelEditorProjectValidationError,
  applyLevelEditorCommand,
  canonicalLevelEditorProjectJson,
  createLevelEditorProject,
  parseLevelEditorProjectJson,
  rebaseLevelEditorProject,
  serializeLevelEditorProject,
  validateLevelEditorProject,
  type LevelEditorChapterId,
  type LevelEditorCommand,
  type LevelEditorIssue,
  type LevelEditorProject,
} from "../../shared/editor-project";
import { EditorViewport, type EditorSnap, type EditorViewportHandle } from "./EditorViewport";
import { ObjectRail } from "./ObjectRail";
import { PropertiesInspector } from "./PropertiesInspector";
import { RouteEditor } from "./RouteEditor";
import { TextField } from "./EditorFields";
import { ValidationPanel } from "./ValidationPanel";
import {
  commitEditorHistory,
  createEditorHistory,
  isTextEntryTarget,
  redoEditorHistory,
  replaceEditorSelection,
  undoEditorHistory,
  type EditorHistory,
} from "./editor-history";
import {
  anchorForSelection,
  pieceForSelection,
  positionForSelection,
  uniquePieceId,
  type EditorSelection,
} from "./editor-selection";
import {
  EDITOR_STORAGE_KEY,
  ensureImportSize,
  installEditorPagehideAutosave,
  loadEditorDraft,
  readableProjectFilename,
  saveEditorDraft,
} from "./editor-storage";
import "./editor.css";

export interface EditorPlaytestRequest {
  readonly project: LevelEditorProject;
  readonly chapterId: LevelEditorChapterId;
  readonly scope: "chapter" | "adventure";
}

interface EditorCursor {
  readonly chapterId: LevelEditorChapterId;
  readonly object: EditorSelection | null;
}

type ProjectHistory = EditorHistory<LevelEditorProject, EditorCursor>;
type MobilePanel = "view" | "objects" | "properties" | "checks";

interface InitialEditorState {
  readonly history: ProjectHistory;
  readonly corruptRaw: string | null;
  readonly storageUnavailable: boolean;
}

function createProjectId(): string {
  return `project-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36)}`;
}

function newProject(): LevelEditorProject {
  return createLevelEditorProject({
    projectId: createProjectId(),
    name: "Untitled adventure",
    chapterNames: {
      "chapter-1": "The Block Party",
      "chapter-2": "Besties Obby",
    },
  });
}

function initialEditorState(): InitialEditorState {
  const fallback = newProject();
  const cursor: EditorCursor = { chapterId: "chapter-1", object: null };
  try {
    const loaded = loadEditorDraft(window.localStorage, parseLevelEditorProjectJson);
    if (loaded.kind === "project") {
      return {
        history: createEditorHistory({ project: loaded.project, selection: cursor }),
        corruptRaw: null,
        storageUnavailable: false,
      };
    }
    return {
      history: createEditorHistory({ project: fallback, selection: cursor }),
      corruptRaw: loaded.kind === "corrupt" ? loaded.raw : null,
      storageUnavailable: false,
    };
  } catch {
    return {
      history: createEditorHistory({ project: fallback, selection: cursor }),
      corruptRaw: null,
      storageUnavailable: true,
    };
  }
}

function chapterFor(project: LevelEditorProject, chapterId: LevelEditorChapterId) {
  return project.chapters.find((chapter) => chapter.chapterId === chapterId)!;
}

function cursorForProject(
  project: LevelEditorProject,
  cursor: EditorCursor,
): EditorCursor {
  const chapter = chapterFor(project, cursor.chapterId) ?? project.chapters[0];
  const object = cursor.object;
  if (!object) return { chapterId: chapter.chapterId, object: null };
  if (object.type === "piece" && !pieceForSelection(chapter.level, object))
    return { chapterId: chapter.chapterId, object: null };
  if (object.type === "anchor" && !anchorForSelection(chapter.level, object))
    return { chapterId: chapter.chapterId, object: null };
  return { chapterId: chapter.chapterId, object };
}

function downloadText(text: string, filename: string): void {
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/json;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function importError(error: unknown): string {
  if (error instanceof LevelEditorProjectValidationError) {
    const issue = error.issues[0];
    return issue ? `${issue.path}: ${issue.message}` : error.message;
  }
  return error instanceof Error ? error.message : "";
}

function connectionMatch(connection: AuthoredConnection): AuthoredConnection {
  return { ...connection };
}

export function EditorWorkspace({
  active = true,
  onPlaytest,
}: {
  active?: boolean;
  onPlaytest(request: EditorPlaytestRequest): Promise<void>;
}) {
  const [initial] = useState(initialEditorState);
  const [history, setHistory] = useState(initial.history);
  const [corruptRaw, setCorruptRaw] = useState(initial.corruptRaw);
  const [storageUnavailable, setStorageUnavailable] = useState(
    initial.storageUnavailable,
  );
  const [storageStatus, setStorageStatus] = useState(
    initial.storageUnavailable
      ? "Browser storage is unavailable. Export your draft to keep it."
      : "Saved in this browser",
  );
  const [issues, setIssues] = useState<readonly LevelEditorIssue[]>(() =>
    validateLevelEditorProject(initial.history.present.project),
  );
  const [checksOpen, setChecksOpen] = useState(false);
  const [playtestBlocked, setPlaytestBlocked] = useState(false);
  const [playtestMenuOpen, setPlaytestMenuOpen] = useState(false);
  const [playtestBusy, setPlaytestBusy] = useState(false);
  const [playtestError, setPlaytestError] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importFailure, setImportFailure] = useState("");
  const [inspectorTab, setInspectorTab] = useState<"properties" | "route">(
    "properties",
  );
  const [snap, setSnap] = useState<EditorSnap>(0.5);
  const [moveAttached, setMoveAttached] = useState(true);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("view");
  const workspace = useRef<HTMLDivElement>(null);
  const viewport = useRef<EditorViewportHandle>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const importReadToken = useRef(0);
  const latestHistory = useRef(history);
  latestHistory.current = history;

  const project = history.present.project;
  const cursor = cursorForProject(project, history.present.selection);
  const chapter = chapterFor(project, cursor.chapterId);
  const document = chapter.level;

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setIssues(validateLevelEditorProject(project));
    }, 140);
    return () => window.clearTimeout(timeout);
  }, [project]);

  useEffect(() => {
    if (corruptRaw !== null || storageUnavailable) return;
    setStorageStatus("Saving…");
    const timeout = window.setTimeout(() => {
      try {
        saveEditorDraft(
          window.localStorage,
          canonicalLevelEditorProjectJson(project),
        );
        setStorageStatus("Saved in this browser");
      } catch {
        setStorageUnavailable(true);
        setStorageStatus(
          "Browser storage is unavailable. Export your draft to keep it.",
        );
      }
    }, 260);
    return () => window.clearTimeout(timeout);
  }, [corruptRaw, project, storageUnavailable]);

  useEffect(() => {
    if (corruptRaw !== null || storageUnavailable) return;
    return installEditorPagehideAutosave(window, () => {
      try {
        saveEditorDraft(
          window.localStorage,
          canonicalLevelEditorProjectJson(
            latestHistory.current.present.project,
          ),
        );
      } catch {
        setStorageUnavailable(true);
        setStorageStatus(
          "Browser storage is unavailable. Export your draft to keep it.",
        );
      }
    });
  }, [corruptRaw, storageUnavailable]);

  const replaceCursor = useCallback((next: EditorCursor) => {
    const history = replaceEditorSelection(latestHistory.current, next);
    latestHistory.current = history;
    setHistory(history);
  }, []);

  const runCommand = useCallback(
    (command: LevelEditorCommand, nextObject?: EditorSelection | null) => {
      const current = latestHistory.current;
      const result = applyLevelEditorCommand(current.present.project, command);
      setIssues(result.issues);
      if (!result.ok) {
        setChecksOpen(true);
        return;
      }
      const selection = cursorForProject(result.project, {
        ...current.present.selection,
        object:
          nextObject === undefined
            ? current.present.selection.object
            : nextObject,
      });
      const history = commitEditorHistory(current, {
        project: result.project,
        selection,
      });
      latestHistory.current = history;
      setHistory(history);
    },
    [],
  );

  const undo = useCallback(() => {
    const current = latestHistory.current;
    const revision = current.present.project.revision + 1;
    const restored = undoEditorHistory(current, (snapshot) =>
      rebaseLevelEditorProject(snapshot, revision),
    );
    const history = {
      ...restored,
      present: {
        ...restored.present,
        selection: cursorForProject(
          restored.present.project,
          restored.present.selection,
        ),
      },
    };
    latestHistory.current = history;
    setHistory(history);
  }, []);

  const redo = useCallback(() => {
    const current = latestHistory.current;
    const revision = current.present.project.revision + 1;
    const restored = redoEditorHistory(current, (snapshot) =>
      rebaseLevelEditorProject(snapshot, revision),
    );
    const history = {
      ...restored,
      present: {
        ...restored.present,
        selection: cursorForProject(
          restored.present.project,
          restored.present.selection,
        ),
      },
    };
    latestHistory.current = history;
    setHistory(history);
  }, []);

  const deleteSelection = useCallback(() => {
    const current = latestHistory.current;
    const currentCursor = current.present.selection;
    if (currentCursor.object?.type !== "piece") return;
    runCommand(
      {
        type: "piece.remove",
        chapterId: currentCursor.chapterId,
        pieceId: currentCursor.object.id,
      },
      null,
    );
  }, [runCommand]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (!active) return;
      if (isTextEntryTarget(event.target)) return;
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && event.key.toLocaleLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (
        event.key === "Delete" &&
        workspace.current?.contains(globalThis.document.activeElement)
      ) {
        event.preventDefault();
        deleteSelection();
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [active, deleteSelection, redo, undo]);

  const selectAndFrame = (object: EditorSelection | null) => {
    replaceCursor({ chapterId: cursor.chapterId, object });
    window.requestAnimationFrame(() => viewport.current?.frameSelection());
  };

  const addPiece = (
    type: "platform" | "moving-platform" | "sweeper" | "checkpoint",
  ) => {
    const selectedPosition = positionForSelection(document, cursor.object);
    const center = selectedPosition
      ? { ...selectedPosition, x: selectedPosition.x + 2, z: selectedPosition.z - 2 }
      : viewport.current?.viewCenter() ?? { x: 0, y: 0, z: 0 };
    const base = uniquePieceId(document, type);
    let piece: AuthoredLevelPiece;
    if (type === "platform") {
      piece = {
        type,
        id: base,
        center,
        size: { x: 4, y: 0.6, z: 4 },
      };
    } else if (type === "moving-platform") {
      piece = {
        type,
        id: base,
        center,
        size: { x: 3.4, y: 0.6, z: 3.4 },
        motion: { axis: "x", distance: 1, period: 8 },
      };
    } else if (type === "sweeper") {
      piece = {
        type,
        id: base,
        center,
        halfLength: 1,
        radius: 0.18,
        rotation: { period: 12 },
      };
    } else {
      const selected = pieceForSelection(document, cursor.object);
      const support =
        selected?.type === "platform" || selected?.type === "moving-platform"
          ? selected
          : document.pieces.find(
              (candidate) =>
                candidate.type === "platform" ||
                candidate.type === "moving-platform",
            );
      if (!support) return;
      piece = {
        type,
        id: base,
        position:
          selected === support
            ? {
                x: support.center.x,
                y: support.center.y + support.size.y / 2,
                z: support.center.z,
              }
            : center,
        platformId: support.id,
        activation: { type: "platform" },
      };
    }
    runCommand(
      { type: "piece.add", chapterId: cursor.chapterId, piece },
      { type: "piece", id: piece.id },
    );
  };

  const moveSelection = (position: AuthoredPosition) => {
    if (cursor.object?.type === "piece") {
      runCommand({
        type: "piece.move",
        chapterId: cursor.chapterId,
        pieceId: cursor.object.id,
        position,
        carryAttached: moveAttached,
      });
    } else if (cursor.object?.type === "anchor") {
      runCommand({
        type: "anchor.move",
        chapterId: cursor.chapterId,
        slot: cursor.object.slot,
        position,
        carryArena: true,
      });
    }
  };

  const updatePiece = (piece: AuthoredLevelPiece) => {
    const selected = cursor.object;
    if (selected?.type !== "piece") return;
    runCommand({
      type: "piece.update",
      chapterId: cursor.chapterId,
      pieceId: selected.id,
      piece,
      carryAttached: moveAttached,
    });
  };

  const duplicatePiece = () => {
    const selected = cursor.object;
    if (selected?.type !== "piece") return;
    const newPieceId = uniquePieceId(document, `${selected.id}-copy`);
    runCommand(
      {
        type: "piece.duplicate",
        chapterId: cursor.chapterId,
        pieceId: selected.id,
        newPieceId,
        offset: { x: 1, y: 0, z: -1 },
      },
      { type: "piece", id: newPieceId },
    );
  };

  const validateNow = () => {
    const next = validateLevelEditorProject(
      latestHistory.current.present.project,
    );
    setIssues(next);
    setPlaytestBlocked(false);
    if (next.length) setChecksOpen(true);
  };

  const startPlaytest = async (scope: "chapter" | "adventure") => {
    const snapshot = latestHistory.current.present;
    const snapshotCursor = cursorForProject(snapshot.project, snapshot.selection);
    const nextIssues = validateLevelEditorProject(snapshot.project);
    setIssues(nextIssues);
    setPlaytestMenuOpen(false);
    if (nextIssues.length) {
      setPlaytestBlocked(true);
      setChecksOpen(true);
      setMobilePanel("checks");
      return;
    }
    setPlaytestBusy(true);
    setPlaytestError("");
    try {
      await onPlaytest({
        project: snapshot.project,
        chapterId: snapshotCursor.chapterId,
        scope,
      });
    } catch (error) {
      const detail = importError(error);
      setPlaytestError(
        `Could not start the playtest. Your draft is safe.${detail ? ` ${detail}` : ""}`,
      );
    } finally {
      setPlaytestBusy(false);
    }
  };

  const importProject = () => {
    importReadToken.current += 1;
    setImportFailure("");
    try {
      ensureImportSize(importText);
      const parsed = parseLevelEditorProjectJson(importText);
      const current = latestHistory.current;
      const history = commitEditorHistory(current, {
        project: rebaseLevelEditorProject(
          parsed,
          current.present.project.revision + 1,
        ),
        selection: { chapterId: "chapter-1", object: null },
      });
      latestHistory.current = history;
      setHistory(history);
      setCorruptRaw(null);
      setImportOpen(false);
      setImportText("");
    } catch (error) {
      setImportFailure(importError(error));
    }
  };

  const projectStatus = issues.length === 0 ? "Ready to play" : "Draft";
  const issueSummary = `${issues.length} issues to fix`;

  const rightInspector = useMemo(
    () => (
      <aside className="editor-right-rail" aria-label="Inspector">
        <div className="editor-tab-list" role="tablist">
          <button
            role="tab"
            aria-selected={inspectorTab === "properties"}
            onClick={() => setInspectorTab("properties")}
          >
            Properties
          </button>
          <button
            role="tab"
            aria-selected={inspectorTab === "route"}
            onClick={() => setInspectorTab("route")}
          >
            Route
          </button>
        </div>
        <div className="editor-inspector-scroll">
          {inspectorTab === "properties" ? (
            <PropertiesInspector
              document={document}
              selection={cursor.object}
              moveAttached={moveAttached}
              onMoveAttachedChange={setMoveAttached}
              onMove={moveSelection}
              onUpdatePiece={updatePiece}
              onRenamePiece={(newPieceId) => {
                if (cursor.object?.type !== "piece") return;
                runCommand(
                  {
                    type: "piece.rename",
                    chapterId: cursor.chapterId,
                    pieceId: cursor.object.id,
                    newPieceId,
                  },
                  { type: "piece", id: newPieceId },
                );
              }}
              onUpdateAnchor={(value) => {
                if (cursor.object?.type !== "anchor") return;
                runCommand({
                  type: "anchor.set",
                  chapterId: cursor.chapterId,
                  slot: cursor.object.slot,
                  value,
                });
              }}
              onDuplicatePiece={duplicatePiece}
              onDeletePiece={deleteSelection}
            />
          ) : (
            <RouteEditor
              document={document}
              onAddConnection={(connection) =>
                runCommand({
                  type: "connection.add",
                  chapterId: cursor.chapterId,
                  connection,
                })
              }
              onUpdateConnection={(index, connection) =>
                runCommand({
                  type: "connection.update",
                  chapterId: cursor.chapterId,
                  match: connectionMatch(document.connections[index]),
                  connection,
                })
              }
              onRemoveConnection={(index) =>
                runCommand({
                  type: "connection.remove",
                  chapterId: cursor.chapterId,
                  match: connectionMatch(document.connections[index]),
                })
              }
              onSetMainPath={(platformIds) =>
                runCommand({
                  type: "main-path.set",
                  chapterId: cursor.chapterId,
                  platformIds,
                })
              }
              onAddBranch={(platformIds) =>
                runCommand({
                  type: "branch.add",
                  chapterId: cursor.chapterId,
                  platformIds,
                })
              }
              onUpdateBranch={(index, platformIds) =>
                runCommand({
                  type: "branch.update",
                  chapterId: cursor.chapterId,
                  index,
                  platformIds,
                })
              }
              onRemoveBranch={(index) =>
                runCommand({
                  type: "branch.remove",
                  chapterId: cursor.chapterId,
                  index,
                })
              }
            />
          )}
        </div>
      </aside>
    ),
    [
      cursor.chapterId,
      cursor.object,
      document,
      inspectorTab,
      moveAttached,
      project.revision,
      runCommand,
    ],
  );

  return (
    <div className="level-editor" ref={workspace} tabIndex={-1}>
      <header className="editor-header">
        <div className="editor-brand">Haynes Quest · Level editor</div>
        <TextField
          label="Project name"
          value={project.name}
          onCommit={(name) => runCommand({ type: "project.rename", name })}
        />
        <span
          className={`editor-storage-status${storageUnavailable ? " is-unavailable" : ""}`}
          role="status"
        >
          {storageStatus}
        </span>
        <div className="editor-header-actions">
          <button type="button" onClick={undo} disabled={!history.past.length}>
            Undo
          </button>
          <button type="button" onClick={redo} disabled={!history.future.length}>
            Redo
          </button>
          <button type="button" onClick={() => setImportOpen(true)}>
            Import
          </button>
          <button
            type="button"
            onClick={() => {
              const currentProject = latestHistory.current.present.project;
              downloadText(
                serializeLevelEditorProject(currentProject),
                readableProjectFilename(currentProject.name),
              );
            }}
          >
            Export
          </button>
          <div className="editor-playtest-menu">
            <button
              type="button"
              className="editor-primary"
              disabled={playtestBusy}
              aria-expanded={playtestMenuOpen}
              onClick={() => setPlaytestMenuOpen((open) => !open)}
            >
              Playtest
            </button>
            {playtestMenuOpen && (
              <div className="editor-menu" role="menu">
                <button type="button" role="menuitem" onClick={() => void startPlaytest("chapter")}>
                  From this level
                </button>
                <button type="button" role="menuitem" onClick={() => void startPlaytest("adventure")}>
                  Full adventure
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <div className="editor-secondary-actions">
          <select
            aria-label="Chapter"
            value={cursor.chapterId}
            onChange={(event) => {
              replaceCursor({
                chapterId: event.target.value as LevelEditorChapterId,
                object: null,
              });
              window.requestAnimationFrame(() => viewport.current?.frameLevel());
            }}
          >
            {project.chapters.map((item, index) => (
              <option key={item.chapterId} value={item.chapterId}>
                Level {index + 1} — {item.name}
              </option>
            ))}
          </select>
          <TextField
            label="Chapter name"
            value={chapter.name}
            onCommit={(name) =>
              runCommand({
                type: "chapter.rename",
                chapterId: cursor.chapterId,
                name,
              })
            }
          />
          <button
            type="button"
            onClick={() => {
              if (
                !window.confirm(
                  "Start a new project? Export your current draft first if you want to keep it.",
                )
              )
                return;
              const next = newProject();
              const history: ProjectHistory = createEditorHistory({
                project: next,
                selection: { chapterId: "chapter-1", object: null },
              });
              latestHistory.current = history;
              setHistory(history);
              setCorruptRaw(null);
              try {
                window.localStorage.removeItem(EDITOR_STORAGE_KEY);
                setStorageUnavailable(false);
                setStorageStatus("Saving…");
              } catch {
                setStorageUnavailable(true);
                setStorageStatus(
                  "Browser storage is unavailable. Export your draft to keep it.",
                );
              }
            }}
          >
            New project
          </button>
          <button type="button" onClick={validateNow}>
            Validate
          </button>
          <button type="button" onClick={() => viewport.current?.frameLevel()}>
            Frame level
          </button>
          <button
            type="button"
            disabled={!cursor.object}
            onClick={() => viewport.current?.frameSelection()}
          >
            Frame selection
          </button>
          <label className="editor-snap-control">
            <span>Snap</span>
            <select
              value={snap}
              onChange={(event) => setSnap(Number(event.target.value) as EditorSnap)}
            >
              <option value={0}>Off</option>
              <option value={0.25}>0.25 units</option>
              <option value={0.5}>0.5 units</option>
              <option value={1}>1 units</option>
            </select>
          </label>
          <span className={`editor-project-status is-${projectStatus === "Draft" ? "draft" : "ready"}`}>
            {projectStatus}
          </span>
          {issues.length > 0 && (
            <button
              type="button"
              className="editor-issue-summary"
              onClick={() => setChecksOpen(true)}
            >
              {issueSummary}
            </button>
          )}
      </div>

      {corruptRaw !== null && (
        <div className="editor-banner" role="alert">
          <span>The saved draft could not be opened. Import a backup or start a new project.</span>
          {new TextEncoder().encode(corruptRaw).byteLength <=
            LEVEL_EDITOR_PROJECT_MAX_BYTES && (
            <button
              type="button"
              onClick={() => downloadText(corruptRaw, "saved-draft.json")}
            >
              Download saved draft
            </button>
          )}
        </div>
      )}
      {playtestError && (
        <div className="editor-banner" role="alert">
          {playtestError}
        </div>
      )}

      <nav className="editor-mobile-tabs" aria-label="Editor panels">
        {(["view", "objects", "properties", "checks"] as const).map((panel) => (
          <button
            type="button"
            key={panel}
            aria-current={mobilePanel === panel ? "page" : undefined}
            onClick={() => {
              setMobilePanel(panel);
              if (panel === "checks") setChecksOpen(true);
            }}
          >
            {panel[0].toUpperCase() + panel.slice(1)}
          </button>
        ))}
      </nav>

      <main className={`editor-workspace is-mobile-${mobilePanel}`}>
        <ObjectRail
          document={document}
          selection={cursor.object}
          onSelect={selectAndFrame}
          onAdd={addPiece}
        />
        <EditorViewport
          ref={viewport}
          active={active}
          document={document}
          selection={cursor.object}
          snap={snap}
          onSelect={(object) =>
            replaceCursor({ chapterId: cursor.chapterId, object })
          }
          onMove={(_, position) => moveSelection(position)}
        />
        {rightInspector}
        {checksOpen && (
          <ValidationPanel
            project={project}
            issues={issues}
            playtestBlocked={playtestBlocked}
            onSelect={(chapterId, object) => {
              replaceCursor({ chapterId, object });
              setChecksOpen(false);
              setMobilePanel("view");
              window.requestAnimationFrame(() => viewport.current?.frameSelection());
            }}
            onClose={() => {
              setChecksOpen(false);
              setPlaytestBlocked(false);
            }}
          />
        )}
      </main>

      {importOpen && (
        <div className="editor-modal-backdrop" role="presentation">
          <section className="editor-modal" role="dialog" aria-modal="true" aria-labelledby="editor-import-title">
            <h2 id="editor-import-title">Import project</h2>
            <input
              ref={fileInput}
              className="sr-only"
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                const token = ++importReadToken.current;
                const file = event.target.files?.[0];
                event.currentTarget.value = "";
                setImportText("");
                if (!file) return;
                setImportFailure("");
                if (file.size > LEVEL_EDITOR_PROJECT_MAX_BYTES) {
                  try {
                    ensureImportSize("x".repeat(LEVEL_EDITOR_PROJECT_MAX_BYTES + 1));
                  } catch (error) {
                    setImportFailure(importError(error));
                  }
                  return;
                }
                void file
                  .text()
                  .then((text) => {
                    if (importReadToken.current === token) setImportText(text);
                  })
                  .catch((error: unknown) => {
                    if (importReadToken.current === token)
                      setImportFailure(importError(error));
                  });
              }}
            />
            <button type="button" onClick={() => fileInput.current?.click()}>
              Choose file
            </button>
            <label className="editor-import-paste">
              <span>Paste JSON</span>
              <textarea
                rows={12}
                value={importText}
                onChange={(event) => {
                  importReadToken.current += 1;
                  setImportText(event.target.value);
                }}
              />
            </label>
            {importFailure && <p role="alert">{importFailure}</p>}
            <div className="editor-modal-actions">
              <button
                type="button"
                onClick={() => {
                  importReadToken.current += 1;
                  setImportOpen(false);
                  setImportFailure("");
                  setImportText("");
                }}
              >
                Cancel
              </button>
              <button type="button" className="editor-primary" onClick={importProject}>
                Import
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
