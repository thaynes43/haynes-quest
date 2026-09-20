import { z } from "zod";

import gardenTemplate from "./levels/garden-playground-v2.json";
import bestiesTemplate from "./levels/besties-playground-v2.json";
import {
  AUTHORED_LEVEL_LIMITS,
  AUTHORED_LEVEL_SCHEMA_VERSION_V2,
  authoredLevelDocumentSchema,
  resolveAuthoredLevelDocument,
  validateAuthoredLevelDocument,
  type AuthoredAnchor,
  type AuthoredArena,
  type AuthoredConnection,
  type AuthoredEncounterAnchor,
  type AuthoredEncounterSlot,
  type AuthoredLevelDocument,
  type AuthoredLevelPiece,
  type AuthoredPosition,
  type ResolvedAuthoredLevel,
} from "./authored-level";
import { validateEditorGameplayGuards } from "./editor-gameplay-guards";

export const LEVEL_EDITOR_PROJECT_SCHEMA_VERSION =
  "level-editor-project-v1" as const;
export const LEVEL_EDITOR_CHAPTER_IDS = ["chapter-1", "chapter-2"] as const;
export const LEVEL_EDITOR_TEMPLATE_ROUTE_IDS = [
  "garden-playground-v2",
  "besties-playground-v2",
] as const;
export const LEVEL_EDITOR_CHAPTER_ROUTES = Object.freeze({
  "chapter-1": "garden-playground-v2",
  "chapter-2": "besties-playground-v2",
} as const);
export const LEVEL_EDITOR_PROJECT_MAX_BYTES = 320 * 1024;
export const LEVEL_EDITOR_LEVEL_MAX_BYTES = 128 * 1024;
export const LEVEL_EDITOR_COMMAND_BATCH_MAX_BYTES = 256 * 1024;
export const LEVEL_EDITOR_MAX_COMMANDS_PER_BATCH = 256;

export type LevelEditorChapterId = (typeof LEVEL_EDITOR_CHAPTER_IDS)[number];
export type LevelEditorTemplateRouteId =
  (typeof LEVEL_EDITOR_TEMPLATE_ROUTE_IDS)[number];
export type LevelEditorLevelDocument = Omit<
  AuthoredLevelDocument,
  "schemaVersion" | "id"
> & {
  readonly schemaVersion: typeof AUTHORED_LEVEL_SCHEMA_VERSION_V2;
  readonly id: LevelEditorTemplateRouteId;
};

export interface LevelEditorChapter<
  ChapterId extends LevelEditorChapterId = LevelEditorChapterId,
  TemplateRouteId extends LevelEditorTemplateRouteId = LevelEditorTemplateRouteId,
> {
  readonly chapterId: ChapterId;
  readonly name: string;
  readonly templateRouteId: TemplateRouteId;
  readonly level: LevelEditorLevelDocument & { readonly id: TemplateRouteId };
}

export interface LevelEditorProject {
  readonly schemaVersion: typeof LEVEL_EDITOR_PROJECT_SCHEMA_VERSION;
  readonly projectId: string;
  readonly name: string;
  readonly revision: number;
  readonly chapters: readonly [
    LevelEditorChapter<"chapter-1", "garden-playground-v2">,
    LevelEditorChapter<"chapter-2", "besties-playground-v2">,
  ];
}

export type LevelEditorIssueSource = "structure" | "semantic" | "command";

export interface LevelEditorIssue {
  readonly source: LevelEditorIssueSource;
  readonly path: string;
  readonly code: string;
  readonly message: string;
  readonly commandIndex?: number;
}

export interface ResolvedLevelEditorProject {
  readonly project: LevelEditorProject;
  readonly levels: Readonly<
    Record<LevelEditorTemplateRouteId, ResolvedAuthoredLevel>
  >;
}

export interface CreateLevelEditorProjectOptions {
  readonly projectId: string;
  readonly name?: string;
  readonly chapterNames?: Readonly<
    Partial<Record<LevelEditorChapterId, string>>
  >;
}

export class LevelEditorProjectValidationError extends Error {
  readonly issues: readonly LevelEditorIssue[];

  constructor(issues: readonly LevelEditorIssue[]) {
    super(
      `Level editor project is invalid: ${issues
        .map((entry) => `${entry.path}: ${entry.message}`)
        .join("; ")}`,
    );
    this.name = "LevelEditorProjectValidationError";
    this.issues = freezeIssues(issues);
  }
}

const identifierSchema = z.string().regex(/^[a-z][a-z0-9-]{0,79}$/);
const displayNameSchema = z
  .string()
  .min(1)
  .max(80)
  .refine((value) => value.trim().length > 0, "Name cannot be blank");
const revisionSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
// Reuse the published v2 schema's public Zod shape so command JSON Schema
// describes complete payloads without creating a second structural contract.
const authoredLevelV2Schema = authoredLevelDocumentSchema.options[1];
const pieceSchema = authoredLevelV2Schema.shape.pieces.element;
const anchorSchema = authoredLevelV2Schema.shape.anchors.shape.spawn;
const encounterAnchorSchema =
  authoredLevelV2Schema.shape.anchors.shape.encounters.shape.boss;
const positionSchema = anchorSchema.shape.position;
const arenaSchema = encounterAnchorSchema.shape.arena;
const connectionSchema = authoredLevelV2Schema.shape.connections.element;
const connectionMatchSchema = z
  .object({
    index: z.number().int().nonnegative().optional(),
    from: identifierSchema,
    to: identifierSchema,
    mode: z.enum(["walk", "jump", "ride"]),
  })
  .strict();

function editorLevelSchema(routeId: LevelEditorTemplateRouteId) {
  return authoredLevelV2Schema.extend({ id: z.literal(routeId) }).strict();
}

const chapterOneSchema = z
  .object({
    chapterId: z.literal("chapter-1"),
    name: displayNameSchema,
    templateRouteId: z.literal("garden-playground-v2"),
    level: editorLevelSchema("garden-playground-v2"),
  })
  .strict();
const chapterTwoSchema = z
  .object({
    chapterId: z.literal("chapter-2"),
    name: displayNameSchema,
    templateRouteId: z.literal("besties-playground-v2"),
    level: editorLevelSchema("besties-playground-v2"),
  })
  .strict();

export const levelEditorProjectSchema = z
  .object({
    schemaVersion: z.literal(LEVEL_EDITOR_PROJECT_SCHEMA_VERSION),
    projectId: identifierSchema,
    name: displayNameSchema,
    revision: revisionSchema,
    chapters: z.tuple([chapterOneSchema, chapterTwoSchema]),
  })
  .strict();

function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function jsonText(value: unknown): string | undefined {
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function frozenClone<T>(value: T): T {
  return deepFreeze(cloneJson(value));
}

function issue(
  source: LevelEditorIssueSource,
  path: string,
  code: string,
  message: string,
  commandIndex?: number,
): LevelEditorIssue {
  return Object.freeze({
    source,
    path,
    code,
    message,
    ...(commandIndex === undefined ? {} : { commandIndex }),
  });
}

function freezeIssues(entries: readonly LevelEditorIssue[]): readonly LevelEditorIssue[] {
  return Object.freeze(entries.map((entry) => Object.freeze({ ...entry })));
}

function jsonPath(path: PropertyKey[]): string {
  return path.reduce<string>((result, part) => {
    if (typeof part === "number") return `${result}[${part}]`;
    const key = String(part);
    return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)
      ? `${result}.${key}`
      : `${result}[${JSON.stringify(key)}]`;
  }, "$");
}

function structuralIssues(error: z.ZodError): readonly LevelEditorIssue[] {
  return freezeIssues(
    error.issues.map((entry) =>
      issue(
        "structure",
        jsonPath(entry.path),
        `zod.${entry.code}`,
        entry.message,
      ),
    ),
  );
}

function sizeIssue(path: string, maximum: number): LevelEditorIssue {
  return issue(
    "structure",
    path,
    "size.limit",
    `JSON data must be no larger than ${maximum} bytes`,
  );
}

export function parseLevelEditorProject(input: unknown): LevelEditorProject {
  const compact = jsonText(input);
  if (compact === undefined)
    throw new LevelEditorProjectValidationError([
      issue(
        "structure",
        "$",
        "json.value",
        "Project must be JSON-compatible data",
      ),
    ]);
  if (utf8Bytes(compact) > LEVEL_EDITOR_PROJECT_MAX_BYTES)
    throw new LevelEditorProjectValidationError([
      sizeIssue("$", LEVEL_EDITOR_PROJECT_MAX_BYTES),
    ]);

  const parsed = levelEditorProjectSchema.safeParse(input);
  if (!parsed.success)
    throw new LevelEditorProjectValidationError(structuralIssues(parsed.error));

  const oversizedChapter = parsed.data.chapters.findIndex(
    (chapter) =>
      utf8Bytes(JSON.stringify(sortJson(chapter.level), null, 2)) >
      LEVEL_EDITOR_LEVEL_MAX_BYTES,
  );
  if (oversizedChapter >= 0)
    throw new LevelEditorProjectValidationError([
      sizeIssue(
        `$.chapters[${oversizedChapter}].level`,
        LEVEL_EDITOR_LEVEL_MAX_BYTES,
      ),
    ]);

  const readableProject = `${JSON.stringify(sortJson(parsed.data), null, 2)}\n`;
  if (utf8Bytes(readableProject) > LEVEL_EDITOR_PROJECT_MAX_BYTES)
    throw new LevelEditorProjectValidationError([
      sizeIssue("$", LEVEL_EDITOR_PROJECT_MAX_BYTES),
    ]);

  return frozenClone(parsed.data) as LevelEditorProject;
}

