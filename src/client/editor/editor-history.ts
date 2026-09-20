export interface EditorSnapshot<TProject, TSelection> {
  readonly project: TProject;
  readonly selection: TSelection;
}

export interface EditorHistory<TProject, TSelection> {
  readonly past: readonly EditorSnapshot<TProject, TSelection>[];
  readonly present: EditorSnapshot<TProject, TSelection>;
  readonly future: readonly EditorSnapshot<TProject, TSelection>[];
}

export function createEditorHistory<TProject, TSelection>(
  present: EditorSnapshot<TProject, TSelection>,
): EditorHistory<TProject, TSelection> {
  return { past: [], present, future: [] };
}

export function commitEditorHistory<TProject, TSelection>(
  history: EditorHistory<TProject, TSelection>,
  present: EditorSnapshot<TProject, TSelection>,
  limit = 80,
): EditorHistory<TProject, TSelection> {
  return {
    past: [...history.past, history.present].slice(-limit),
    present,
    future: [],
  };
}

export function replaceEditorSelection<TProject, TSelection>(
  history: EditorHistory<TProject, TSelection>,
  selection: TSelection,
): EditorHistory<TProject, TSelection> {
  return {
    ...history,
    present: { ...history.present, selection },
  };
}

export function undoEditorHistory<TProject, TSelection>(
  history: EditorHistory<TProject, TSelection>,
  rebase: (project: TProject) => TProject,
): EditorHistory<TProject, TSelection> {
  const prior = history.past.at(-1);
  if (!prior) return history;
  return {
    past: history.past.slice(0, -1),
    present: { ...prior, project: rebase(prior.project) },
    future: [history.present, ...history.future],
  };
}

export function redoEditorHistory<TProject, TSelection>(
  history: EditorHistory<TProject, TSelection>,
  rebase: (project: TProject) => TProject,
): EditorHistory<TProject, TSelection> {
  const next = history.future[0];
  if (!next) return history;
  return {
    past: [...history.past, history.present],
    present: { ...next, project: rebase(next.project) },
    future: history.future.slice(1),
  };
}

export function isTextEntryTarget(target: EventTarget | null): boolean {
  return (
    typeof HTMLElement !== "undefined" &&
    target instanceof HTMLElement &&
    Boolean(
      target.closest(
        "input, textarea, select, [contenteditable=true], [role=textbox]",
      ),
    )
  );
}
