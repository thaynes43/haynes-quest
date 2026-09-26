/**
 * Operator CLI for family journeys (DESIGN-024 D-09):
 *
 *   node dist/server/admin.js <command> [options]
 *
 * It runs inside the family pod with the pod's own environment and performs
 * the same service calls as the admin screen, so nothing bypasses validation.
 * Output is limited to opaque ids and counts: never names, dates or photo ids.
 */
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
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
}

export const ADMIN_USAGE = `Usage: node dist/server/admin.js <command> [options]
  status
  people --name <Immich name>
  templates --birth-date <YYYY-MM-DD>
  create-child --name <Immich name> --choice <choice id> --display-name <name>
               (--birth-date <YYYY-MM-DD> | --immich-birth-date) --template <id>@<version>
  auto-pick --child <child id> [--reseed]
  publish --child <child id> [--revision <draft revision>] [--request <uuid>]
  verify-media --child <child id>
Output lists only opaque ids and counts.`;

type Options = Record<string, string | true>;

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
      const people = await context.service.lookupPeople(text('name'));
      out(`matches ${people.length}`);
      for (const person of people) {
        out(`choice ${person.id} birth-date ${person.birthDate ? 'on-file' : 'missing'}`);
      }
      return 0;
    }
    case 'templates': {
      const offers = context.service.offeredTemplates(text('birth-date'));
      out(`templates ${offers.length}`);
      for (const offer of offers) out(`template ${offer.id}@${offer.version} chapters ${offer.chapterCount}`);
      return 0;
    }
    case 'create-child': {
      const name = text('name');
      const choice = text('choice');
      const [templateId, templateVersion] = text('template').split('@');
      if (!templateId || !templateVersion) throw new AppError(422, 'MISSING_OPTION', '--template is <id>@<version>');
      let birthDate = typeof options['birth-date'] === 'string' ? options['birth-date'] : null;
      if (options['immich-birth-date'] === true) {
        if (birthDate) throw new AppError(422, 'CONFLICTING_OPTIONS', 'Choose one birthday source');
        const person = (await context.service.lookupPeople(name)).find((entry) => entry.id === choice);
        if (!person) throw new AppError(422, 'SUBJECT_UNRESOLVED', 'Person unresolved');
        birthDate = person.birthDate;
        if (!birthDate) throw new AppError(422, 'BIRTH_DATE_MISSING', 'No birthday on file');
      }
      if (!birthDate) throw new AppError(422, 'MISSING_OPTION', '--birth-date or --immich-birth-date is required');
      const child = await context.service.createChild({
        immichName: name,
        personChoiceId: choice,
        displayName: text('display-name'),
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
    return await runAdminCommand(argv, { service: family.service, store: family.store, media: immich }, out);
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
