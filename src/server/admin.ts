/**
 * Operator CLI for family journeys (DESIGN-024 D-09):
 *
 *   node dist/server/admin.js <command> [options]
 *
 * It runs inside the family pod with the pod's own environment and performs
 * the same service calls as the admin screen, so nothing bypasses validation.
 * Output is limited to opaque ids and counts: never names, dates or photo ids.
 *
 * Private inputs (the Immich name, the display name and the birthday) arrive
 * as one JSON object on stdin, never as arguments: `kubectl exec` puts every
 * argument into the exec URL, which the kube-apiserver audit log records.
 * Only opaque ids and fixed flags are accepted on the command line.
 */
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { loadConfig } from './config.js';
import { PostgresQuestStore } from './db/postgres-store.js';
import { AppError } from './errors.js';
import type { FamilyJourneyService } from './family/service.js';
import type { FamilyStore } from './family/store.js';
import { createConfiguredFamily, createConfiguredImmich } from './family/wiring.js';
import type { PrivateMediaProvider } from './media.js';

export interface AdminCliContext {
  readonly service: FamilyJourneyService;
  readonly store: FamilyStore;
  readonly media: PrivateMediaProvider;
  /** The whole of stdin; read only by commands that take private input. */
  readonly readInput: () => Promise<string>;
}

export const ADMIN_USAGE = `Usage: node dist/server/admin.js <command> [options] [< private.json]
  status
  people                      stdin {"name"}
  templates                   stdin {"birthDate"}
  create-child --choice <choice id> --template <id>@<version> [--immich-birth-date]
                              stdin {"name", "displayName", "birthDate" unless --immich-birth-date}
  set-template --child <child id> --template <id>@<version>
  auto-pick --child <child id> [--reseed]
  publish --child <child id> [--revision <draft revision>] [--request <uuid>]
  verify-media --child <child id>
Names and birthdays go in one JSON object on stdin (kubectl exec -i), never
in arguments, which the cluster audit log records.
Output lists only opaque ids and counts.`;

type Options = Record<string, string | true>;

/** Options that would carry a private value; refused before anything runs. */
const PRIVATE_OPTIONS = new Set(['name', 'display-name', 'birth-date']);
const MAX_INPUT_BYTES = 4_096;

const privateInputSchema = z.object({
  name: z.string().max(200).optional(),
  displayName: z.string().max(200).optional(),
  birthDate: z.string().max(32).optional(),
}).strict();

type PrivateInput = z.infer<typeof privateInputSchema>;

