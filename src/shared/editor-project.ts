import { z } from "zod";

import gardenTemplate from "./levels/garden-playground-v2.json";
import bestiesTemplate from "./levels/besties-playground-v2.json";
import {
  AUTHORED_LEVEL_LIMITS,
  AUTHORED_LEVEL_SCHEMA_VERSION_V2,
  AUTHORED_LEVEL_SCHEMA_VERSION_V3,
  AUTHORED_LEVEL_IDS,
  authoredLevelDocumentSchema,
  resolveAuthoredLevelDocument,
  validateAuthoredLevelDocument,
  type AuthoredAnchor,
  type AuthoredArena,
  type AuthoredConnection,
  type AuthoredEncounterAnchor,
  type AuthoredEncounterSlot,
  type AuthoredLevelDocument,
  type AuthoredLevelIssue,
  type AuthoredLevelPiece,
  type AuthoredLevelTheme,
  type AuthoredPosition,
  type ResolvedAuthoredLevel,
} from "./authored-level";
import type { EncounterKind, EncounterRole } from "./contracts";
import { validateEditorGameplayGuards } from "./editor-gameplay-guards";
import {
  levelEditorSectionIdPrefixSchema,
  levelEditorSectionPatternSchema,
  levelEditorSectionRiseSchema,
  levelEditorSectionSideSchema,
  levelEditorSectionStepsSchema,
  newAuthoredLevelIssues,
  planLevelEditorSection,
  type LevelEditorSectionPattern,
  type LevelEditorSectionSide,
} from "./editor-sections";
import {
  ALL_PARODY_CANDIDATES,
  PARODY_CATALOGS,
  PARODY_CATALOG_VERSION,
  PARODY_PERIODS,
  type ParodyCatalogEntry,
  type ParodyCatalogVersion,
  type ParodyPeriodId,
} from "./parody-catalog";

export const LEVEL_EDITOR_PROJECT_SCHEMA_VERSION =
  "level-editor-project-v1" as const;
export const LEVEL_EDITOR_PROJECT_SCHEMA_VERSION_V2 =
  "level-editor-project-v2" as const;
export const LEVEL_EDITOR_PROJECT_SCHEMA_VERSIONS = [
  LEVEL_EDITOR_PROJECT_SCHEMA_VERSION,
  LEVEL_EDITOR_PROJECT_SCHEMA_VERSION_V2,
] as const;
export const LEVEL_EDITOR_CATALOG_VERSIONS = [
  "parody-catalog-v5",
  "parody-catalog-v6",
] as const satisfies readonly ParodyCatalogVersion[];
export type LevelEditorCatalogVersion =
  (typeof LEVEL_EDITOR_CATALOG_VERSIONS)[number];
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
export const LEVEL_EDITOR_PROJECT_LIMITS = Object.freeze({
  minChapters: 1,
  maxChapters: 8,
  maxEnemyCandidates: 32,
  maxCandidateTextLength: 240,
} as const);

export type LevelEditorChapterId = string;
export type LevelEditorTemplateRouteId =
  (typeof LEVEL_EDITOR_TEMPLATE_ROUTE_IDS)[number];
export type LevelEditorLegacyLevelDocument = Omit<
  AuthoredLevelDocument,
  "schemaVersion" | "id"
> & {
  readonly schemaVersion: typeof AUTHORED_LEVEL_SCHEMA_VERSION_V2;
  readonly id: LevelEditorTemplateRouteId;
};
export type WorldEditorLevelDocument = Omit<
  AuthoredLevelDocument,
  "schemaVersion" | "id"
> & {
  readonly schemaVersion: typeof AUTHORED_LEVEL_SCHEMA_VERSION_V3;
  readonly id: string;
};
export type LevelEditorLevelDocument =
  | LevelEditorLegacyLevelDocument
  | WorldEditorLevelDocument;

export interface LevelEditorChapterV1<
  ChapterId extends (typeof LEVEL_EDITOR_CHAPTER_IDS)[number] = (typeof LEVEL_EDITOR_CHAPTER_IDS)[number],
  TemplateRouteId extends LevelEditorTemplateRouteId = LevelEditorTemplateRouteId,
> {
  readonly chapterId: ChapterId;
  readonly name: string;
  readonly templateRouteId: TemplateRouteId;
  readonly level: LevelEditorLegacyLevelDocument & { readonly id: TemplateRouteId };
}

export interface LevelEditorProjectV1 {
  readonly schemaVersion: typeof LEVEL_EDITOR_PROJECT_SCHEMA_VERSION;
  readonly projectId: string;
  readonly name: string;
  readonly revision: number;
  readonly chapters: readonly [
    LevelEditorChapterV1<"chapter-1", "garden-playground-v2">,
    LevelEditorChapterV1<"chapter-2", "besties-playground-v2">,
  ];
}

export interface LevelEditorRepresentedDateRange {
  readonly startDate: string;
  readonly endDate: string;
}

export interface LevelEditorRecoveredAge {
  readonly fromYears: number;
  readonly toYears: number;
}

export type LevelEditorPreviewMemorySlot =
  | "minor-one"
  | "minor-two"
  | "major";

export interface LevelEditorPreviewMemory {
  readonly slotId: LevelEditorPreviewMemorySlot;
  readonly date: string;
  readonly label: string;
}

export type LevelEditorEncounterReference =
  | {
      readonly source: "catalog";
      readonly catalogEntryId: string;
      readonly catalogEntryVersion: "v001";
    }
  | {
      readonly source: "candidate";
      readonly candidateId: string;
    };

export type LevelEditorEncounterSlots = Readonly<
  Record<AuthoredEncounterSlot, LevelEditorEncounterReference>
>;

export type LevelEditorEnemyBehaviorPreset = EncounterKind;

export interface LevelEditorEnemyCandidate {
  readonly id: string;
  readonly name: string;
  readonly periodId: ParodyPeriodId;
  readonly recognizableReference: string;
  readonly visualJoke: string;
  readonly obstacleOrAttack: string;
  readonly eligibility: LevelEditorRepresentedDateRange;
  readonly role: EncounterRole;
  readonly kind: EncounterKind;
  readonly behaviorPreset: LevelEditorEnemyBehaviorPreset;
}

export interface LevelEditorChapterV2 {
  readonly chapterId: LevelEditorChapterId;
  readonly routeId: string;
  readonly name: string;
  readonly subtitle: string;
  readonly description: string;
  readonly sourceTemplateId: LevelEditorTemplateRouteId;
  readonly level: WorldEditorLevelDocument;
  readonly representedDateRange: LevelEditorRepresentedDateRange;
  readonly recoveredAge: LevelEditorRecoveredAge;
  readonly previewMemories: readonly [
    LevelEditorPreviewMemory & { readonly slotId: "minor-one" },
    LevelEditorPreviewMemory & { readonly slotId: "minor-two" },
    LevelEditorPreviewMemory & { readonly slotId: "major" },
  ];
  readonly encounterSlots: LevelEditorEncounterSlots;
}

