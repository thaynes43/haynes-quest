/** New main-route encounter pairs and optional side-route fights for A8/B7. */
import {
  applyLevelEditorCommands,
  serializeLevelEditorProject,
  validateLevelEditorProject,
  type LevelEditorCommand,
  type LevelEditorCommandBatch,
  type LevelEditorProjectV2,
} from "../../../src/shared/editor-project.js";
import type {
  AuthoredBonusEncounterSlot,
  AuthoredDecor,
  AuthoredEncounterAnchor,
  AuthoredExtendedCoreEncounterSlot,
  AuthoredLevelDocument,
} from "../../../src/shared/authored-level.js";
import { validateAuthoredLevelDocument } from "../../../src/shared/authored-level.js";
import { chapterCommands } from "../lib/growth-kit.js";

type SourceSlot = "ordinary-1" | "ordinary-2" | "ordinary-3" | "ordinary-4";
export interface DenseFightPlacement {
  readonly platformId: string;
  readonly castFrom: SourceSlot;
  /** Offset from the standing deck's centre. */
  readonly dx?: number;
  readonly dz?: number;
  /** Optional deck widening for a forgiving side-route fight. */
  readonly minWidth?: number;
  readonly minDepth?: number;
  readonly widen?: true;
}
export interface DenseChapterRevision {
  readonly chapterId: string;
  readonly guardTool?: Pick<DenseFightPlacement, "platformId" | "dx" | "dz">;
  readonly removeDecorIds?: readonly string[];
  /** Re-space historical core slots in the new immutable template only. */
  readonly relocateRequired?: Partial<Record<SourceSlot, DenseFightPlacement>>;
  /** Ordinary slots five through eight, in order. */
  readonly core: readonly [DenseFightPlacement, DenseFightPlacement, DenseFightPlacement, DenseFightPlacement];
  /** Two extra pairs: an early tutorial fight and a later route fight. */
  readonly extraCore: readonly [DenseFightPlacement, DenseFightPlacement, DenseFightPlacement, DenseFightPlacement];
  /** Optional slots one through four; all supports must be on branches. */
  readonly optional: readonly [DenseFightPlacement, DenseFightPlacement, DenseFightPlacement, DenseFightPlacement];
}