export function parseLevelEditorProjectJson(source: string): LevelEditorProject {
  if (utf8Bytes(source) > LEVEL_EDITOR_PROJECT_MAX_BYTES)
    throw new LevelEditorProjectValidationError([
      sizeIssue("$", LEVEL_EDITOR_PROJECT_MAX_BYTES),
    ]);
  let input: unknown;
  try {
    input = JSON.parse(source);
  } catch {
    throw new LevelEditorProjectValidationError([
      issue("structure", "$", "json.syntax", "Project is not valid JSON"),
    ]);
  }
  return parseLevelEditorProject(input);
}

function prefixedAuthoredPath(prefix: string, path: string): string {
  return path === "$" ? prefix : `${prefix}${path.startsWith("$") ? path.slice(1) : `.${path}`}`;
}

export function validateLevelEditorProject(
  input: unknown,
): readonly LevelEditorIssue[] {
  let project: LevelEditorProject;
  try {
    project = parseLevelEditorProject(input);
  } catch (error) {
    if (error instanceof LevelEditorProjectValidationError) return error.issues;
    throw error;
  }

  const issues: LevelEditorIssue[] = [];
  project.chapters.forEach((chapter, index) => {
    const prefix = `$.chapters[${index}].level`;
    const chapterIssues = [
      ...validateAuthoredLevelDocument(chapter.level),
      ...validateEditorGameplayGuards(chapter.level),
    ];
    for (const entry of chapterIssues)
      issues.push(
        issue(
          "semantic",
          prefixedAuthoredPath(prefix, entry.path),
          entry.code,
          entry.message,
        ),
      );
  });
  return freezeIssues(issues);
}

export function resolveLevelEditorProject(
  input: unknown,
): ResolvedLevelEditorProject {
  const project = parseLevelEditorProject(input);
  const issues = validateLevelEditorProject(project);
  if (issues.length > 0) throw new LevelEditorProjectValidationError(issues);
  const levels = Object.freeze({
    "garden-playground-v2": resolveAuthoredLevelDocument(
      project.chapters[0].level,
    ),
    "besties-playground-v2": resolveAuthoredLevelDocument(
      project.chapters[1].level,
    ),
  });
  return Object.freeze({ project, levels });
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, nested]) => [key, sortJson(nested)]),
  );
}

export function canonicalLevelEditorProjectJson(input: unknown): string {
  return JSON.stringify(sortJson(parseLevelEditorProject(input)));
}

export function serializeLevelEditorProject(input: unknown): string {
  return `${JSON.stringify(sortJson(parseLevelEditorProject(input)), null, 2)}\n`;
}

export function createLevelEditorProject(
  options: CreateLevelEditorProjectOptions,
): LevelEditorProject {
  return parseLevelEditorProject({
    schemaVersion: LEVEL_EDITOR_PROJECT_SCHEMA_VERSION,
    projectId: options.projectId,
    name: options.name ?? "Untitled adventure",
    revision: 0,
    chapters: [
      {
        chapterId: "chapter-1",
        name: options.chapterNames?.["chapter-1"] ?? "The Block Party",
        templateRouteId: "garden-playground-v2",
        level: gardenTemplate,
      },
      {
        chapterId: "chapter-2",
        name: options.chapterNames?.["chapter-2"] ?? "Besties Obby",
        templateRouteId: "besties-playground-v2",
        level: bestiesTemplate,
      },
    ],
  });
}

export function rebaseLevelEditorProject(
  snapshot: unknown,
  revision: number,
): LevelEditorProject {
  const project = parseLevelEditorProject(snapshot);
  return parseLevelEditorProject({ ...project, revision });
}