export interface LevelEditorProjectV2 {
  readonly schemaVersion: typeof LEVEL_EDITOR_PROJECT_SCHEMA_VERSION_V2;
  readonly projectId: string;
  readonly name: string;
  readonly revision: number;
  readonly fictionalBirthDate: string;
  readonly catalogVersion: LevelEditorCatalogVersion;
  readonly enemyCandidates: readonly LevelEditorEnemyCandidate[];
  readonly chapters: readonly LevelEditorChapterV2[];
}

export type LevelEditorChapter = LevelEditorChapterV1 | LevelEditorChapterV2;
export type LevelEditorProject = LevelEditorProjectV1 | LevelEditorProjectV2;

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
  readonly levels: Readonly<Record<string, ResolvedAuthoredLevel>>;
}

export interface CreateLevelEditorProjectOptions {
  readonly projectId: string;
  readonly name?: string;
  readonly chapterNames?: Readonly<
    Partial<Record<(typeof LEVEL_EDITOR_CHAPTER_IDS)[number], string>>
  >;
}

export interface CreateWorldEditorProjectOptions {
  readonly projectId: string;
  readonly name?: string;
  /** Defaults to the established v5 roster; callers opt into later catalogs explicitly. */
  readonly catalogVersion?: LevelEditorCatalogVersion;
  readonly chapterNames?: Readonly<
    Partial<Record<(typeof LEVEL_EDITOR_CHAPTER_IDS)[number], string>>
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
const ageYearsSchema = z.number().int().min(0).max(120);
const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    if (year === undefined || month === undefined || day === undefined) return false;
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return (
      parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month - 1 &&
      parsed.getUTCDate() === day
    );
  }, "Date must be a real calendar day");
const portableProseSchema = (maximum: number) =>
  z
    .string()
    .min(1)
    .max(maximum)
    .refine((value) => value.trim().length > 0, "Text cannot be blank")
    .refine(
      (value) => !/(?:https?:|data:|javascript:|file:|blob:)/iu.test(value),
      "Portable project text cannot contain a URL or executable URI",
    );
const periodIdSchema = z.enum(
  Object.keys(PARODY_PERIODS) as [ParodyPeriodId, ...ParodyPeriodId[]],
);
const encounterKindSchema = z.enum(["ordinary-a", "ordinary-b", "boss"]);
const encounterRoleSchema = z.enum(["ordinary", "boss"]);
const encounterSlotSchema = z.enum([
  "ordinary-1",
  "ordinary-2",
  "ordinary-3",
  "ordinary-4",
  "boss",
]);
// Reuse the published v2 schema's public Zod shape so command JSON Schema
// describes complete payloads without creating a second structural contract.
const authoredLevelV2Schema = authoredLevelDocumentSchema.options[1];
const authoredLevelV3Schema = authoredLevelDocumentSchema.options[2];
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

export const levelEditorProjectV1Schema = z
  .object({
    schemaVersion: z.literal(LEVEL_EDITOR_PROJECT_SCHEMA_VERSION),
    projectId: identifierSchema,
    name: displayNameSchema,
    revision: revisionSchema,
    chapters: z.tuple([chapterOneSchema, chapterTwoSchema]),
  })
  .strict();

export const levelEditorRepresentedDateRangeSchema = z
  .object({ startDate: dateOnlySchema, endDate: dateOnlySchema })
  .strict();

export const levelEditorRecoveredAgeSchema = z
  .object({ fromYears: ageYearsSchema, toYears: ageYearsSchema })
  .strict();

const previewMemorySchema = <Slot extends LevelEditorPreviewMemorySlot>(
  slotId: Slot,
) =>
  z
    .object({
      slotId: z.literal(slotId),
      date: dateOnlySchema,
      label: portableProseSchema(160),
    })
    .strict();

export const levelEditorEncounterReferenceSchema = z.discriminatedUnion(
  "source",
  [
    z
      .object({
        source: z.literal("catalog"),
        catalogEntryId: identifierSchema,
        catalogEntryVersion: z.literal("v001"),
      })
      .strict(),
    z
      .object({
        source: z.literal("candidate"),
        candidateId: identifierSchema,
      })
      .strict(),
  ],
);

export const levelEditorEncounterSlotsSchema = z
  .object({
    "ordinary-1": levelEditorEncounterReferenceSchema,
    "ordinary-2": levelEditorEncounterReferenceSchema,
    "ordinary-3": levelEditorEncounterReferenceSchema,
    "ordinary-4": levelEditorEncounterReferenceSchema,
    boss: levelEditorEncounterReferenceSchema,
  })
  .strict();

export const levelEditorEnemyCandidateSchema = z
  .object({
    id: identifierSchema,
    name: portableProseSchema(80),
    periodId: periodIdSchema,
    recognizableReference: portableProseSchema(
      LEVEL_EDITOR_PROJECT_LIMITS.maxCandidateTextLength,
    ),
    visualJoke: portableProseSchema(
      LEVEL_EDITOR_PROJECT_LIMITS.maxCandidateTextLength,
    ),
    obstacleOrAttack: portableProseSchema(
      LEVEL_EDITOR_PROJECT_LIMITS.maxCandidateTextLength,
    ),
    eligibility: levelEditorRepresentedDateRangeSchema,
    role: encounterRoleSchema,
    kind: encounterKindSchema,
    behaviorPreset: encounterKindSchema,
  })
  .strict();

export const levelEditorChapterV2Schema = z
  .object({
    chapterId: identifierSchema,
    routeId: identifierSchema,
    name: displayNameSchema,
    subtitle: portableProseSchema(100),
    description: portableProseSchema(240),
    sourceTemplateId: z.enum(LEVEL_EDITOR_TEMPLATE_ROUTE_IDS),
    level: authoredLevelV3Schema,
    representedDateRange: levelEditorRepresentedDateRangeSchema,
    recoveredAge: levelEditorRecoveredAgeSchema,
    previewMemories: z.tuple([
      previewMemorySchema("minor-one"),
      previewMemorySchema("minor-two"),
      previewMemorySchema("major"),
    ]),
    encounterSlots: levelEditorEncounterSlotsSchema,
  })
  .strict();

