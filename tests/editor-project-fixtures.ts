import gardenV2 from "../src/shared/levels/garden-playground-v2.json";
import bestiesV2 from "../src/shared/levels/besties-playground-v2.json";
import {
  resolveAuthoredLevelDocument,
  type AuthoredLevelDocument,
  type ResolvedAuthoredLevel,
} from "../src/shared/authored-level";

export const V2_TEMPLATE_ROUTE_IDS = [
  "garden-playground-v2",
  "besties-playground-v2",
] as const;

export type V2TemplateRouteId = (typeof V2_TEMPLATE_ROUTE_IDS)[number];

export const V2_TEMPLATES: Readonly<Record<V2TemplateRouteId, unknown>> = {
  "garden-playground-v2": gardenV2,
  "besties-playground-v2": bestiesV2,
};

function round(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/**
 * Slide a whole authored level along X, the way an author dragging every piece
 * would. A uniform translation keeps each gap, rise and support relationship
 * intact, so the result stays semantically valid while every coordinate, anchor,
 * arena bound and derived level bound changes. `size`, `halfExtents` and motion
 * parameters are deliberately left alone.
 */
export function shiftAuthoredLevelX<T>(document: T, dx: number): T {
  const walk = (node: unknown, key?: string): unknown => {
    if (Array.isArray(node)) return node.map((entry) => walk(entry));
    if (!node || typeof node !== "object") return node;
    const out: Record<string, unknown> = {};
    for (const [childKey, value] of Object.entries(node)) {
      out[childKey] = walk(value, childKey);
    }
    if ((key === "center" || key === "position") && typeof out.x === "number") {
      out.x = round(out.x + dx);
    }
    if (key === "arena") {
      for (const bound of ["minX", "maxX"] as const) {
        const current = out[bound];
        if (typeof current === "number") out[bound] = round(current + dx);
      }
    }
    return out;
  };
  return walk(document) as T;
}

/** Both chapter documents of one edited project, as plain JSON. */
export function editedV2Documents(
  dx: number,
): Record<V2TemplateRouteId, AuthoredLevelDocument> {
  return {
    "garden-playground-v2": shiftAuthoredLevelX(
      V2_TEMPLATES["garden-playground-v2"],
      dx,
    ) as AuthoredLevelDocument,
    "besties-playground-v2": shiftAuthoredLevelX(
      V2_TEMPLATES["besties-playground-v2"],
      dx,
    ) as AuthoredLevelDocument,
  };
}

/** The same project, resolved the way an editor preview snapshot resolves it. */
export function editedV2Levels(
  dx: number,
): Record<V2TemplateRouteId, ResolvedAuthoredLevel> {
  const documents = editedV2Documents(dx);
  return {
    "garden-playground-v2": resolveAuthoredLevelDocument(
      documents["garden-playground-v2"],
    ),
    "besties-playground-v2": resolveAuthoredLevelDocument(
      documents["besties-playground-v2"],
    ),
  };
}
