import type { Context } from "hono";
import { z } from "zod";
import { AppError } from "./errors.js";
import { parseDateOnly } from "./domain.js";

const dateOnly = z.string().refine((value) => {
  try {
    parseDateOnly(value);
    return true;
  } catch {
    return false;
  }
}, "Invalid date");

export const previewRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    birthDate: dateOnly,
    fromDate: dateOnly.optional(),
    toDate: dateOnly.optional(),
    limit: z.number().int().min(1).max(24).optional(),
    subjectId: z.string().min(1).max(128).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.fromDate && value.toDate && value.fromDate > value.toDate) {
      context.addIssue({ code: "custom", message: "Invalid date range" });
    }
    if (value.fromDate && value.fromDate < value.birthDate) {
      context.addIssue({
        code: "custom",
        message: "Range precedes birth date",
      });
    }
    if (value.toDate && value.toDate < value.birthDate) {
      context.addIssue({
        code: "custom",
        message: "Range precedes birth date",
      });
    }
  });

export const createSaveSchema = z
  .object({
    previewId: z.string().uuid(),
    selectedIds: z.array(z.string().min(1).max(128)).min(1).max(24),
    title: z.string().trim().min(1).max(80).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.selectedIds).size !== value.selectedIds.length) {
      context.addIssue({ code: "custom", message: "Duplicate selection" });
    }
  });

export const recoverSchema = z
  .object({ memoryId: z.string().min(1).max(128) })
  .strict();
export const finishSchema = z.object({}).strict();
export const playtestStartSchema = z.object({
  chapter: z.union([z.literal(1), z.literal(2)]),
}).strict();

/**
 * Only the envelope. `project` stays `unknown` on purpose: the shared editor
 * module owns the project schema, its size caps and its actionable issue paths,
 * so duplicating any of that here would let the two drift apart.
 */
export const editorPlaytestSchema = z.object({
  project: z.unknown(),
  chapterId: z.enum(['chapter-1', 'chapter-2']),
  scope: z.enum(['chapter', 'adventure']),
}).strict();

const gameplayLevelId = z.string().min(1).max(160);
const gameplayActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('collect-equipment'),
    levelId: gameplayLevelId,
    pickupId: z.string().min(1).max(160),
  }).strict(),
  z.object({
    type: z.literal('attack'),
    levelId: gameplayLevelId,
    encounterId: z.string().min(1).max(160),
  }).strict(),
  z.object({
    type: z.literal('secondary-attack'),
    levelId: gameplayLevelId,
    encounterId: z.string().min(1).max(160),
  }).strict(),
  z.object({
    type: z.literal('take-hit'),
    levelId: gameplayLevelId,
    encounterId: z.string().min(1).max(160),
  }).strict(),
  z.object({
    type: z.literal('interact-friendly'),
    levelId: gameplayLevelId,
    friendlyId: z.string().min(1).max(360),
  }).strict(),
  z.object({
    type: z.literal('attack-friendly'),
    levelId: gameplayLevelId,
    friendlyId: z.string().min(1).max(360),
  }).strict(),
  z.object({ type: z.literal('guard'), levelId: gameplayLevelId }).strict(),
  z.object({
    type: z.literal('recover-memory'),
    levelId: gameplayLevelId,
    memoryId: z.string().min(1).max(128),
  }).strict(),
  z.object({ type: z.literal('consume-memory-bundle'), levelId: gameplayLevelId }).strict(),
  z.object({ type: z.literal('retry-level'), levelId: gameplayLevelId }).strict(),
]);
export const gameplayActionRequestSchema = z.object({
  actionId: z.string().uuid(),
  expectedRevision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  action: gameplayActionSchema,
}).strict();

export async function parseJson<T>(
  context: Context,
  schema: z.ZodType<T>,
  maxBytes = 16_384,
): Promise<T> {
  const contentType = context.req
    .header("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  if (contentType !== "application/json") {
    throw new AppError(415, "JSON_REQUIRED", "JSON required");
  }
  const declaredLength = Number(context.req.header("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new AppError(413, "REQUEST_TOO_LARGE", "Request too large");
  }

  const chunks: Uint8Array[] = [];
  let length = 0;
  const reader = context.req.raw.body?.getReader();
  if (reader) {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > maxBytes) {
        await reader.cancel();
        throw new AppError(413, "REQUEST_TOO_LARGE", "Request too large");
      }
      chunks.push(chunk.value);
    }
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new AppError(400, "INVALID_JSON", "Invalid JSON");
  }
  const result = schema.safeParse(json);
  if (!result.success)
    throw new AppError(422, "INVALID_REQUEST", "Invalid request");
  return result.data;
}