export const levelEditorProjectV2Schema = z
  .object({
    schemaVersion: z.literal(LEVEL_EDITOR_PROJECT_SCHEMA_VERSION_V2),
    projectId: identifierSchema,
    name: displayNameSchema,
    revision: revisionSchema,
    fictionalBirthDate: dateOnlySchema,
    catalogVersion: z.enum(LEVEL_EDITOR_CATALOG_VERSIONS),
    enemyCandidates: z
      .array(levelEditorEnemyCandidateSchema)
      .max(LEVEL_EDITOR_PROJECT_LIMITS.maxEnemyCandidates),
    chapters: z
      .array(levelEditorChapterV2Schema)
      .min(LEVEL_EDITOR_PROJECT_LIMITS.minChapters)
      .max(LEVEL_EDITOR_PROJECT_LIMITS.maxChapters),
  })
  .strict();

export const levelEditorProjectSchema = z.discriminatedUnion("schemaVersion", [
  levelEditorProjectV1Schema,
  levelEditorProjectV2Schema,
]);

const LEVEL_EDITOR_READY_IDENTITIES = new Set([
  "mister-hiss@v001:mister-hiss@v001",
  "peel-patrol@v001:peel-patrol@v001",
  "drama-dragon@v001:drama-dragon@v001",
  "sir-flush-a-lot-encore@v001:sir-flush-a-lot@v001",
  "peel-patrol-encore@v001:peel-patrol@v001",
  "drama-dragon-encore@v001:drama-dragon@v001",
  "sir-flush-a-lot-besties@v001:sir-flush-a-lot@v001",
  "peel-patrol-besties@v001:peel-patrol@v001",
  "bickering-besties@v001:bickering-besties@v001",
  "chick-flia@v001:chick-flia@v001",
  "jackrabbit-drummer@v001:jackrabbit-drummer@v001",
  "fox-card-shark@v001:fox-card-shark@v001",
  "moth-projectionist@v001:moth-projectionist@v001",
  "rat-pit-boss@v001:rat-pit-boss@v002",
]);

/**
 * Exact reviewed identities prepared for private gameplay. Paused entries and
 * reserved cameos stay catalog-addressable but cannot fill an editor combat slot.
 */
export function levelEditorPreparedEnemies(
  catalogVersion: LevelEditorCatalogVersion,
): readonly ParodyCatalogEntry[] {
  return Object.freeze(
    PARODY_CATALOGS[catalogVersion].filter((entry) =>
      LEVEL_EDITOR_READY_IDENTITIES.has(
        `${entry.id}@${entry.version}:${entry.assetId}@${entry.assetVersion}`,
      ),
    ),
  );
}

/** Prepared roster for the default v5 project; pinned projects use the function above. */
export const LEVEL_EDITOR_PREPARED_ENEMIES = levelEditorPreparedEnemies(
  PARODY_CATALOG_VERSION,
);

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

export function isLevelEditorProjectV2(
  project: LevelEditorProject,
): project is LevelEditorProjectV2 {
  return project.schemaVersion === LEVEL_EDITOR_PROJECT_SCHEMA_VERSION_V2;
}

export function parseLevelEditorProject(
  input: LevelEditorProjectV1,
): LevelEditorProjectV1;
export function parseLevelEditorProject(
  input: LevelEditorProjectV2,
): LevelEditorProjectV2;
export function parseLevelEditorProject(input: unknown): LevelEditorProject;
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

/** Every published gameplay check one chapter document has to answer. */
function levelIssues(
  level: AuthoredLevelDocument,
  hostsBestiesRoutine?: boolean,
): readonly AuthoredLevelIssue[] {
  return [
    ...validateAuthoredLevelDocument(level),
    ...validateEditorGameplayGuards(level, {
      ...(hostsBestiesRoutine === undefined ? {} : { hostsBestiesRoutine }),
    }),
  ];
}

function wholeYearsAt(birthDate: string, eventDate: string): number {
  const [birthYear, birthMonth, birthDay] = birthDate.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const [eventYear, eventMonth, eventDay] = eventDate.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const beforeBirthday =
    eventMonth < birthMonth ||
    (eventMonth === birthMonth && eventDay < birthDay);
  return eventYear - birthYear - (beforeBirthday ? 1 : 0);
}

function expectedRole(kind: EncounterKind): EncounterRole {
  return kind === "boss" ? "boss" : "ordinary";
}

interface EditorEncounterIdentity {
  readonly id: string;
  readonly periodId: ParodyPeriodId;
  readonly eligibleFrom: string;
  readonly eligibleThrough: string;
  readonly referenceAvailableBy?: string;
  readonly role: EncounterRole;
  readonly kind: EncounterKind;
  readonly assetId?: string;
}

function encounterIdentity(
  reference: LevelEditorEncounterReference,
  candidates: ReadonlyMap<string, LevelEditorEnemyCandidate>,
  catalogVersion: LevelEditorCatalogVersion,
): EditorEncounterIdentity | undefined {
  if (reference.source === "catalog") {
    const entry = levelEditorPreparedEnemies(catalogVersion).find(
      (candidate) =>
        candidate.id === reference.catalogEntryId &&
        candidate.version === reference.catalogEntryVersion,
    );
    return entry
      ? {
          id: entry.id,
          periodId: entry.periodId,
          eligibleFrom: entry.eligibleFrom,
          eligibleThrough: entry.eligibleThrough,
          referenceAvailableBy: entry.referenceAvailableBy,
          role: entry.role,
          kind: entry.kind,
          assetId: entry.assetId,
        }
      : undefined;
  }
  const candidate = candidates.get(reference.candidateId);
  return candidate
    ? {
        id: candidate.id,
        periodId: candidate.periodId,
        eligibleFrom: candidate.eligibility.startDate,
        eligibleThrough: candidate.eligibility.endDate,
        role: candidate.role,
        kind: candidate.kind,
      }
    : undefined;
}

