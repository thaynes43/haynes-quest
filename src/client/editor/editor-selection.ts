import type {
  AuthoredAnchor,
  AuthoredEncounterAnchor,
  AuthoredLevelDocument,
  AuthoredLevelPiece,
  AuthoredPosition,
} from "../../shared/authored-level";

export const EDITOR_ANCHOR_SLOTS = [
  "spawn",
  "finish",
  "reward-respawn",
  "pickup.attack-tool",
  "pickup.guard-tool",
  "memory.minor-one",
  "memory.minor-two",
  "memory.major",
  "encounter.ordinary-1",
  "encounter.ordinary-2",
  "encounter.ordinary-3",
  "encounter.ordinary-4",
  "encounter.boss",
  "friendly.friendly-1",
  "friendly.friendly-2",
  "friendly.friendly-3",
] as const;

export type EditorAnchorSlot = (typeof EDITOR_ANCHOR_SLOTS)[number];

export type EditorSelection =
  | { readonly type: "piece"; readonly id: string }
  | { readonly type: "anchor"; readonly slot: EditorAnchorSlot };

export interface EditorObjectRow {
  readonly key: string;
  readonly group:
    | "Platforms"
    | "Hazards"
    | "Checkpoints"
    | "Gameplay";
  readonly label: string;
  readonly searchText: string;
  readonly selection: EditorSelection;
}

export function selectionKey(selection: EditorSelection | null): string {
  if (!selection) return "";
  return selection.type === "piece"
    ? `piece:${selection.id}`
    : `anchor:${selection.slot}`;
}

export function pieceForSelection(
  document: AuthoredLevelDocument,
  selection: EditorSelection | null,
): AuthoredLevelPiece | null {
  if (selection?.type !== "piece") return null;
  return document.pieces.find((piece) => piece.id === selection.id) ?? null;
}

export function anchorForSlot(
  document: AuthoredLevelDocument,
  slot: EditorAnchorSlot,
): AuthoredAnchor | AuthoredEncounterAnchor {
  if (slot === "spawn") return document.anchors.spawn;
  if (slot === "finish") return document.anchors.finish;
  if (slot === "reward-respawn") return document.anchors.rewardRespawn;
  if (slot.startsWith("pickup.")) {
    const key = slot.slice("pickup.".length) as keyof typeof document.anchors.pickups;
    return document.anchors.pickups[key];
  }
  if (slot.startsWith("memory.")) {
    const key = slot.slice("memory.".length) as keyof typeof document.anchors.memories;
    return document.anchors.memories[key];
  }
  if (slot.startsWith("encounter.")) {
    const key = slot.slice("encounter.".length) as keyof typeof document.anchors.encounters;
    return document.anchors.encounters[key];
  }
  const key = slot.slice("friendly.".length) as keyof typeof document.anchors.friendlies;
  return document.anchors.friendlies[key];
}

export function anchorForSelection(
  document: AuthoredLevelDocument,
  selection: EditorSelection | null,
): AuthoredAnchor | AuthoredEncounterAnchor | null {
  return selection?.type === "anchor"
    ? anchorForSlot(document, selection.slot)
    : null;
}

export function positionForSelection(
  document: AuthoredLevelDocument,
  selection: EditorSelection | null,
): AuthoredPosition | null {
  const piece = pieceForSelection(document, selection);
  if (piece) {
    return piece.type === "checkpoint" ? piece.position : piece.center;
  }
  return anchorForSelection(document, selection)?.position ?? null;
}

export function labelForAnchor(slot: EditorAnchorSlot): string {
  const labels: Record<EditorAnchorSlot, string> = {
    spawn: "Spawn",
    finish: "Exit",
    "reward-respawn": "Reward respawn",
    "pickup.attack-tool": "Attack tool",
    "pickup.guard-tool": "Guard tool",
    "memory.minor-one": "Memory · Minor one",
    "memory.minor-two": "Memory · Minor two",
    "memory.major": "Memory · Major",
    "encounter.ordinary-1": "Enemy · Ordinary one",
    "encounter.ordinary-2": "Enemy · Ordinary two",
    "encounter.ordinary-3": "Enemy · Ordinary three",
    "encounter.ordinary-4": "Enemy · Ordinary four",
    "encounter.boss": "Boss",
    "friendly.friendly-1": "Friend one",
    "friendly.friendly-2": "Friend two",
    "friendly.friendly-3": "Friend three",
  };
  return labels[slot];
}