export const LEVEL_EDITOR_ANCHOR_SLOTS = [
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

export type LevelEditorAnchorSlot = (typeof LEVEL_EDITOR_ANCHOR_SLOTS)[number];
export type LevelEditorConnectionMatch = Pick<
  AuthoredConnection,
  "from" | "to" | "mode"
> & { readonly index?: number };

interface ChapterCommand {
  readonly chapterId: LevelEditorChapterId;
}

export type LevelEditorCommand =
  | { readonly type: "project.rename"; readonly name: string }
  | ({ readonly type: "chapter.rename"; readonly name: string } & ChapterCommand)
  | ({ readonly type: "piece.add"; readonly piece: AuthoredLevelPiece } & ChapterCommand)
  | ({
      readonly type: "piece.update";
      readonly pieceId: string;
      readonly piece: AuthoredLevelPiece;
      readonly carryAttached?: boolean;
    } & ChapterCommand)
  | ({
      readonly type: "piece.move";
      readonly pieceId: string;
      readonly position: AuthoredPosition;
      readonly carryAttached?: boolean;
    } & ChapterCommand)
  | ({ readonly type: "piece.remove"; readonly pieceId: string } & ChapterCommand)
  | ({
      readonly type: "piece.duplicate";
      readonly pieceId: string;
      readonly newPieceId: string;
      readonly offset?: AuthoredPosition;
    } & ChapterCommand)
  | ({
      readonly type: "piece.rename";
      readonly pieceId: string;
      readonly newPieceId: string;
    } & ChapterCommand)
  | ({
      readonly type: "anchor.set";
      readonly slot: LevelEditorAnchorSlot;
      readonly value: AuthoredAnchor | AuthoredEncounterAnchor;
    } & ChapterCommand)
  | ({
      readonly type: "anchor.move";
      readonly slot: LevelEditorAnchorSlot;
      readonly position: AuthoredPosition;
      readonly carryArena?: boolean;
    } & ChapterCommand)
  | ({
      readonly type: "encounter.arena.set";
      readonly slot: AuthoredEncounterSlot;
      readonly arena: AuthoredArena;
    } & ChapterCommand)
  | ({
      readonly type: "connection.add";
      readonly connection: AuthoredConnection;
    } & ChapterCommand)
  | ({
      readonly type: "connection.update";
      readonly match: LevelEditorConnectionMatch;
      readonly connection: AuthoredConnection;
    } & ChapterCommand)
  | ({
      readonly type: "connection.remove";
      readonly match: LevelEditorConnectionMatch;
    } & ChapterCommand)
  | ({
      readonly type: "main-path.set";
      readonly platformIds: readonly string[];
    } & ChapterCommand)
  | ({
      readonly type: "branch.add";
      readonly platformIds: readonly string[];
      readonly index?: number;
    } & ChapterCommand)
  | ({
      readonly type: "branch.update";
      readonly index: number;
      readonly platformIds: readonly string[];
    } & ChapterCommand)
  | ({ readonly type: "branch.remove"; readonly index: number } & ChapterCommand);

const chapterIdField = { chapterId: z.enum(LEVEL_EDITOR_CHAPTER_IDS) } as const;
const pieceIdField = { pieceId: identifierSchema } as const;
const pathIdsSchema = z
  .array(identifierSchema)
  .max(AUTHORED_LEVEL_LIMITS.maxPathNodes);
const branchIdsSchema = z
  .array(identifierSchema)
  .max(AUTHORED_LEVEL_LIMITS.maxBranchNodes);

export const levelEditorCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("project.rename"), name: displayNameSchema }).strict(),
  z
    .object({
      type: z.literal("chapter.rename"),
      ...chapterIdField,
      name: displayNameSchema,
    })
    .strict(),
  z
    .object({ type: z.literal("piece.add"), ...chapterIdField, piece: pieceSchema })
    .strict(),
  z
    .object({
      type: z.literal("piece.update"),
      ...chapterIdField,
      ...pieceIdField,
      piece: pieceSchema,
      carryAttached: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("piece.move"),
      ...chapterIdField,
      ...pieceIdField,
      position: positionSchema,
      carryAttached: z.boolean().optional(),
    })
    .strict(),
  z
    .object({ type: z.literal("piece.remove"), ...chapterIdField, ...pieceIdField })
    .strict(),
  z
    .object({
      type: z.literal("piece.duplicate"),
      ...chapterIdField,
      ...pieceIdField,
      newPieceId: identifierSchema,
      offset: positionSchema.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("piece.rename"),
      ...chapterIdField,
      ...pieceIdField,
      newPieceId: identifierSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("anchor.set"),
      ...chapterIdField,
      slot: z.enum(LEVEL_EDITOR_ANCHOR_SLOTS),
      value: z.union([anchorSchema, encounterAnchorSchema]),
    })
    .strict(),
  z
    .object({
      type: z.literal("anchor.move"),
      ...chapterIdField,
      slot: z.enum(LEVEL_EDITOR_ANCHOR_SLOTS),
      position: positionSchema,
      carryArena: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("encounter.arena.set"),
      ...chapterIdField,
      slot: z.enum(["ordinary-1", "ordinary-2", "ordinary-3", "ordinary-4", "boss"]),
      arena: arenaSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("connection.add"),
      ...chapterIdField,
      connection: connectionSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("connection.update"),
      ...chapterIdField,
      match: connectionMatchSchema,
      connection: connectionSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("connection.remove"),
      ...chapterIdField,
      match: connectionMatchSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("main-path.set"),
      ...chapterIdField,
      platformIds: pathIdsSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("branch.add"),
      ...chapterIdField,
      platformIds: branchIdsSchema,
      index: z.number().int().nonnegative().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("branch.update"),
      ...chapterIdField,
      index: z.number().int().nonnegative(),
      platformIds: branchIdsSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("branch.remove"),
      ...chapterIdField,
      index: z.number().int().nonnegative(),
    })
    .strict(),
]);