function validateWorldProject(
  project: LevelEditorProjectV2,
  issues: LevelEditorIssue[],
): void {
  const candidateIds = new Map<string, number>();
  const preparedIds = new Set(
    ALL_PARODY_CANDIDATES.map((entry) => entry.id),
  );
  project.enemyCandidates.forEach((candidate, index) => {
    const prefix = `$.enemyCandidates[${index}]`;
    const previous = candidateIds.get(candidate.id);
    if (previous !== undefined)
      issues.push(
        issue(
          "semantic",
          `${prefix}.id`,
          "candidate.duplicate-id",
          `Candidate id ${JSON.stringify(candidate.id)} duplicates $.enemyCandidates[${previous}].id`,
        ),
      );
    else candidateIds.set(candidate.id, index);
    if (preparedIds.has(candidate.id))
      issues.push(
        issue(
          "semantic",
          `${prefix}.id`,
          "candidate.catalog-id",
          `Candidate id ${JSON.stringify(candidate.id)} is already used by the prepared catalog`,
        ),
      );
    if (candidate.eligibility.startDate > candidate.eligibility.endDate)
      issues.push(
        issue(
          "semantic",
          `${prefix}.eligibility.endDate`,
          "date.order",
          "Candidate eligibility must end on or after it starts",
        ),
      );
    if (candidate.role !== expectedRole(candidate.kind))
      issues.push(
        issue(
          "semantic",
          `${prefix}.role`,
          "candidate.role-kind",
          `Role ${candidate.role} is incompatible with kind ${candidate.kind}`,
        ),
      );
    if (candidate.behaviorPreset !== candidate.kind)
      issues.push(
        issue(
          "semantic",
          `${prefix}.behaviorPreset`,
          "candidate.behavior-kind",
          `Behavior preset ${candidate.behaviorPreset} must match kind ${candidate.kind}`,
        ),
      );
  });

  const candidates = new Map(
    project.enemyCandidates.map((candidate) => [candidate.id, candidate]),
  );
  const chapterIds = new Map<string, number>();
  const routeIds = new Map<string, number>();
  const publishedRouteIds = new Set<string>(AUTHORED_LEVEL_IDS);
  let previousChapter: LevelEditorChapterV2 | undefined;

  project.chapters.forEach((chapter, index) => {
    const prefix = `$.chapters[${index}]`;
    const priorChapter = chapterIds.get(chapter.chapterId);
    if (priorChapter !== undefined)
      issues.push(
        issue(
          "semantic",
          `${prefix}.chapterId`,
          "chapter.duplicate-id",
          `Chapter id ${JSON.stringify(chapter.chapterId)} duplicates $.chapters[${priorChapter}].chapterId`,
        ),
      );
    else chapterIds.set(chapter.chapterId, index);
    const priorRoute = routeIds.get(chapter.routeId);
    if (priorRoute !== undefined)
      issues.push(
        issue(
          "semantic",
          `${prefix}.routeId`,
          "route.duplicate-id",
          `Route id ${JSON.stringify(chapter.routeId)} duplicates $.chapters[${priorRoute}].routeId`,
        ),
      );
    else routeIds.set(chapter.routeId, index);
    if (publishedRouteIds.has(chapter.routeId))
      issues.push(
        issue(
          "semantic",
          `${prefix}.routeId`,
          "route.published-id",
          "A project-local route id cannot reuse an immutable published route id",
        ),
      );
    if (chapter.level.id !== chapter.routeId)
      issues.push(
        issue(
          "semantic",
          `${prefix}.level.id`,
          "route.level-id",
          "The authored level id must equal its chapter route id",
        ),
      );

    const { startDate, endDate } = chapter.representedDateRange;
    const [minorOne, minorTwo, major] = chapter.previewMemories;
    if (startDate > endDate)
      issues.push(
        issue(
          "semantic",
          `${prefix}.representedDateRange.endDate`,
          "date.order",
          "The represented date range must end on or after it starts",
        ),
      );
    const orderedDates = [startDate, minorOne.date, minorTwo.date, major.date, endDate];
    for (let dateIndex = 1; dateIndex < orderedDates.length; dateIndex += 1) {
      if (orderedDates[dateIndex]! < orderedDates[dateIndex - 1]!)
        issues.push(
          issue(
            "semantic",
            dateIndex === 4
              ? `${prefix}.representedDateRange.endDate`
              : `${prefix}.previewMemories[${dateIndex - 1}].date`,
            "memory.date-order",
            "Fictional preview memories must be chronological and stay inside the represented date range",
          ),
        );
    }
    if (major.date !== endDate)
      issues.push(
        issue(
          "semantic",
          `${prefix}.previewMemories[2].date`,
          "memory.major-end-date",
          "The major memory date must close the represented date range",
        ),
      );
    if (index === 0 && startDate !== project.fictionalBirthDate)
      issues.push(
        issue(
          "semantic",
          `${prefix}.representedDateRange.startDate`,
          "date.birth-start",
          "The first represented date range must start on the fictional birth date",
        ),
      );
    if (chapter.recoveredAge.fromYears >= chapter.recoveredAge.toYears)
      issues.push(
        issue(
          "semantic",
          `${prefix}.recoveredAge.toYears`,
          "age.advance",
          "The major memory must advance recovered age",
        ),
      );
    if (
      chapter.recoveredAge.fromYears !==
      wholeYearsAt(project.fictionalBirthDate, startDate)
    )
      issues.push(
        issue(
          "semantic",
          `${prefix}.recoveredAge.fromYears`,
          "age.start-date",
          "Recovered starting age must match the fictional birth and represented start dates",
        ),
      );
    if (
      chapter.recoveredAge.toYears !==
      wholeYearsAt(project.fictionalBirthDate, major.date)
    )
      issues.push(
        issue(
          "semantic",
          `${prefix}.recoveredAge.toYears`,
          "age.major-date",
          "Recovered target age must match the fictional birth and major memory dates",
        ),
      );
    if (previousChapter) {
      if (startDate !== previousChapter.representedDateRange.endDate)
        issues.push(
          issue(
            "semantic",
            `${prefix}.representedDateRange.startDate`,
            "date.chapter-continuity",
            "A chapter must start on the preceding chapter's end date",
          ),
        );
      if (chapter.recoveredAge.fromYears !== previousChapter.recoveredAge.toYears)
        issues.push(
          issue(
            "semantic",
            `${prefix}.recoveredAge.fromYears`,
            "age.chapter-continuity",
            "A chapter must start at the preceding chapter's recovered age",
          ),
        );
    }

    let periodId: ParodyPeriodId | undefined;
    for (const slot of [
      "ordinary-1",
      "ordinary-2",
      "ordinary-3",
      "ordinary-4",
      "boss",
    ] as const) {
      const reference = chapter.encounterSlots[slot];
      const identity = encounterIdentity(
        reference,
        candidates,
        project.catalogVersion,
      );
      const slotPath = `${prefix}.encounterSlots[${JSON.stringify(slot)}]`;
      if (!identity) {
        issues.push(
          issue(
            "semantic",
            slotPath,
            reference.source === "catalog"
              ? "encounter.catalog-missing"
              : "encounter.candidate-missing",
            reference.source === "catalog"
              ? `Prepared catalog entry ${JSON.stringify(reference.catalogEntryId)} ${reference.catalogEntryVersion} is unavailable in ${project.catalogVersion}`
              : `Project candidate ${JSON.stringify(reference.candidateId)} does not exist`,
          ),
        );
        continue;
      }
      const anchor = chapter.level.anchors.encounters[slot];
      if (identity.role !== expectedRole(anchor.kind))
        issues.push(
          issue(
            "semantic",
            slotPath,
            "encounter.role",
            `Encounter ${JSON.stringify(identity.id)} has role ${identity.role}; slot ${slot} requires ${expectedRole(anchor.kind)}`,
          ),
        );
      if (identity.kind !== anchor.kind)
        issues.push(
          issue(
            "semantic",
            slotPath,
            "encounter.kind",
            `Encounter ${JSON.stringify(identity.id)} has kind ${identity.kind}; slot ${slot} requires ${anchor.kind}`,
          ),
        );
      // Match the frozen adventure selector: encounter relevance is chosen at
      // the chapter's represented start. The major memory may close the range
      // after that catalog window without rewriting the chosen identity.
      if (
        startDate < identity.eligibleFrom ||
        startDate > identity.eligibleThrough ||
        (identity.referenceAvailableBy !== undefined &&
          startDate < identity.referenceAvailableBy)
      )
        issues.push(
          issue(
            "semantic",
            slotPath,
            "encounter.date-eligibility",
            `Encounter ${JSON.stringify(identity.id)} is not eligible on ${startDate}`,
          ),
        );
      if (periodId === undefined) periodId = identity.periodId;
      else if (identity.periodId !== periodId)
        issues.push(
          issue(
            "semantic",
            slotPath,
            "encounter.period",
            `Encounter ${JSON.stringify(identity.id)} belongs to ${identity.periodId}; this chapter uses ${periodId}`,
          ),
        );
    }
    if (periodId === "rat-casino-v1" && startDate < "2014-08-18")
      issues.push(
        issue(
          "semantic",
          `${prefix}.representedDateRange.startDate`,
          "period.date-eligibility",
          "The Rat Casino cast requires a represented start date on or after 2014-08-18",
        ),
      );

    previousChapter = chapter;
  });
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
    const hostsBestiesRoutine =
      isLevelEditorProjectV2(project) && "encounterSlots" in chapter
      ? (() => {
          const boss = chapter.encounterSlots.boss;
          return (
            boss.source === "catalog" &&
            levelEditorPreparedEnemies(project.catalogVersion).some(
              (entry) =>
                entry.id === boss.catalogEntryId &&
                entry.version === boss.catalogEntryVersion &&
                entry.assetId === "bickering-besties",
            )
          );
        })()
      : undefined;
    for (const entry of levelIssues(chapter.level, hostsBestiesRoutine))
      issues.push(
        issue(
          "semantic",
          prefixedAuthoredPath(prefix, entry.path),
          entry.code,
          entry.message,
        ),
      );
  });
  if (isLevelEditorProjectV2(project)) validateWorldProject(project, issues);
  return freezeIssues(issues);
}