/** Runs one command and returns the process exit code. */
export async function runAdminCommand(
  argv: readonly string[],
  context: AdminCliContext,
  out: (line: string) => void,
): Promise<number> {
  const [command, ...rest] = argv;
  const options = parseOptions(rest);
  const text = (name: string): string => {
    const value = options[name];
    if (typeof value !== 'string' || !value.trim()) throw new AppError(422, 'MISSING_OPTION', `--${name} is required`);
    return value;
  };
  let input: PrivateInput | undefined;
  const privateValue = async (key: keyof PrivateInput): Promise<string> => {
    input ??= parsePrivateInput(await context.readInput());
    const value = input[key];
    if (typeof value !== 'string' || !value.trim()) throw new AppError(422, 'MISSING_INPUT', `stdin ${key} is required`);
    return value;
  };
  switch (command) {
    case 'status': {
      const children = await context.store.listChildren();
      out(`children ${children.length}`);
      for (const child of children) {
        const [draft, publication] = await Promise.all([
          context.store.getDraft(child.id),
          context.store.latestPublication(child.id),
        ]);
        const filled = draft?.slots.filter((slot) => slot.status === 'filled').length ?? 0;
        out([
          `child ${child.id}`,
          `template ${child.templateId}@${child.templateVersion}`,
          draft ? `draft r${draft.revision} filled ${filled}/${draft.slots.length}` : 'draft none',
          publication ? `publication r${publication.revision}` : 'publication none',
        ].join(' '));
      }
      return 0;
    }
    case 'people': {
      const people = await context.service.lookupPeople(await privateValue('name'));
      out(`matches ${people.length}`);
      for (const person of people) {
        out(`choice ${person.id} birth-date ${person.birthDate ? 'on-file' : 'missing'}`);
      }
      return 0;
    }
    case 'templates': {
      const offers = context.service.offeredTemplates(await privateValue('birthDate'));
      out(`templates ${offers.length}`);
      for (const offer of offers) out(`template ${offer.id}@${offer.version} chapters ${offer.chapterCount}`);
      return 0;
    }
    case 'create-child': {
      const choice = text('choice');
      const [templateId, templateVersion] = text('template').split('@');
      if (!templateId || !templateVersion) throw new AppError(422, 'MISSING_OPTION', '--template is <id>@<version>');
      const name = await privateValue('name');
      const displayName = await privateValue('displayName');
      let birthDate: string | null = input?.birthDate?.trim() ? input.birthDate : null;
      if (options['immich-birth-date'] === true) {
        if (birthDate) throw new AppError(422, 'CONFLICTING_OPTIONS', 'Choose one birthday source');
        const person = (await context.service.lookupPeople(name)).find((entry) => entry.id === choice);
        if (!person) throw new AppError(422, 'SUBJECT_UNRESOLVED', 'Person unresolved');
        birthDate = person.birthDate;
        if (!birthDate) throw new AppError(422, 'BIRTH_DATE_MISSING', 'No birthday on file');
      }
      if (!birthDate) throw new AppError(422, 'MISSING_INPUT', 'stdin birthDate or --immich-birth-date is required');
      const child = await context.service.createChild({
        immichName: name,
        personChoiceId: choice,
        displayName,
        birthDate,
        templateId,
        templateVersion,
      }, null);
      out(`child ${child.id}`);
      return 0;
    }
    case 'auto-pick': {
      const draft = await context.service.autoPick(text('child'), null, { reseed: options.reseed === true });
      const slots = draft.chapters.flatMap((chapter) => chapter.slots);
      const filled = slots.filter((slot) => slot.status === 'filled').length;
      out(`draft r${draft.revision} filled ${filled}/${slots.length} needs-photo ${slots.length - filled}`);
      draft.chapters.forEach((chapter, index) => {
        const missing = chapter.slots.filter((slot) => slot.status !== 'filled').length;
        if (missing > 0) out(`needs-photo chapter ${index + 1} slots ${missing}`);
      });
      return 0;
    }
    case 'set-template': {
      // DESIGN-024 D-11 "Update world": a template fix ships as a newer
      // version of the same template; this moves a child onto it from the
      // current draft revision. Publishing stays a separate step.
      const childId = text('child');
      const [templateId, templateVersion, extra] = text('template').split('@');
      if (!templateId || !templateVersion || extra !== undefined) {
        throw new AppError(422, 'MISSING_OPTION', '--template is <id>@<version>');
      }
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(childId)) {
        throw new AppError(404, 'CHILD_NOT_FOUND', 'Child not found');
      }
      const current = await context.store.getDraft(childId);
      const result = await context.service.upgradeTemplate(childId, {
        templateId,
        templateVersion,
        expectedRevision: current?.revision ?? null,
      }, null);
      out(`draft r${result.draft.revision} carried ${result.carried}/${result.total} needs-photo ${result.needsPhoto}`);
      return 0;
    }
    case 'publish': {
      const childId = text('child');
      const revision = typeof options.revision === 'string'
        ? Number(options.revision)
        : (await context.service.getDraft(childId)).revision;
      if (!Number.isSafeInteger(revision) || revision < 0) throw new AppError(422, 'INVALID_REVISION', 'Invalid revision');
      const requestId = typeof options.request === 'string' ? options.request : randomUUID();
      const publication = await context.service.publish(childId, revision, requestId, null);
      out(`publication ${publication.publicationId} r${publication.revision} chapters ${publication.chapterCount} memories ${publication.memoryCount}`);
      return 0;
    }
    case 'verify-media': {
      // DESIGN-024 live validation: decode every chosen photo through the
      // sanitizer and report counts only.
      const publication = await context.store.latestPublication(text('child'));
      if (!publication) throw new AppError(404, 'JOURNEY_NOT_PUBLISHED', 'Journey not published');
      let decoded = 0;
      for (const memory of publication.memories) {
        try {
          await context.media.fetchMedia(memory);
          decoded += 1;
        } catch {
          // Counted as failed; the reason may name upstream state, so it is not printed.
        }
      }
      out(`decoded ${decoded}/${publication.memories.length} failed ${publication.memories.length - decoded}`);
      return decoded === publication.memories.length ? 0 : 1;
    }
    default:
      out(ADMIN_USAGE);
      return 2;
  }
}