export interface LevelEditorCommandBatch {
  readonly expectedRevision: number;
  readonly commands: readonly LevelEditorCommand[];
}

export const levelEditorCommandBatchSchema = z
  .object({
    expectedRevision: revisionSchema,
    commands: z
      .array(levelEditorCommandSchema)
      .min(1)
      .max(LEVEL_EDITOR_MAX_COMMANDS_PER_BATCH),
  })
  .strict();

export type LevelEditorCommandResult =
  | {
      readonly ok: true;
      readonly project: LevelEditorProject;
      readonly issues: readonly LevelEditorIssue[];
    }
  | {
      readonly ok: false;
      readonly project: LevelEditorProject;
      readonly issues: readonly LevelEditorIssue[];
    };

type DeepMutable<T> = T extends readonly (infer Entry)[]
  ? DeepMutable<Entry>[]
  : T extends object
    ? { -readonly [Key in keyof T]: DeepMutable<T[Key]> }
    : T;
type MutableProject = DeepMutable<LevelEditorProject>;
type MutableChapter = MutableProject["chapters"][number];
type MutableLevel = MutableChapter["level"];
type MutableAnchor = DeepMutable<AuthoredAnchor>;
type MutableEncounterAnchor = DeepMutable<AuthoredEncounterAnchor>;

class CommandApplicationError extends Error {
  readonly path: string;
  readonly code: string;

  constructor(path: string, code: string, message: string) {
    super(message);
    this.name = "CommandApplicationError";
    this.path = path;
    this.code = code;
  }
}

function commandError(path: string, code: string, message: string): never {
  throw new CommandApplicationError(path, code, message);
}

function chapterFor(
  project: MutableProject,
  chapterId: LevelEditorChapterId,
): MutableChapter {
  const chapter = project.chapters.find((entry) => entry.chapterId === chapterId);
  if (!chapter)
    commandError(
      "$.chapterId",
      "chapter.missing",
      `Chapter ${chapterId} does not exist`,
    );
  return chapter;
}

function pieceIndex(level: MutableLevel, pieceId: string): number {
  const matches = level.pieces.flatMap((piece, index) =>
    piece.id === pieceId ? [index] : [],
  );
  if (matches.length === 0)
    commandError(
      "$.pieceId",
      "piece.missing",
      `Piece ${pieceId} does not exist`,
    );
  if (matches.length > 1)
    commandError(
      "$.pieceId",
      "piece.ambiguous",
      `Piece ${pieceId} is not unique`,
    );
  return matches[0]!;
}

function addPosition(
  position: DeepMutable<AuthoredPosition>,
  delta: AuthoredPosition,
): void {
  position.x += delta.x;
  position.y += delta.y;
  position.z += delta.z;
}

function deltaBetween(
  next: AuthoredPosition,
  previous: AuthoredPosition,
): AuthoredPosition {
  return {
    x: next.x - previous.x,
    y: next.y - previous.y,
    z: next.z - previous.z,
  };
}

function shiftArena(arena: DeepMutable<AuthoredArena>, delta: AuthoredPosition): void {
  arena.minX += delta.x;
  arena.maxX += delta.x;
  arena.minZ += delta.z;
  arena.maxZ += delta.z;
}

function allAnchors(level: MutableLevel): Array<MutableAnchor | MutableEncounterAnchor> {
  return [
    level.anchors.spawn,
    level.anchors.finish,
    level.anchors.rewardRespawn,
    ...Object.values(level.anchors.pickups),
    ...Object.values(level.anchors.memories),
    ...Object.values(level.anchors.encounters),
    ...Object.values(level.anchors.friendlies),
  ];
}

function carryPlatformAttachments(
  level: MutableLevel,
  platformId: string,
  delta: AuthoredPosition,
): void {
  for (const piece of level.pieces) {
    if (piece.type === "checkpoint" && piece.platformId === platformId)
      addPosition(piece.position, delta);
  }
  for (const anchor of allAnchors(level)) {
    if (anchor.platformId !== platformId) continue;
    addPosition(anchor.position, delta);
    if ("arena" in anchor) shiftArena(anchor.arena, delta);
  }
}