export function resolveLevelEditorProject(
  input: unknown,
): ResolvedLevelEditorProject {
  const project = parseLevelEditorProject(input);
  const issues = validateLevelEditorProject(project);
  if (issues.length > 0) throw new LevelEditorProjectValidationError(issues);
  const levels = Object.freeze(
    Object.fromEntries(
      project.chapters.map((chapter) => [
        isLevelEditorProjectV2(project)
          ? (chapter as LevelEditorChapterV2).routeId
          : (chapter as LevelEditorChapterV1).templateRouteId,
        resolveAuthoredLevelDocument(chapter.level),
      ]),
    ),
  );
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
): LevelEditorProjectV1 {
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
  }) as LevelEditorProjectV1;
}

const DEFAULT_WORLD_CHAPTERS = Object.freeze({
  "chapter-1": {
    routeId: "chapter-1-route",
    sourceTemplateId: "garden-playground-v2",
    name: "The Block Party",
    subtitle: "A playful course with memories, gear and a final showdown",
    description:
      "Collect both tools and two memories, clear the encounters, then recover the major memory after the boss.",
    representedDateRange: {
      startDate: "2020-01-01",
      endDate: "2024-01-01",
    },
    recoveredAge: { fromYears: 0, toYears: 4 },
    previewMemories: [
      { slotId: "minor-one", date: "2020-07-01", label: "The first glow" },
      { slotId: "minor-two", date: "2022-01-01", label: "A small discovery" },
      { slotId: "major", date: "2024-01-01", label: "A taller path" },
    ],
    encounterSlots: {
      "ordinary-1": {
        source: "catalog",
        catalogEntryId: "mister-hiss",
        catalogEntryVersion: "v001",
      },
      "ordinary-2": {
        source: "catalog",
        catalogEntryId: "peel-patrol",
        catalogEntryVersion: "v001",
      },
      "ordinary-3": {
        source: "catalog",
        catalogEntryId: "mister-hiss",
        catalogEntryVersion: "v001",
      },
      "ordinary-4": {
        source: "catalog",
        catalogEntryId: "peel-patrol",
        catalogEntryVersion: "v001",
      },
      boss: {
        source: "catalog",
        catalogEntryId: "drama-dragon",
        catalogEntryVersion: "v001",
      },
    },
  },
  "chapter-2": {
    routeId: "chapter-2-route",
    sourceTemplateId: "besties-playground-v2",
    name: "Besties Obby",
    subtitle: "A forgiving obby with memories, rivals and a boss arena",
    description:
      "Cross the course, collect both tools and two memories, then win the boss encounter and recover the major memory.",
    representedDateRange: {
      startDate: "2024-01-01",
      endDate: "2027-01-01",
    },
    recoveredAge: { fromYears: 4, toYears: 7 },
    previewMemories: [
      { slotId: "minor-one", date: "2025-01-01", label: "A bright detour" },
      { slotId: "minor-two", date: "2026-01-01", label: "A brave crossing" },
      { slotId: "major", date: "2027-01-01", label: "The lantern gate" },
    ],
    encounterSlots: {
      "ordinary-1": {
        source: "catalog",
        catalogEntryId: "sir-flush-a-lot-besties",
        catalogEntryVersion: "v001",
      },
      "ordinary-2": {
        source: "catalog",
        catalogEntryId: "peel-patrol-besties",
        catalogEntryVersion: "v001",
      },
      "ordinary-3": {
        source: "catalog",
        catalogEntryId: "sir-flush-a-lot-besties",
        catalogEntryVersion: "v001",
      },
      "ordinary-4": {
        source: "catalog",
        catalogEntryId: "peel-patrol-besties",
        catalogEntryVersion: "v001",
      },
      boss: {
        source: "catalog",
        catalogEntryId: "bickering-besties",
        catalogEntryVersion: "v001",
      },
    },
  },
} as const);

function worldLevelFromTemplate(
  templateId: LevelEditorTemplateRouteId,
  routeId: string,
): WorldEditorLevelDocument {
  const template = templateId === "garden-playground-v2"
    ? gardenTemplate
    : bestiesTemplate;
  return {
    ...cloneJson(template),
    schemaVersion: AUTHORED_LEVEL_SCHEMA_VERSION_V3,
    id: routeId,
  } as WorldEditorLevelDocument;
}