function parseOptions(args: readonly string[]): Options {
  const options: Options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (!arg.startsWith('--')) throw new AppError(422, 'INVALID_ARGUMENT', 'Unexpected argument');
    const name = arg.slice(2);
    if (PRIVATE_OPTIONS.has(name)) {
      // The value is already in the audit log by now; refusing it keeps the
      // habit from working at all, so the stdin form is the only one.
      throw new AppError(422, 'PRIVATE_OPTION_REFUSED', `--${name} goes in the stdin JSON`);
    }
    const next = args[index + 1];
    if (next !== undefined && !next.startsWith('--')) {
      options[name] = next;
      index += 1;
    } else {
      options[name] = true;
    }
  }
  return options;
}

function parsePrivateInput(raw: string): PrivateInput {
  if (Buffer.byteLength(raw) > MAX_INPUT_BYTES) throw new AppError(413, 'INPUT_TOO_LARGE', 'stdin too large');
  if (!raw.trim()) throw new AppError(422, 'MISSING_INPUT', 'stdin JSON is required');
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new AppError(422, 'INVALID_INPUT', 'stdin is not JSON');
  }
  const result = privateInputSchema.safeParse(json);
  if (!result.success) throw new AppError(422, 'INVALID_INPUT', 'stdin JSON has unexpected fields');
  return result.data;
}

/** Reads a stream (stdin) to its end, capped; an interactive terminal counts as empty. */
export async function readPrivateStream(
  stream: AsyncIterable<unknown> & { readonly isTTY?: boolean } = process.stdin,
): Promise<string> {
  if (stream.isTTY) return '';
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    length += buffer.byteLength;
    if (length > MAX_INPUT_BYTES) throw new AppError(413, 'INPUT_TOO_LARGE', 'stdin too large');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function main(argv = process.argv.slice(2)): Promise<number> {
  const out = (line: string) => process.stdout.write(`${line}\n`);
  const config = loadConfig();
  if (config.fixtureMode || !config.databaseUrl) {
    process.stderr.write('error FAMILY_MODE_REQUIRED\n');
    return 1;
  }
  const store = PostgresQuestStore.connect(config.databaseUrl);
  try {
    await store.migrate();
    const immich = createConfiguredImmich(config);
    const family = createConfiguredFamily(config, store, immich);
    if (!immich || !family?.service) {
      process.stderr.write('error FAMILY_SETUP_UNAVAILABLE\n');
      return 1;
    }
    return await runAdminCommand(
      argv,
      { service: family.service, store: family.store, media: immich, readInput: () => readPrivateStream() },
      out,
    );
  } catch (error) {
    // Only a fixed code: messages and stacks can quote private values.
    process.stderr.write(`error ${error instanceof AppError ? error.code : 'UNEXPECTED'}\n`);
    return 1;
  } finally {
    await store.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().then((code) => {
    process.exitCode = code;
  });
}