function anchorFor(level: MutableLevel, slot: LevelEditorAnchorSlot): MutableAnchor | MutableEncounterAnchor {
  switch (slot) {
    case "spawn":
      return level.anchors.spawn;
    case "finish":
      return level.anchors.finish;
    case "reward-respawn":
      return level.anchors.rewardRespawn;
    case "pickup.attack-tool":
      return level.anchors.pickups["attack-tool"];
    case "pickup.guard-tool":
      return level.anchors.pickups["guard-tool"];
    case "memory.minor-one":
      return level.anchors.memories["minor-one"];
    case "memory.minor-two":
      return level.anchors.memories["minor-two"];
    case "memory.major":
      return level.anchors.memories.major;
    case "encounter.ordinary-1":
      return level.anchors.encounters["ordinary-1"];
    case "encounter.ordinary-2":
      return level.anchors.encounters["ordinary-2"];
    case "encounter.ordinary-3":
      return level.anchors.encounters["ordinary-3"];
    case "encounter.ordinary-4":
      return level.anchors.encounters["ordinary-4"];
    case "encounter.boss":
      return level.anchors.encounters.boss;
    case "friendly.friendly-1":
      return level.anchors.friendlies["friendly-1"];
    case "friendly.friendly-2":
      return level.anchors.friendlies["friendly-2"];
    case "friendly.friendly-3":
      return level.anchors.friendlies["friendly-3"];
  }
}

function setAnchor(
  level: MutableLevel,
  slot: LevelEditorAnchorSlot,
  value: AuthoredAnchor | AuthoredEncounterAnchor,
): void {
  const cloned = cloneJson(value) as MutableAnchor | MutableEncounterAnchor;
  switch (slot) {
    case "spawn":
      level.anchors.spawn = cloned as MutableAnchor;
      break;
    case "finish":
      level.anchors.finish = cloned as MutableAnchor;
      break;
    case "reward-respawn":
      level.anchors.rewardRespawn = cloned as MutableAnchor;
      break;
    case "pickup.attack-tool":
      level.anchors.pickups["attack-tool"] = cloned as MutableAnchor;
      break;
    case "pickup.guard-tool":
      level.anchors.pickups["guard-tool"] = cloned as MutableAnchor;
      break;
    case "memory.minor-one":
      level.anchors.memories["minor-one"] = cloned as MutableAnchor;
      break;
    case "memory.minor-two":
      level.anchors.memories["minor-two"] = cloned as MutableAnchor;
      break;
    case "memory.major":
      level.anchors.memories.major = cloned as MutableAnchor;
      break;
    case "encounter.ordinary-1":
      level.anchors.encounters["ordinary-1"] = cloned as MutableEncounterAnchor;
      break;
    case "encounter.ordinary-2":
      level.anchors.encounters["ordinary-2"] = cloned as MutableEncounterAnchor;
      break;
    case "encounter.ordinary-3":
      level.anchors.encounters["ordinary-3"] = cloned as MutableEncounterAnchor;
      break;
    case "encounter.ordinary-4":
      level.anchors.encounters["ordinary-4"] = cloned as MutableEncounterAnchor;
      break;
    case "encounter.boss":
      level.anchors.encounters.boss = cloned as MutableEncounterAnchor;
      break;
    case "friendly.friendly-1":
      level.anchors.friendlies["friendly-1"] = cloned as MutableAnchor;
      break;
    case "friendly.friendly-2":
      level.anchors.friendlies["friendly-2"] = cloned as MutableAnchor;
      break;
    case "friendly.friendly-3":
      level.anchors.friendlies["friendly-3"] = cloned as MutableAnchor;
      break;
  }
}

