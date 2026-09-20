import { describe, expect, it } from "vitest";

import bestiesTemplate from "../../src/shared/levels/besties-playground-v2.json";
import gardenTemplate from "../../src/shared/levels/garden-playground-v2.json";
import {
  EDITOR_CHAPTER_LABELS,
  EDITOR_PROPERTY_LABELS,
  EDITOR_STORAGE_COPY,
  EDITOR_VALIDATION_COPY,
  SHIPPED_DOCUMENT_IDS,
  canonicalText,
  canonicalValue,
  documentById,
  pieceOrder,
  projectDocuments,
  // @ts-expect-error -- plain-JavaScript browser helper shared with the .mjs harness
} from "./editor-driver.mjs";

const project = {
  version: "quest-level-project-v1",
  name: "Untitled adventure",
  chapters: {
    "chapter-1": { title: "Level 1", document: gardenTemplate },
    "chapter-2": { title: "Level 2", document: bestiesTemplate },
  },
};

describe("editor-driver document discovery", () => {
  it("finds both authored chapter documents without assuming an envelope shape", () => {
    const found = projectDocuments(project) as Array<{
      path: string;
      document: { id: string };
    }>;
    expect(found.map((entry) => entry.document.id).sort()).toEqual(
      [SHIPPED_DOCUMENT_IDS[1], SHIPPED_DOCUMENT_IDS[2]].sort(),
    );
    expect(found.map((entry) => entry.path)).toEqual([
      "chapters.chapter-1.document",
      "chapters.chapter-2.document",
    ]);
  });

  it("finds the same documents when the envelope nests them differently", () => {
    const flat = { name: "Flat", levels: [gardenTemplate, bestiesTemplate] };
    const found = projectDocuments(flat) as Array<{ document: { id: string } }>;
    expect(found.map((entry) => entry.document.id)).toEqual([
      SHIPPED_DOCUMENT_IDS[1],
      SHIPPED_DOCUMENT_IDS[2],
    ]);
  });

  it("ignores objects that merely look document-shaped", () => {
    expect(
      projectDocuments({
        note: { schemaVersion: "authored-level-v2" },
        other: { pieces: [] },
      }),
    ).toEqual([]);
  });

  it("resolves a chapter by its authored id", () => {
    expect(
      (
        documentById(project, SHIPPED_DOCUMENT_IDS[2]) as {
          document: { theme: string };
        }
      ).document.theme,
    ).toBe(bestiesTemplate.theme);
    expect(documentById(project, "missing-level")).toBeNull();
  });
});

describe("editor-driver canonical comparison", () => {
  it("treats differently ordered keys as semantically equal", () => {
    expect(canonicalText({ b: 1, a: { d: 2, c: 3 } })).toBe(
      canonicalText({ a: { c: 3, d: 2 }, b: 1 }),
    );
  });

  it("keeps array order significant so a reordered piece list is a difference", () => {
    expect(canonicalText({ pieces: [1, 2] })).not.toBe(
      canonicalText({ pieces: [2, 1] }),
    );
  });

  it("round-trips a real template unchanged", () => {
    expect(canonicalValue(canonicalValue(gardenTemplate))).toEqual(
      canonicalValue(gardenTemplate),
    );
    expect(JSON.parse(canonicalText(gardenTemplate))).toEqual(
      JSON.parse(JSON.stringify(gardenTemplate)),
    );
  });

  it("reports the authored piece order", () => {
    expect(pieceOrder(gardenTemplate)).toEqual(
      gardenTemplate.pieces.map((piece) => piece.id),
    );
  });
});

describe("editor-driver label contract", () => {
  it("uses the DESIGN019 chapter names with an em dash", () => {
    expect(EDITOR_CHAPTER_LABELS[1]).toBe("Level 1 — The Block Party");
    expect(EDITOR_CHAPTER_LABELS[2]).toBe("Level 2 — Besties Obby");
  });

  it("carries every DESIGN019 inspector label exactly once", () => {
    expect(new Set(EDITOR_PROPERTY_LABELS).size).toBe(
      (EDITOR_PROPERTY_LABELS as readonly string[]).length,
    );
    for (const label of [
      "X",
      "Y",
      "Z",
      "Width",
      "Height",
      "Depth",
      "Axis",
      "Travel",
      "Period",
      "Phase",
      "Platform",
      "Checkpoint",
      "Radius",
      "Half length",
      "Min X",
      "Max X",
      "Min Z",
      "Max Z",
    ]) {
      expect(EDITOR_PROPERTY_LABELS).toContain(label);
    }
  });

  it("carries the exact status and validation copy", () => {
    expect(EDITOR_STORAGE_COPY.saved).toBe("Saved in this browser");
    expect(EDITOR_STORAGE_COPY.unavailable).toBe(
      "Browser storage is unavailable. Export your draft to keep it.",
    );
    expect(EDITOR_VALIDATION_COPY.blocked).toBe(
      "Fix these issues before playtesting.",
    );
    expect(EDITOR_VALIDATION_COPY.runtimeFailure).toBe(
      "Could not start the playtest. Your draft is safe.",
    );
  });
});
