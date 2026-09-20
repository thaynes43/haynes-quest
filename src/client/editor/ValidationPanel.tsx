import type {
  LevelEditorChapterId,
  LevelEditorIssue,
  LevelEditorProject,
} from "../../shared/editor-project";
import { selectionFromIssuePath, type EditorSelection } from "./editor-selection";

export function issueTarget(
  project: LevelEditorProject,
  issue: LevelEditorIssue,
): { chapterId: LevelEditorChapterId; selection: EditorSelection | null } | null {
  const chapterMatch = /\$\.chapters\[(\d+)\]/.exec(issue.path);
  const index = chapterMatch ? Number(chapterMatch[1]) : -1;
  const chapter = project.chapters[index];
  if (!chapter) return null;
  return {
    chapterId: chapter.chapterId,
    selection: selectionFromIssuePath(chapter.level, issue.path),
  };
}

export function ValidationPanel({
  project,
  issues,
  playtestBlocked,
  onSelect,
  onClose,
}: {
  project: LevelEditorProject;
  issues: readonly LevelEditorIssue[];
  playtestBlocked: boolean;
  onSelect(chapterId: LevelEditorChapterId, selection: EditorSelection | null): void;
  onClose(): void;
}) {
  return (
    <section className="editor-checks-panel" aria-label="Review issues">
      <div className="editor-section-heading">
        <h2>Review issues</h2>
        <button type="button" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      {playtestBlocked && (
        <p className="editor-checks-callout">Fix these issues before playtesting.</p>
      )}
      <div className="editor-issue-list">
        {issues.map((issue, index) => {
          const target = issueTarget(project, issue);
          return (
            <button
              type="button"
              className="editor-issue"
              key={`${issue.path}:${issue.code}:${index}`}
              onClick={() => {
                if (target) onSelect(target.chapterId, target.selection);
              }}
            >
              <strong>{issue.message}</strong>
              <span>{issue.path}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