function connectionMatches(
  connection: AuthoredConnection,
  match: LevelEditorConnectionMatch,
): boolean {
  return (
    connection.from === match.from &&
    connection.to === match.to &&
    connection.mode === match.mode
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function authoredPositionFrom(value: unknown): AuthoredPosition | undefined {
  if (!isRecord(value)) return undefined;
  const { x, y, z } = value;
  if (
    typeof x !== "number" ||
    typeof y !== "number" ||
    typeof z !== "number"
  )
    return undefined;
  return { x, y, z };
}

function matchingConnectionIndex(
  level: MutableLevel,
  match: LevelEditorConnectionMatch,
): number {
  if (match.index !== undefined) {
    const connection = level.connections[match.index];
    if (connection === undefined || !connectionMatches(connection, match))
      commandError(
        "$.match.index",
        "connection.stale",
        "The connection index no longer identifies the matching connection",
      );
    return match.index;
  }

  const matches = level.connections.flatMap((connection, index) =>
    connectionMatches(connection, match) ? [index] : [],
  );
  if (matches.length === 0)
    commandError(
      "$.match",
      "connection.missing",
      "The matching connection does not exist",
    );
  if (matches.length > 1)
    commandError(
      "$.match",
      "connection.ambiguous",
      "The matching connection is not unique",
    );
  return matches[0]!;
}

function renamePieceReferences(
  level: MutableLevel,
  previousId: string,
  nextId: string,
): void {
  for (const connection of level.connections) {
    if (connection.from === previousId) connection.from = nextId;
    if (connection.to === previousId) connection.to = nextId;
    if (connection.safeMissPlatformId === previousId)
      connection.safeMissPlatformId = nextId;
  }
  level.mainPath = level.mainPath.map((id) => (id === previousId ? nextId : id));
  level.branches = level.branches.map((branch) =>
    branch.map((id) => (id === previousId ? nextId : id)),
  );
  for (const piece of level.pieces) {
    if (piece.type === "checkpoint" && piece.platformId === previousId)
      piece.platformId = nextId;
  }
  for (const anchor of allAnchors(level)) {
    if (anchor.platformId === previousId) anchor.platformId = nextId;
    if ("checkpointId" in anchor && anchor.checkpointId === previousId)
      anchor.checkpointId = nextId;
  }
}

function applyCommand(project: MutableProject, command: LevelEditorCommand): void {
  if (command.type === "project.rename") {
    project.name = command.name;
    return;
  }

  const chapter = chapterFor(project, command.chapterId);
  const level = chapter.level;
  switch (command.type) {
    case "chapter.rename":
      chapter.name = command.name;
      return;
    case "piece.add": {
      const proposedId = isRecord(command.piece) ? command.piece.id : undefined;
      if (
        typeof proposedId === "string" &&
        level.pieces.some((entry) => entry.id === proposedId)
      )
        commandError(
          "$.piece.id",
          "piece.duplicate",
          `Piece ${proposedId} already exists`,
        );
      level.pieces.push(cloneJson(command.piece) as DeepMutable<AuthoredLevelPiece>);
      return;
    }
    case "piece.update": {
      const index = pieceIndex(level, command.pieceId);
      const previous = level.pieces[index]!;
      const proposed = isRecord(command.piece) ? command.piece : undefined;
      if (proposed && proposed.id !== command.pieceId)
        commandError(
          "$.piece.id",
          "piece.identity",
          "piece.update cannot change the piece id; use piece.rename",
        );
      if (proposed && proposed.type !== previous.type)
        commandError(
          "$.piece.type",
          "piece.type",
          "piece.update cannot change the piece type",
        );
      const proposedCenter = authoredPositionFrom(proposed?.center);
      if (
        (previous.type === "platform" || previous.type === "moving-platform") &&
        (proposed?.type === "platform" || proposed?.type === "moving-platform") &&
        proposedCenter &&
        command.carryAttached !== false
      ) {
        carryPlatformAttachments(
          level,
          command.pieceId,
          deltaBetween(proposedCenter, previous.center),
        );
      }
      level.pieces[index] = cloneJson(command.piece) as DeepMutable<AuthoredLevelPiece>;
      return;
    }
    case "piece.move": {
      const index = pieceIndex(level, command.pieceId);
      const piece = level.pieces[index]!;
      if (piece.type === "checkpoint") {
        piece.position = cloneJson(command.position);
        return;
      }
      if (
        (piece.type === "platform" || piece.type === "moving-platform") &&
        command.carryAttached !== false
      )
        carryPlatformAttachments(
          level,
          command.pieceId,
          deltaBetween(command.position, piece.center),
        );
      piece.center = cloneJson(command.position);
      return;
    }
    case "piece.remove": {
      const index = pieceIndex(level, command.pieceId);
      level.pieces.splice(index, 1);
      return;
    }
    case "piece.duplicate": {
      const index = pieceIndex(level, command.pieceId);
      if (level.pieces.some((entry) => entry.id === command.newPieceId))
        commandError(
          "$.newPieceId",
          "piece.duplicate",
          `Piece ${command.newPieceId} already exists`,
        );
      const duplicate = cloneJson(level.pieces[index]!) as DeepMutable<AuthoredLevelPiece>;
      duplicate.id = command.newPieceId;
      const offset = command.offset ?? { x: 1, y: 0, z: 1 };
      if (duplicate.type === "checkpoint") addPosition(duplicate.position, offset);
      else addPosition(duplicate.center, offset);
      level.pieces.push(duplicate);
      return;
    }
    case "piece.rename": {
      const index = pieceIndex(level, command.pieceId);
      if (level.pieces.some((entry) => entry.id === command.newPieceId))
        commandError(
          "$.newPieceId",
          "piece.duplicate",
          `Piece ${command.newPieceId} already exists`,
        );
      level.pieces[index]!.id = command.newPieceId;
      renamePieceReferences(level, command.pieceId, command.newPieceId);
      return;
    }
    case "anchor.set":
      setAnchor(level, command.slot, command.value);
      return;
    case "anchor.move": {
      const anchor = anchorFor(level, command.slot);
      const delta = deltaBetween(command.position, anchor.position);
      anchor.position = cloneJson(command.position);
      if ("arena" in anchor && command.carryArena !== false)
        shiftArena(anchor.arena, delta);
      return;
    }
    case "encounter.arena.set":
      level.anchors.encounters[command.slot].arena = cloneJson(command.arena);
      return;
    case "connection.add":
      level.connections.push(cloneJson(command.connection));
      return;
    case "connection.update":
      level.connections[matchingConnectionIndex(level, command.match)] = cloneJson(
        command.connection,
      );
      return;
    case "connection.remove":
      level.connections.splice(matchingConnectionIndex(level, command.match), 1);
      return;
    case "main-path.set":
      level.mainPath = [...command.platformIds];
      return;
    case "branch.add": {
      const index = command.index ?? level.branches.length;
      if (index > level.branches.length)
        commandError(
          "$.index",
          "branch.index",
          "Branch insertion index is outside the branch list",
        );
      level.branches.splice(index, 0, [...command.platformIds]);
      return;
    }
    case "branch.update":
      if (command.index >= level.branches.length)
        commandError(
          "$.index",
          "branch.index",
          "Branch index is outside the branch list",
        );
      level.branches[command.index] = [...command.platformIds];
      return;
    case "branch.remove":
      if (command.index >= level.branches.length)
        commandError(
          "$.index",
          "branch.index",
          "Branch index is outside the branch list",
        );
      level.branches.splice(command.index, 1);
  }
}

function commandSchemaIssues(error: z.ZodError): readonly LevelEditorIssue[] {
  return freezeIssues(
    error.issues.map((entry) => {
      const commandPosition = entry.path[0] === "commands" ? entry.path[1] : undefined;
      return issue(
        "command",
        jsonPath(entry.path),
        `zod.${entry.code}`,
        entry.message,
        typeof commandPosition === "number" ? commandPosition : undefined,
      );
    }),
  );
}

export function applyLevelEditorCommands(
  projectInput: LevelEditorProject,
  batchInput: LevelEditorCommandBatch,
): LevelEditorCommandResult {
  const project = parseLevelEditorProject(projectInput);
  const batchJson = jsonText(batchInput);
  if (
    batchJson === undefined ||
    utf8Bytes(batchJson) > LEVEL_EDITOR_COMMAND_BATCH_MAX_BYTES
  )
    return Object.freeze({
      ok: false,
      project,
      issues: freezeIssues([
        issue(
          "command",
          "$",
          "size.limit",
          `Command batch must be JSON data no larger than ${LEVEL_EDITOR_COMMAND_BATCH_MAX_BYTES} bytes`,
        ),
      ]),
    });

  const parsed = levelEditorCommandBatchSchema.safeParse(batchInput);
  if (!parsed.success)
    return Object.freeze({
      ok: false,
      project,
      issues: commandSchemaIssues(parsed.error),
    });
  if (parsed.data.expectedRevision !== project.revision)
    return Object.freeze({
      ok: false,
      project,
      issues: freezeIssues([
        issue(
          "command",
          "$.expectedRevision",
          "revision.conflict",
          `Expected revision ${parsed.data.expectedRevision}, current revision is ${project.revision}`,
        ),
      ]),
    });

  const candidate = cloneJson(project) as unknown as MutableProject;
  for (const [commandIndex, rawCommand] of parsed.data.commands.entries()) {
    const command = rawCommand as LevelEditorCommand;
    try {
      applyCommand(candidate, command);
      parseLevelEditorProject(candidate);
    } catch (error) {
      if (error instanceof CommandApplicationError)
        return Object.freeze({
          ok: false,
          project,
          issues: freezeIssues([
            issue(
              "command",
              `$.commands[${commandIndex}]${error.path.slice(1)}`,
              error.code,
              error.message,
              commandIndex,
            ),
          ]),
        });
      if (error instanceof LevelEditorProjectValidationError)
        return Object.freeze({
          ok: false,
          project,
          issues: freezeIssues(
            error.issues.map((entry) => ({ ...entry, commandIndex })),
          ),
        });
      throw error;
    }
  }

  candidate.revision += 1;
  let updated: LevelEditorProject;
  try {
    updated = parseLevelEditorProject(candidate);
  } catch (error) {
    if (error instanceof LevelEditorProjectValidationError)
      return Object.freeze({
        ok: false,
        project,
        issues: freezeIssues(
          error.issues.map((entry) => ({ ...entry, source: "command" as const })),
        ),
      });
    throw error;
  }
  return Object.freeze({
    ok: true,
    project: updated,
    issues: validateLevelEditorProject(updated),
  });
}

export function applyLevelEditorCommand(
  project: LevelEditorProject,
  command: LevelEditorCommand,
): LevelEditorCommandResult {
  return applyLevelEditorCommands(project, {
    expectedRevision: project.revision,
    commands: [command],
  });
}