/** Candidate scenery is committed only when the complete cluster clears the route. */
function addPlantingGroups(
  level: AuthoredLevelDocument,
  commands: LevelEditorCommand[],
  chapterId: string,
  revision: DenseChapterRevision,
): void {
  const author = chapterCommands(chapterId);
  const decor = level.decor as AuthoredDecor[];
  const trialFits = (entries: AuthoredDecor[]): boolean => {
    const trial = structuredClone(level) as AuthoredLevelDocument;
    (trial.decor as AuthoredDecor[]).push(...entries);
    return validateAuthoredLevelDocument(trial).length === 0;
  };
  const decks = [
    revision.extraCore[0].platformId, revision.core[0].platformId,
    revision.core[1].platformId, revision.core[2].platformId,
    revision.core[3].platformId, revision.extraCore[2].platformId,
    ...level.mainPath,
  ].filter((id, index, list) => list.indexOf(id) === index);
  let groups = 0;
  let beds = 0;
  for (const deckId of decks) {
    const deck = level.pieces.find((piece) => piece.id === deckId);
    if (!deck || deck.type !== "platform") continue;
    const top = deck.center.y + deck.size.y / 2;
    if (groups < 4) {
      const side = [
        [deck.size.x / 2 + 4.35, 0], [-deck.size.x / 2 - 4.35, 0],
        [0, deck.size.z / 2 + 3.1], [0, -deck.size.z / 2 - 3.1],
        [deck.size.x / 2 + 4.35, 2.5], [-deck.size.x / 2 - 4.35, -2.5],
      ];
      for (const [dx, dz] of side) {
        const x = deck.center.x + dx;
        const z = deck.center.z + dz;
        const id = `dense-plant-${groups + 1}`;
        const theatrical = level.theme === "casino" || level.theme === "playroom";
        const props: readonly [string, number, number][] = theatrical
          ? [["slim-cypress", -1.8, -0.2], ["slim-cypress", 1.5, -0.3], ["flowering-shrub", -1.1, 1.2], ["flowering-shrub", 1.4, 1.1]]
          : [["broad-canopy-tree", -1.6, -0.2], ["slim-cypress", 1.5, -0.3], ["flowering-shrub", -1.1, 1.2], ["flowering-shrub", 1.4, 1.1]];
        const entries: AuthoredDecor[] = [
          { id: `${id}-soil`, kitPropId: "storybook-planter-island", position: { x, y: top, z }, rotationY: 0, scale: 1 },
          ...props.map(([kitPropId, offsetX, offsetZ], index) => ({
            id: `${id}-${index + 1}`, kitPropId,
            position: { x: x + offsetX, y: top + 0.24, z: z + offsetZ },
            rotationY: index * 0.7, scale: index === 2 ? 0.85 : 1,
          })),
        ];
        if (!trialFits(entries)) continue;
        decor.push(...entries);
        commands.push(...entries.map((entry) => author.addDecor(entry)));
        groups++;
        break;
      }
    }
    if (beds < 6) {
      deckCorners: for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const entry: AuthoredDecor = {
          id: `dense-bed-${beds + 1}`, kitPropId: "storybook-flower-bed",
          position: {
            x: Math.round((deck.center.x + sx * (deck.size.x / 2 - 1.55)) * 1000) / 1000,
            y: top,
            z: Math.round((deck.center.z + sz * (deck.size.z / 2 - 1.25)) * 1000) / 1000,
          }, rotationY: sx === sz ? 0.15 : -0.25, scale: 1,
        };
        if (!trialFits([entry])) continue;
        decor.push(entry);
        commands.push(author.addDecor(entry));
        beds++;
        break deckCorners;
      }
    }
  }
  if (groups < 3 || beds < 2)
    throw new Error(`${level.id}: planting coverage too sparse (${groups} groups, ${beds} beds)`);
}

function relocateGuardTool(level: AuthoredLevelDocument, placement: NonNullable<DenseChapterRevision["guardTool"]>) {
  const support = level.pieces.find((piece) => piece.id === placement.platformId);
  if (!support || !("center" in support) || !("size" in support))
    throw new Error(`${level.id}: guard-tool support ${placement.platformId} is unavailable`);
  const old = level.anchors.pickups["guard-tool"];
  const x = Math.round((support.center.x + (placement.dx ?? 0)) * 1000) / 1000;
  const z = Math.round((support.center.z + (placement.dz ?? 0)) * 1000) / 1000;
  const y = Math.round((support.center.y + support.size.y / 2) * 1000) / 1000;
  const anchor = { ...old, platformId: placement.platformId, position: { x, y, z } };
  const trial = structuredClone(level) as AuthoredLevelDocument;
  (trial.anchors.pickups as Record<string, typeof anchor>)["guard-tool"] = anchor;
  const issues = validateAuthoredLevelDocument(trial);
  if (issues.length) throw new Error(`${level.id}: guard-tool relocation invalid: ${issues.map((issue) => issue.code).join(", ")}`);
  return anchor;
}

function mainPathIndex(level: AuthoredLevelDocument, platformId: string): number {
  const direct = level.mainPath.indexOf(platformId);
  if (direct >= 0) return direct;
  const branch = level.branches.find((path) => path.includes(platformId));
  if (!branch) throw new Error(`${level.id}: ${platformId} is not on a route`);
  return level.mainPath.indexOf(branch[0]!);
}