function defaultWorldChapter(
  chapterId: (typeof LEVEL_EDITOR_CHAPTER_IDS)[number],
  name?: string,
): LevelEditorChapterV2 {
  const definition = DEFAULT_WORLD_CHAPTERS[chapterId];
  return {
    chapterId,
    routeId: definition.routeId,
    name: name ?? definition.name,
    subtitle: definition.subtitle,
    description: definition.description,
    sourceTemplateId: definition.sourceTemplateId,
    level: worldLevelFromTemplate(
      definition.sourceTemplateId,
      definition.routeId,
    ),
    representedDateRange: cloneJson(definition.representedDateRange),
    recoveredAge: cloneJson(definition.recoveredAge),
    previewMemories: cloneJson(definition.previewMemories),
    encounterSlots: cloneJson(definition.encounterSlots),
  };
}

export function createWorldEditorProject(
  options: CreateWorldEditorProjectOptions,
): LevelEditorProjectV2 {
  return parseLevelEditorProject({
    schemaVersion: LEVEL_EDITOR_PROJECT_SCHEMA_VERSION_V2,
    projectId: options.projectId,
    name: options.name ?? "Untitled adventure",
    revision: 0,
    fictionalBirthDate: "2020-01-01",
    catalogVersion: options.catalogVersion ?? PARODY_CATALOG_VERSION,
    enemyCandidates: [],
    chapters: [
      defaultWorldChapter("chapter-1", options.chapterNames?.["chapter-1"]),
      defaultWorldChapter("chapter-2", options.chapterNames?.["chapter-2"]),
    ],
  });
}

export function migrateLevelEditorProjectV1(
  input: LevelEditorProjectV1,
): LevelEditorProjectV2 {
  const project = parseLevelEditorProject(input);
  const defaults = createWorldEditorProject({
    projectId: project.projectId,
    name: project.name,
    chapterNames: {
      "chapter-1": project.chapters[0].name,
      "chapter-2": project.chapters[1].name,
    },
  });
  return parseLevelEditorProject({
    ...defaults,
    revision: project.revision,
    chapters: defaults.chapters.map((chapter, index) => ({
      ...chapter,
      level: {
        ...cloneJson(project.chapters[index]!.level),
        schemaVersion: AUTHORED_LEVEL_SCHEMA_VERSION_V3,
        id: chapter.routeId,
      },
    })),
  });
}

