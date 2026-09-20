import { createHash } from 'node:crypto';
import {
  canonicalLevelEditorProjectJson,
  LEVEL_EDITOR_CHAPTER_ROUTES,
  LEVEL_EDITOR_PROJECT_MAX_BYTES,
  LevelEditorProjectValidationError,
  resolveLevelEditorProject,
  type LevelEditorChapterId,
  type LevelEditorIssue,
  type LevelEditorProject,
} from '../shared/editor-project.js';

/**
 * Transport ceiling for the whole request envelope. The shared parser owns the
 * precise project verdict (320KiB canonical, 128KiB per authored document); this
 * only stops a body large enough to be worth buffering, leaving enough slack for
 * the envelope so a project at exactly the shared limit still reaches the
 * validator and gets an actionable size issue instead of a bare 413.
 */
export const EDITOR_PLAYTEST_MAX_BODY_BYTES =
  LEVEL_EDITOR_PROJECT_MAX_BYTES + 8_192;

/** Enough detail for an author to find the offending object, never a stack. */
export const EDITOR_PREVIEW_MAX_ISSUES = 50;

export const EDITOR_PROJECT_INVALID = 'EDITOR_PROJECT_INVALID';

export interface EditorProjectIssueResponse {
  error: {
    code: typeof EDITOR_PROJECT_INVALID;
    message: string;
    issues: LevelEditorIssue[];
    truncated?: true;
  };
}

export interface EditorPreviewBundle {
  /** Frozen, canonicalised copy of the validated project. */
  readonly project: LevelEditorProject;
  /** SHA-256 of the project's canonical serialisation. */
  readonly fingerprint: string;
}

export type EditorPreviewOutcome =
  | { readonly ok: true; readonly bundle: EditorPreviewBundle }
  | { readonly ok: false; readonly body: EditorProjectIssueResponse };

/** The chapter index the existing playtest service already understands. */
export function editorChapterNumber(chapterId: LevelEditorChapterId): 1 | 2 {
  return chapterId === 'chapter-1' ? 1 : 2;
}

export function editorChapterRouteId(chapterId: LevelEditorChapterId): string {
  return LEVEL_EDITOR_CHAPTER_ROUTES[chapterId];
}

/**
 * Structurally parse, semantically validate and freeze a submitted project.
 * Returning an outcome rather than throwing keeps the caller honest: an invalid
 * project cannot reach the store, so no save is ever created for one.
 */
export function prepareEditorPreview(project: unknown): EditorPreviewOutcome {
  let resolved: LevelEditorProject;
  try {
    resolved = resolveLevelEditorProject(project).project;
  } catch (error) {
    if (!(error instanceof LevelEditorProjectValidationError)) throw error;
    const issues = error.issues.slice(0, EDITOR_PREVIEW_MAX_ISSUES);
    return {
      ok: false,
      body: {
        error: {
          code: EDITOR_PROJECT_INVALID,
          message: 'Editor project is invalid',
          issues: issues.map((issue) => ({ ...issue })),
          ...(error.issues.length > issues.length ? { truncated: true as const } : {}),
        },
      },
    };
  }
  const canonical = canonicalLevelEditorProjectJson(resolved);
  return {
    ok: true,
    bundle: {
      project: resolved,
      fingerprint: createHash('sha256').update(canonical, 'utf8').digest('hex'),
    },
  };
}