function retryCheckpoint(level: AuthoredLevelDocument, platformId: string, x: number, z: number): string {
  const pathIndex = mainPathIndex(level, platformId);
  const checkpoints = level.pieces.filter((piece) => piece.type === "checkpoint")
    .map((piece) => ({ piece, index: level.mainPath.indexOf(piece.platformId) }))
    .filter(({ piece, index }) => index >= 0 && index <= pathIndex &&
      Math.hypot(piece.position.x - x, piece.position.z - z) >= 9)
    .sort((a, b) => b.index - a.index);
  const retry = checkpoints[0]?.piece;
  if (!retry) throw new Error(`${level.id}: no safe checkpoint for ${platformId}`);
  return retry.id;
}

function anchorFor(
  level: AuthoredLevelDocument,
  placement: DenseFightPlacement,
  slot: SourceSlot | AuthoredExtendedCoreEncounterSlot | AuthoredBonusEncounterSlot,
): AuthoredEncounterAnchor {
  const support = level.pieces.find((piece) => piece.id === placement.platformId);
  if (!support || support.type !== "platform")
    throw new Error(`${level.id}: ${placement.platformId} must be a static platform`);
  const y = Math.round((support.center.y + support.size.y / 2) * 1000) / 1000;
  const source = slot === "bonus-1" || slot === "bonus-2" || slot.startsWith("ordinary-") && Number(slot.slice("ordinary-".length)) <= 4
    ? level.anchors.encounters[slot]!
    : level.anchors.encounters[placement.castFrom];
  const half = 0.75;
  const radiusX = Math.max(0, support.size.x / 2 - half - 0.45);
  const radiusZ = Math.max(0, support.size.z / 2 - half - 0.45);
  const candidates: Array<{ x: number; z: number; score: number }> = [];
  for (let dx = -radiusX; dx <= radiusX + 0.001; dx += 0.75) {
    for (let dz = -radiusZ; dz <= radiusZ + 0.001; dz += 0.75) {
      const x = Math.round((support.center.x + dx) * 1000) / 1000;
      const z = Math.round((support.center.z + dz) * 1000) / 1000;
      candidates.push({ x, z,
        score: Math.hypot(dx - (placement.dx ?? 0), dz - (placement.dz ?? 0)) });
    }
  }
  candidates.sort((a, b) => a.score - b.score);
  const failures = new Map<string, number>();
  const samples: string[] = [];
  for (const candidate of candidates) {
    const { x, z } = candidate;
    const anchor: AuthoredEncounterAnchor = {
      kind: source.kind,
      platformId: placement.platformId,
      checkpointId: retryCheckpoint(level, placement.platformId, x, z),
      position: { x, y, z },
      arena: { minX: x - half, maxX: x + half, minZ: z - half, maxZ: z + half },
    };
    const trial = structuredClone(level) as AuthoredLevelDocument;
    (trial.anchors.encounters as Record<string, AuthoredEncounterAnchor>)[slot] = anchor;
    const issues = validateAuthoredLevelDocument(trial);
    if (issues.length === 0) return anchor;
    for (const issue of issues) {
      failures.set(issue.code, (failures.get(issue.code) ?? 0) + 1);
      if (samples.length < 6 && !samples.includes(`${issue.path}: ${issue.message}`)) samples.push(`${issue.path}: ${issue.message}`);
    }
  }
  throw new Error(`${level.id}: no safe ${slot} on ${placement.platformId}; ${JSON.stringify([...failures])}; examples: ${samples.join("; ")}`);
}