export function objectRows(document: AuthoredLevelDocument): EditorObjectRow[] {
  const pieces = document.pieces.map((piece): EditorObjectRow => ({
    key: `piece:${piece.id}`,
    group:
      piece.type === "sweeper"
        ? "Hazards"
        : piece.type === "checkpoint"
          ? "Checkpoints"
          : "Platforms",
    label: piece.id,
    searchText: `${piece.id} ${piece.type}`.toLocaleLowerCase(),
    selection: { type: "piece", id: piece.id },
  }));
  const anchors = EDITOR_ANCHOR_SLOTS.map((slot): EditorObjectRow => ({
    key: `anchor:${slot}`,
    group: "Gameplay",
    label: labelForAnchor(slot),
    searchText: `${slot} ${labelForAnchor(slot)}`.toLocaleLowerCase(),
    selection: { type: "anchor", slot },
  }));
  return [...pieces, ...anchors];
}

export function uniquePieceId(
  document: AuthoredLevelDocument,
  requested: string,
): string {
  const existing = new Set(document.pieces.map((piece) => piece.id));
  if (!existing.has(requested)) return requested;
  let suffix = 2;
  while (existing.has(`${requested}-${suffix}`)) suffix += 1;
  return `${requested}-${suffix}`;
}

export function staticPlatformIds(
  document: AuthoredLevelDocument,
): string[] {
  return document.pieces
    .filter((piece) => piece.type === "platform")
    .map((piece) => piece.id);
}

export function platformIds(document: AuthoredLevelDocument): string[] {
  return document.pieces
    .filter(
      (piece) =>
        piece.type === "platform" || piece.type === "moving-platform",
    )
    .map((piece) => piece.id);
}

export function isEncounterAnchor(
  anchor: AuthoredAnchor | AuthoredEncounterAnchor,
): anchor is AuthoredEncounterAnchor {
  return "arena" in anchor;
}

export function selectionFromIssuePath(
  document: AuthoredLevelDocument,
  path: string,
): EditorSelection | null {
  const pieceMatch = /\.pieces\[(\d+)\]/.exec(path);
  if (pieceMatch) {
    const piece = document.pieces[Number(pieceMatch[1])];
    return piece ? { type: "piece", id: piece.id } : null;
  }
  const direct: Array<readonly [RegExp, EditorAnchorSlot]> = [
    [/\.anchors\.spawn(?:\.|$)/, "spawn"],
    [/\.anchors\.finish(?:\.|$)/, "finish"],
    [/\.anchors\.rewardRespawn(?:\.|$)/, "reward-respawn"],
  ];
  for (const [pattern, slot] of direct)
    if (pattern.test(path)) return { type: "anchor", slot };
  for (const slot of EDITOR_ANCHOR_SLOTS) {
    const [group, key] = slot.split(".");
    if (!key) continue;
    const sourceGroup =
      group === "pickup"
        ? "pickups"
        : group === "memory"
          ? "memories"
          : group === "encounter"
            ? "encounters"
            : "friendlies";
    if (
      path.includes(`.anchors.${sourceGroup}.${key}`) ||
      path.includes(`.anchors.${sourceGroup}["${key}"]`)
    )
      return { type: "anchor", slot };
  }
  return null;
}

export function uniqueSectionPrefix(document: AuthoredLevelDocument, pattern: string): string {
  let prefix = pattern;
  let suffix = 2;
  while (document.pieces.some((piece) =>
    piece.id.startsWith(`${prefix}-step-`) || piece.id.startsWith(`${prefix}-checkpoint-`))) {
    prefix = `${pattern}-${suffix++}`;
  }
  return prefix;
}
