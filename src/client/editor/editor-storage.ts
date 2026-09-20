import {
  LEVEL_EDITOR_PROJECT_MAX_BYTES,
  parseLevelEditorProjectJson,
} from "../../shared/editor-project";

export const EDITOR_STORAGE_KEY = "haynes-quest.level-editor.project.v1";

export type LoadedEditorDraft<T> =
  | { readonly kind: "empty" }
  | { readonly kind: "project"; readonly project: T }
  | { readonly kind: "corrupt"; readonly raw: string };

export function loadEditorDraft<T>(
  storage: Pick<Storage, "getItem">,
  parse: (text: string) => T,
): LoadedEditorDraft<T> {
  const raw = storage.getItem(EDITOR_STORAGE_KEY);
  if (raw === null) return { kind: "empty" };
  try {
    return { kind: "project", project: parse(raw) };
  } catch {
    return { kind: "corrupt", raw };
  }
}

export function saveEditorDraft(
  storage: Pick<Storage, "setItem">,
  text: string,
): void {
  storage.setItem(EDITOR_STORAGE_KEY, text);
}

export function ensureImportSize(text: string): void {
  if (new TextEncoder().encode(text).byteLength > LEVEL_EDITOR_PROJECT_MAX_BYTES) {
    parseLevelEditorProjectJson(text);
  }
}

export function readableProjectFilename(name: string): string {
  const slug = name
    .normalize("NFKD")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return `${slug || "untitled-adventure"}.json`;
}