export function migrateLevelEditorProjectToV2(
  input: unknown,
): LevelEditorProjectV2 {
  const project = parseLevelEditorProject(input);
  return isLevelEditorProjectV2(project)
    ? project
    : migrateLevelEditorProjectV1(project);
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
  | {
      readonly type: "project.birthdate.set";
      readonly fictionalBirthDate: string;
    }
  | {
      readonly type: "chapter.add";
      readonly newChapterId: string;
      readonly newRouteId: string;
      readonly sourceTemplateId: LevelEditorTemplateRouteId;
      readonly name?: string;
      readonly subtitle?: string;
      readonly description?: string;
      readonly index?: number;
    }
  | ({
      readonly type: "chapter.duplicate";
      readonly newChapterId: string;
      readonly newRouteId: string;
      readonly name?: string;
      readonly index?: number;
    } & ChapterCommand)
  | ({ readonly type: "chapter.remove" } & ChapterCommand)
  | ({ readonly type: "chapter.reorder"; readonly index: number } & ChapterCommand)
  | ({ readonly type: "chapter.rename"; readonly name: string } & ChapterCommand)
  | ({
      readonly type: "chapter.details.set";
      readonly subtitle: string;
      readonly description: string;
      readonly theme: AuthoredLevelTheme;
      readonly representedDateRange: LevelEditorRepresentedDateRange;
      readonly recoveredAge: LevelEditorRecoveredAge;
      readonly previewMemories: LevelEditorChapterV2["previewMemories"];
    } & ChapterCommand)
  | ({
      readonly type: "encounter.assign";
      readonly slot: AuthoredEncounterSlot;
      readonly encounter: LevelEditorEncounterReference;
    } & ChapterCommand)
  | ({
      readonly type: "enemy.add";
      readonly slot: AuthoredEncounterSlot;
      readonly candidate: LevelEditorEnemyCandidate;
    } & ChapterCommand)
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
  | ({ readonly type: "branch.remove"; readonly index: number } & ChapterCommand)
  | ({
      readonly type: "section.add";
      readonly idPrefix: string;
      readonly fromPlatformId: string;
      readonly toPlatformId: string;
      readonly pattern: LevelEditorSectionPattern;
      readonly side: LevelEditorSectionSide;
      readonly steps?: number;
      readonly rise?: number;
    } & ChapterCommand);

const chapterIdField = { chapterId: identifierSchema } as const;
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
      type: z.literal("project.birthdate.set"),
      fictionalBirthDate: dateOnlySchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("chapter.add"),
      newChapterId: identifierSchema,
      newRouteId: identifierSchema,
      sourceTemplateId: z.enum(LEVEL_EDITOR_TEMPLATE_ROUTE_IDS),
      name: displayNameSchema.optional(),
      subtitle: portableProseSchema(100).optional(),
      description: portableProseSchema(240).optional(),
      index: z.number().int().nonnegative().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("chapter.duplicate"),
      ...chapterIdField,
      newChapterId: identifierSchema,
      newRouteId: identifierSchema,
      name: displayNameSchema.optional(),
      index: z.number().int().nonnegative().optional(),
    })
    .strict(),
  z
    .object({ type: z.literal("chapter.remove"), ...chapterIdField })
    .strict(),
  z
    .object({
      type: z.literal("chapter.reorder"),
      ...chapterIdField,
      index: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      type: z.literal("chapter.rename"),
      ...chapterIdField,
      name: displayNameSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("chapter.details.set"),
      ...chapterIdField,
      subtitle: portableProseSchema(100),
      description: portableProseSchema(240),
      theme: z.enum(["garden", "party", "arcade", "toybox", "casino"]),
      representedDateRange: levelEditorRepresentedDateRangeSchema,
      recoveredAge: levelEditorRecoveredAgeSchema,
      previewMemories: z.tuple([
        previewMemorySchema("minor-one"),
        previewMemorySchema("minor-two"),
        previewMemorySchema("major"),
      ]),
    })
    .strict(),
  z
    .object({
      type: z.literal("encounter.assign"),
      ...chapterIdField,
      slot: encounterSlotSchema,
      encounter: levelEditorEncounterReferenceSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("enemy.add"),
      ...chapterIdField,
      slot: encounterSlotSchema,
      candidate: levelEditorEnemyCandidateSchema,
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
  z
    .object({
      type: z.literal("section.add"),
      ...chapterIdField,
      idPrefix: levelEditorSectionIdPrefixSchema,
      fromPlatformId: identifierSchema,
      toPlatformId: identifierSchema,
      pattern: levelEditorSectionPatternSchema,
      side: levelEditorSectionSideSchema,
      steps: levelEditorSectionStepsSchema.optional(),
      rise: levelEditorSectionRiseSchema.optional(),
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
type MutableWorldProject = DeepMutable<LevelEditorProjectV2>;
type MutableWorldChapter = DeepMutable<LevelEditorChapterV2>;
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

/**
 * A command that fails for several independent reasons at once, such as a
 * section whose lane collides with more than one platform. The batch rolls back
 * exactly as it does for a single failure; only the reporting differs.
 */
class CommandIssuesError extends Error {
  readonly issues: readonly AuthoredLevelIssue[];

  constructor(issues: readonly AuthoredLevelIssue[]) {
    super(issues.map((entry) => entry.message).join(" "));
    this.name = "CommandIssuesError";
    this.issues = issues;
  }
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

function worldProjectForCommand(project: MutableProject): MutableWorldProject {
  if (project.schemaVersion !== LEVEL_EDITOR_PROJECT_SCHEMA_VERSION_V2)
    commandError(
      "$",
      "project.version",
      "This command requires a level-editor-project-v2 project",
    );
  return project as MutableWorldProject;
}

function worldChapterForCommand(chapter: MutableChapter): MutableWorldChapter {
  if (!("routeId" in chapter))
    commandError(
      "$.chapterId",
      "project.version",
      "This command requires a level-editor-project-v2 chapter",
    );
  return chapter as MutableWorldChapter;
}

function rejectReservedRouteId(routeId: string, path: string): void {
  if ((AUTHORED_LEVEL_IDS as readonly string[]).includes(routeId))
    commandError(
      path,
      "route.published-id",
      "A project-local route id cannot reuse an immutable published route id",
    );
}

function ensureNewWorldIdentity(
  project: MutableWorldProject,
  chapterId: string,
  routeId: string,
): void {
  if (project.chapters.some((chapter) => chapter.chapterId === chapterId))
    commandError(
      "$.newChapterId",
      "chapter.duplicate-id",
      `Chapter ${chapterId} already exists`,
    );
  if (project.chapters.some((chapter) => chapter.routeId === routeId))
    commandError(
      "$.newRouteId",
      "route.duplicate-id",
      `Route ${routeId} already exists`,
    );
  rejectReservedRouteId(routeId, "$.newRouteId");
}

function insertWorldChapter(
  project: MutableWorldProject,
  chapter: LevelEditorChapterV2,
  index: number | undefined,
): void {
  if (project.chapters.length >= LEVEL_EDITOR_PROJECT_LIMITS.maxChapters)
    commandError(
      "$.newChapterId",
      "chapter.limit",
      `A project can contain at most ${LEVEL_EDITOR_PROJECT_LIMITS.maxChapters} chapters`,
    );
  const insertionIndex = index ?? project.chapters.length;
  if (insertionIndex > project.chapters.length)
    commandError(
      "$.index",
      "chapter.index",
      "Chapter insertion index is outside the chapter list",
    );
  project.chapters.splice(
    insertionIndex,
    0,
    cloneJson(chapter) as unknown as DeepMutable<LevelEditorChapterV2>,
  );
}

function seededWorldChapter(
  command: Extract<LevelEditorCommand, { readonly type: "chapter.add" }>,
  project: MutableWorldProject,
  insertionIndex: number,
): LevelEditorChapterV2 {
  const seedId = command.sourceTemplateId === "garden-playground-v2"
    ? "chapter-1"
    : "chapter-2";
  const seed = defaultWorldChapter(seedId);
  const previous = insertionIndex > 0
    ? project.chapters[insertionIndex - 1]
    : undefined;
  const startDate = previous?.representedDateRange.endDate ??
    project.fictionalBirthDate;
  const minorOneDate = offsetCalendarMonths(startDate, 4);
  const minorTwoDate = offsetCalendarMonths(startDate, 8);
  const endDate = offsetCalendarMonths(startDate, 12);
  return {
    ...seed,
    chapterId: command.newChapterId,
    routeId: command.newRouteId,
    name: command.name ?? "New level",
    subtitle: command.subtitle ?? "A new authored world ready to shape",
    description:
      command.description ??
      "Collect the tools and memories, clear the encounters, defeat the boss and recover the major memory.",
    sourceTemplateId: command.sourceTemplateId,
    level: worldLevelFromTemplate(command.sourceTemplateId, command.newRouteId),
    representedDateRange: { startDate, endDate },
    recoveredAge: {
      fromYears: wholeYearsAt(project.fictionalBirthDate, startDate),
      toYears: wholeYearsAt(project.fictionalBirthDate, endDate),
    },
    previewMemories: [
      { slotId: "minor-one", date: minorOneDate, label: "A first discovery" },
      { slotId: "minor-two", date: minorTwoDate, label: "A bright detour" },
      { slotId: "major", date: endDate, label: "The world finale" },
    ],
  };
}

function offsetCalendarMonths(date: string, months: number): string {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  const first = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
  ).getUTCDate();
  first.setUTCDate(Math.min(day, lastDay));
  return first.toISOString().slice(0, 10);
}

function candidateMapFor(
  project: MutableWorldProject,
): ReadonlyMap<string, LevelEditorEnemyCandidate> {
  return new Map(
    project.enemyCandidates.map((candidate) => [
      candidate.id,
      candidate as LevelEditorEnemyCandidate,
    ]),
  );
}

function assertEncounterFitsSlot(
  project: MutableWorldProject,
  chapter: MutableWorldChapter,
  slot: AuthoredEncounterSlot,
  reference: LevelEditorEncounterReference,
  path: string,
): void {
  const identity = encounterIdentity(
    reference,
    candidateMapFor(project),
    project.catalogVersion,
  );
  if (!identity)
    commandError(
      path,
      reference.source === "catalog"
        ? "encounter.catalog-missing"
        : "encounter.candidate-missing",
      reference.source === "catalog"
        ? `Prepared catalog entry ${reference.catalogEntryId} is unavailable`
        : `Project candidate ${reference.candidateId} does not exist`,
    );
  const expectedKind = chapter.level.anchors.encounters[slot].kind;
  if (identity.kind !== expectedKind || identity.role !== expectedRole(expectedKind))
    commandError(
      path,
      "encounter.slot",
      `Encounter ${identity.id} (${identity.role}/${identity.kind}) cannot fill ${slot} (${expectedRole(expectedKind)}/${expectedKind})`,
    );
}

function chapterHostsBestiesRoutine(
  project: MutableWorldProject,
  chapter: MutableWorldChapter,
): boolean {
  const boss = chapter.encounterSlots.boss;
  return (
    boss.source === "catalog" &&
    levelEditorPreparedEnemies(project.catalogVersion).some(
      (entry) =>
        entry.id === boss.catalogEntryId &&
        entry.version === boss.catalogEntryVersion &&
        entry.assetId === "bickering-besties",
    )
  );
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
  if (command.type === "project.birthdate.set") {
    worldProjectForCommand(project).fictionalBirthDate =
      command.fictionalBirthDate;
    return;
  }
  if (command.type === "chapter.add") {
    const world = worldProjectForCommand(project);
    ensureNewWorldIdentity(world, command.newChapterId, command.newRouteId);
    const insertionIndex = command.index ?? world.chapters.length;
    insertWorldChapter(
      world,
      seededWorldChapter(command, world, insertionIndex),
      insertionIndex,
    );
    return;
  }

  const chapter = chapterFor(project, command.chapterId);
  if (command.type === "chapter.duplicate") {
    const world = worldProjectForCommand(project);
    const source = worldChapterForCommand(chapter);
    ensureNewWorldIdentity(world, command.newChapterId, command.newRouteId);
    const sourceIndex = world.chapters.findIndex(
      (entry) => entry.chapterId === source.chapterId,
    );
    const duplicate = cloneJson(source) as unknown as LevelEditorChapterV2;
    insertWorldChapter(
      world,
      {
        ...duplicate,
        chapterId: command.newChapterId,
        routeId: command.newRouteId,
        name: command.name ?? `${source.name} copy`,
        level: { ...duplicate.level, id: command.newRouteId },
      },
      command.index ?? sourceIndex + 1,
    );
    return;
  }
  if (command.type === "chapter.remove") {
    const world = worldProjectForCommand(project);
    if (world.chapters.length <= LEVEL_EDITOR_PROJECT_LIMITS.minChapters)
      commandError(
        "$.chapterId",
        "chapter.minimum",
        "A project must retain at least one chapter",
      );
    const index = world.chapters.findIndex(
      (entry) => entry.chapterId === command.chapterId,
    );
    world.chapters.splice(index, 1);
    return;
  }
  if (command.type === "chapter.reorder") {
    const world = worldProjectForCommand(project);
    if (command.index >= world.chapters.length)
      commandError(
        "$.index",
        "chapter.index",
        "Chapter destination index is outside the chapter list",
      );
    const sourceIndex = world.chapters.findIndex(
      (entry) => entry.chapterId === command.chapterId,
    );
    const [moved] = world.chapters.splice(sourceIndex, 1);
    world.chapters.splice(command.index, 0, moved!);
    return;
  }
  const level = chapter.level;
  switch (command.type) {
    case "chapter.rename":
      chapter.name = command.name;
      return;
    case "chapter.details.set": {
      const worldChapter = worldChapterForCommand(chapter);
      worldChapter.subtitle = command.subtitle;
      worldChapter.description = command.description;
      worldChapter.level.theme = command.theme;
      worldChapter.representedDateRange = cloneJson(
        command.representedDateRange,
      );
      worldChapter.recoveredAge = cloneJson(command.recoveredAge);
      worldChapter.previewMemories = cloneJson(
        command.previewMemories,
      ) as unknown as MutableWorldChapter["previewMemories"];
      return;
    }
    case "encounter.assign": {
      const world = worldProjectForCommand(project);
      const worldChapter = worldChapterForCommand(chapter);
      assertEncounterFitsSlot(
        world,
        worldChapter,
        command.slot,
        command.encounter,
        "$.encounter",
      );
      worldChapter.encounterSlots[command.slot] = cloneJson(command.encounter);
      return;
    }
    case "enemy.add": {
      const world = worldProjectForCommand(project);
      const worldChapter = worldChapterForCommand(chapter);
      if (
        world.enemyCandidates.some((entry) => entry.id === command.candidate.id) ||
        ALL_PARODY_CANDIDATES.some(
          (entry) => entry.id === command.candidate.id,
        )
      )
        commandError(
          "$.candidate.id",
          "candidate.duplicate-id",
          `Enemy identity ${command.candidate.id} already exists`,
        );
      const expectedKind = worldChapter.level.anchors.encounters[command.slot].kind;
      if (
        command.candidate.kind !== expectedKind ||
        command.candidate.role !== expectedRole(expectedKind) ||
        command.candidate.behaviorPreset !== expectedKind
      )
        commandError(
          "$.candidate",
          "candidate.slot",
          `Candidate role, kind and behavior preset must match ${command.slot} (${expectedRole(expectedKind)}/${expectedKind})`,
        );
      world.enemyCandidates.push(
        cloneJson(command.candidate) as DeepMutable<LevelEditorEnemyCandidate>,
      );
      worldChapter.encounterSlots[command.slot] = {
        source: "candidate",
        candidateId: command.candidate.id,
      };
      return;
    }
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
      return;
    case "section.add": {
      const hostsBesties = "routeId" in chapter
        ? chapterHostsBestiesRoutine(
            worldProjectForCommand(project),
            worldChapterForCommand(chapter),
          )
        : undefined;
      const before = levelIssues(level, hostsBesties);
      const planned = planLevelEditorSection(level, command);
      if (!planned.ok) throw new CommandIssuesError(planned.issues);
      for (const piece of planned.plan.pieces)
        level.pieces.push(cloneJson(piece) as DeepMutable<AuthoredLevelPiece>);
      for (const connection of planned.plan.connections)
        level.connections.push(cloneJson(connection));
      level.branches.push([...planned.plan.branch]);
      // The published validators are the last word on whether the section is
      // safe. Pre-existing problems in an in-progress draft stay the author's
      // to fix; anything this command would add fails it instead.
      const added = newAuthoredLevelIssues(
        before,
        levelIssues(level, hostsBesties),
      );
      if (added.length > 0)
        throw new CommandIssuesError(
          added.map((entry) => ({
            path: "$",
            code: "section.unsafe",
            message: `The section would add a new problem at ${entry.path}: ${entry.message} (${entry.code})`,
          })),
        );
    }
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
      if (error instanceof CommandIssuesError)
        return Object.freeze({
          ok: false,
          project,
          issues: freezeIssues(
            error.issues.map((entry) =>
              issue(
                "command",
                `$.commands[${commandIndex}]${entry.path.slice(1)}`,
                entry.code,
                entry.message,
                commandIndex,
              ),
            ),
          ),
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