export function denseWorldCommands(base: LevelEditorProjectV2, revisions: readonly DenseChapterRevision[]): LevelEditorCommandBatch {
  const commands: LevelEditorCommand[] = [];
  for (const revision of revisions) {
    const chapter = base.chapters.find((entry) => entry.chapterId === revision.chapterId);
    if (!chapter) throw new Error(`Unknown chapter ${revision.chapterId}`);
    const level = structuredClone(chapter.level) as AuthoredLevelDocument;
    const author = chapterCommands(revision.chapterId);
    for (const id of revision.removeDecorIds ?? []) {
      const list = level.decor as unknown as Array<{ id: string }> | undefined;
      const index = list?.findIndex((entry) => entry.id === id) ?? -1;
      if (index < 0) throw new Error(`${level.id}: cannot remove decor ${id}`);
      list!.splice(index, 1);
      commands.push(author.removeDecor(id));
    }
    if (revision.guardTool) {
      const anchor = relocateGuardTool(level, revision.guardTool);
      (level.anchors.pickups as Record<string, typeof anchor>)["guard-tool"] = anchor;
      commands.push(author.setAnchor("pickup.guard-tool", anchor));
    }
    const widenedIds = new Set<string>();
    const widenFor = (placement: DenseFightPlacement): void => {
      if (!placement.widen) return;
      if (widenedIds.has(placement.platformId)) return;
      const support = level.pieces.find((piece) => piece.id === placement.platformId);
      if (!support || support.type !== "platform") throw new Error(`${level.id}: cannot widen ${placement.platformId}`);
      const widened = { ...support, size: { ...support.size,
        x: Math.max(support.size.x, placement.minWidth ?? support.size.x),
        z: Math.max(support.size.z, placement.minDepth ?? support.size.z),
      } };
      const pieces = level.pieces as unknown as typeof widened[];
      pieces[pieces.indexOf(support)] = widened;
      commands.push(author.update(widened));
      widenedIds.add(placement.platformId);
    };
    for (const slot of ["ordinary-1", "ordinary-2", "ordinary-3", "ordinary-4"] as const) {
      const placement = revision.relocateRequired?.[slot];
      if (!placement) continue;
      widenFor(placement);
      const anchor = anchorFor(level, placement, slot);
      (level.anchors.encounters as Record<string, AuthoredEncounterAnchor>)[slot] = anchor;
      commands.push(author.setAnchor(`encounter.${slot}`, anchor));
    }
    for (const [index, placement] of revision.optional.entries()) {
      widenFor(placement);
      if (level.mainPath.includes(placement.platformId))
        throw new Error(`${level.id}: optional ${index + 1} is on the main path`);
      const slot = `bonus-${index + 1}` as AuthoredBonusEncounterSlot;
      const anchor = anchorFor(level, placement, slot);
      (level.anchors.encounters as Record<string, AuthoredEncounterAnchor>)[slot] = anchor;
      if (index < 2) commands.push(author.setAnchor(`encounter.${slot}`, anchor));
      else commands.push(author.addBonus(anchor, chapter.encounterSlots[placement.castFrom], slot));
    }
    for (const [index, placement] of revision.core.entries()) {
      widenFor(placement);
      const slot = `ordinary-${index + 5}` as AuthoredExtendedCoreEncounterSlot;
      const cast = chapter.encounterSlots[placement.castFrom];
      const anchor = anchorFor(level, placement, slot);
      (level.anchors.encounters as Record<string, AuthoredEncounterAnchor>)[slot] = anchor;
      commands.push(author.addCore(slot, anchor, cast));
    }
    for (const [index, placement] of revision.extraCore.entries()) {
      widenFor(placement);
      const slot = `ordinary-${index + 9}` as AuthoredExtendedCoreEncounterSlot;
      const cast = chapter.encounterSlots[placement.castFrom];
      const anchor = anchorFor(level, placement, slot);
      (level.anchors.encounters as Record<string, AuthoredEncounterAnchor>)[slot] = anchor;
      commands.push(author.addCore(slot, anchor, cast));
    }
    commands.push(author.bossPrerequisite(4));
    addPlantingGroups(level, commands, revision.chapterId, revision);
  }
  return { expectedRevision: base.revision, commands };
}

export function buildDenseWorld(base: LevelEditorProjectV2, revisions: readonly DenseChapterRevision[]): LevelEditorProjectV2 {
  const result = applyLevelEditorCommands(base, denseWorldCommands(base, revisions));
  if (!result.ok) throw new Error(`Dense-world commands failed: ${result.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`);
  const issues = validateLevelEditorProject(result.project);
  if (issues.length) throw new Error(`Dense world invalid: ${issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`);
  return result.project as LevelEditorProjectV2;
}

export const serializeDenseWorld = serializeLevelEditorProject;
