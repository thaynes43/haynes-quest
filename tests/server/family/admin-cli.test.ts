import { describe, expect, it } from 'vitest';
import { Readable } from 'node:stream';
import { ADMIN_USAGE, readPrivateStream, runAdminCommand } from '../../../src/server/admin.js';
import { familyHarness } from './harness.js';
import { TEST_CHILD_B } from './fake-immich.js';
import { upgradeRegistry } from './template-variants.js';

async function cli(options: Parameters<typeof familyHarness>[0] = {}) {
  const harness = familyHarness(options);
  const lines: string[] = [];
  let stdinReads = 0;
  /** Runs one command; `stdin` is the private JSON object, when the command takes one. */
  const runWith = async (stdin: unknown, ...argv: string[]) => {
    const start = lines.length;
    const code = await runAdminCommand(argv, {
      service: harness.service,
      store: harness.familyStore,
      media: harness.library,
      readInput: async () => {
        stdinReads += 1;
        return typeof stdin === 'string' ? stdin : JSON.stringify(stdin);
      },
    }, (line) => lines.push(line));
    return { code, output: lines.slice(start) };
  };
  const run = (...argv: string[]) => runWith('', ...argv);
  return { harness, lines, run, runWith, stdinReads: () => stdinReads };
}

describe('operator CLI (DESIGN-024 D-09)', () => {
  it('sets up and publishes a journey printing only opaque ids and counts', async () => {
    const { harness, lines, run, runWith } = await cli();
    const people = await runWith({ name: TEST_CHILD_B.name }, 'people');
    expect(people.code).toBe(0);
    expect(people.output[0]).toBe('matches 1');
    const choice = /^choice (person-[a-f0-9]{32}) birth-date on-file$/.exec(people.output[1]!)?.[1];
    expect(choice).toBeDefined();
    expect((await runWith({ birthDate: TEST_CHILD_B.birthDate }, 'templates')).output)
      .toEqual([
        'templates 7',
        'template rat-casino-world@v1 chapters 3',
        'template rat-casino-world@v2 chapters 3',
        'template family-world-b@v1 chapters 3',
        'template family-world-b@v2 chapters 3',
        'template family-world-b@v3 chapters 3',
        'template family-world-b@v4 chapters 3',
        'template family-world-b@v5 chapters 3',
      ]);

    const created = await runWith(
      { name: TEST_CHILD_B.name, displayName: 'Test Child B' },
      'create-child', '--choice', choice!, '--immich-birth-date', '--template', 'rat-casino-world@v2',
    );
    const childId = /^child ([0-9a-f-]{36})$/.exec(created.output[0]!)?.[1];
    expect(childId).toBeDefined();
    expect((await harness.familyStore.getChild(childId!))).toMatchObject({ birthDate: TEST_CHILD_B.birthDate, createdBy: null });

    expect((await run('auto-pick', '--child', childId!)).output).toEqual(['draft r0 filled 9/9 needs-photo 0']);
    const publish = await run('publish', '--child', childId!);
    expect(publish.output[0]).toMatch(/^publication [0-9a-f-]{36} r1 chapters 3 memories 9$/);
    expect((await run('verify-media', '--child', childId!))).toEqual({ code: 0, output: ['decoded 9/9 failed 0'] });
    const status = await run('status');
    expect(status.output).toEqual([
      'children 1',
      `child ${childId} template rat-casino-world@v2 draft r0 filled 9/9 publication r1`,
    ]);

    const everything = lines.join('\n');
    expect(everything).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(everything).not.toContain('Test Child');
    expect(everything).not.toContain(TEST_CHILD_B.personId);
    for (const asset of harness.assets) expect(everything).not.toContain(asset.id);
  });

  it('moves a child published on World B v1 onto v2 with set-template, carrying the draft', async () => {
    const { lines, run, runWith } = await cli();
    const people = await runWith({ name: TEST_CHILD_B.name }, 'people');
    const choice = /^choice (person-[a-f0-9]{32}) /.exec(people.output[1]!)![1]!;
    const created = await runWith(
      { name: TEST_CHILD_B.name, displayName: 'Test Child B' },
      'create-child', '--choice', choice, '--immich-birth-date', '--template', 'family-world-b@v1',
    );
    const childId = /^child ([0-9a-f-]{36})$/.exec(created.output[0]!)![1]!;
    await run('auto-pick', '--child', childId);
    expect((await run('publish', '--child', childId)).output[0]).toMatch(/ r1 chapters 3 memories 9$/);
    expect((await run('set-template', '--child', childId, '--template', 'family-world-b@v2')).output)
      .toEqual(['draft r1 carried 9/9 needs-photo 0']);
    expect((await run('publish', '--child', childId)).output[0]).toMatch(/ r2 chapters 3 memories 9$/);
    expect((await run('status')).output).toEqual([
      'children 1',
      `child ${childId} template family-world-b@v2 draft r1 filled 9/9 publication r2`,
    ]);
    await expect(run('set-template', '--child', childId, '--template', 'family-world-b'))
      .rejects.toMatchObject({ code: 'MISSING_OPTION' });
    expect(lines.join('\n')).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('reports needs-photo chapters by number and refuses incomplete input', async () => {
    const { run, runWith } = await cli();
    expect((await run('help')).output).toEqual([ADMIN_USAGE]);
    await expect(run('people')).rejects.toMatchObject({ code: 'MISSING_INPUT' });
    await expect(runWith({ name: TEST_CHILD_B.name, displayName: 'X' }, 'create-child', '--choice', 'person-x',
      '--template', 'rat-casino-world@v2')).rejects.toMatchObject({ code: 'MISSING_INPUT' });
    await expect(runWith({ name: TEST_CHILD_B.name, displayName: 'X', birthDate: TEST_CHILD_B.birthDate },
      'create-child', '--choice', 'person-x', '--immich-birth-date', '--template', 'rat-casino-world@v2'))
      .rejects.toMatchObject({ code: 'CONFLICTING_OPTIONS' });
    await expect(runWith('not json', 'people')).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await expect(runWith({ name: TEST_CHILD_B.name, extra: 1 }, 'people')).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await expect(runWith(JSON.stringify({ name: 'x'.repeat(5_000) }), 'people'))
      .rejects.toMatchObject({ code: 'INPUT_TOO_LARGE' });
    await expect(run('verify-media', '--child', '00000000-0000-4000-8000-000000000000'))
      .rejects.toMatchObject({ code: 'JOURNEY_NOT_PUBLISHED' });
  });

  it('moves a child to a newer world version printing only draft counts (D-11)', async () => {
    const { harness, lines, run, runWith } = await cli({ templates: upgradeRegistry() });
    const people = await runWith({ name: TEST_CHILD_B.name }, 'people');
    const choice = /^choice (\S+) /.exec(people.output[1]!)![1]!;
    const create = async (template: string) => /^child (\S+)$/.exec((await runWith(
      { name: TEST_CHILD_B.name, displayName: 'Test Child B' },
      'create-child', '--choice', choice, '--immich-birth-date', '--template', template,
    )).output[0]!)![1]!;
    const childId = await create('family-world-b@v1');
    expect((await run('auto-pick', '--child', childId)).output).toEqual(['draft r0 filled 9/9 needs-photo 0']);
    await run('publish', '--child', childId);

    expect(await run('set-template', '--child', childId, '--template', 'family-world-b@v2'))
      .toEqual({ code: 0, output: ['draft r1 carried 9/9 needs-photo 0'] });
    expect(await run('set-template', '--child', childId, '--template', 'family-world-b@v3'))
      .toEqual({ code: 0, output: ['draft r2 carried 3/9 needs-photo 0'] });
    expect((await run('status')).output[1]).toBe(
      `child ${childId} template family-world-b@v3 draft r2 filled 9/9 publication r1`);
    expect(await harness.familyStore.getChild(childId)).toMatchObject({ templateVersion: 'v3', updatedBy: null });

    await expect(run('set-template', '--child', childId, '--template', 'family-world-b@v2'))
      .rejects.toMatchObject({ code: 'TEMPLATE_UPGRADE_UNAVAILABLE' });
    await expect(run('set-template', '--child', childId, '--template', 'rat-casino-world@v2'))
      .rejects.toMatchObject({ code: 'TEMPLATE_UPGRADE_UNAVAILABLE' });
    await expect(run('set-template', '--child', childId, '--template', 'family-world-b@v12'))
      .rejects.toMatchObject({ code: 'TEMPLATE_UPGRADE_UNAVAILABLE' });
    await expect(run('set-template', '--child', childId, '--template', 'family-world-b'))
      .rejects.toMatchObject({ code: 'MISSING_OPTION' });
    await expect(run('set-template', '--child', childId, '--template', 'family-world-b@v4@v5'))
      .rejects.toMatchObject({ code: 'MISSING_OPTION' });
    await expect(run('set-template', '--template', 'family-world-b@v4')).rejects.toMatchObject({ code: 'MISSING_OPTION' });
    await expect(run('set-template', '--child', 'not-a-child', '--template', 'family-world-b@v4'))
      .rejects.toMatchObject({ code: 'CHILD_NOT_FOUND' });

    // A child with no draft yet: every chapter is picked on the new version.
    await harness.familyStore.createChild({
      displayName: 'Test Child C', immichName: 'Test Child C', immichPersonId: 'synthetic-person-c',
      birthDate: TEST_CHILD_B.birthDate, templateId: 'family-world-b', templateVersion: 'v4',
    }, null);
    const other = (await harness.familyStore.listChildren()).at(-1)!.id;
    expect((await run('set-template', '--child', other, '--template', 'family-world-b@v5')).output)
      .toEqual([expect.stringMatching(/^draft r0 carried 0\/9 needs-photo \d$/)]);

    const everything = lines.join('\n');
    expect(everything).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(everything).not.toContain('Test Child');
    expect(everything).not.toContain(TEST_CHILD_B.personId);
    for (const asset of harness.assets) expect(everything).not.toContain(asset.id);
  });

  it('refuses private values on the command line, where the audit log records them', async () => {
    // kubectl exec sends every argument in the exec URL; the apiserver audit log keeps it.
    const { run, stdinReads } = await cli();
    for (const argv of [
      ['people', '--name', TEST_CHILD_B.name],
      ['templates', '--birth-date', TEST_CHILD_B.birthDate],
      ['create-child', '--choice', 'person-x', '--display-name', 'X', '--template', 'rat-casino-world@v2'],
    ]) {
      await expect(run(...argv)).rejects.toMatchObject({ code: 'PRIVATE_OPTION_REFUSED' });
    }
    // Commands without private input never wait on stdin.
    expect((await run('status')).output).toEqual(['children 0']);
    expect(stdinReads()).toBe(0);
  });

  it('reads the private JSON from stdin to its end and caps its size', async () => {
    expect(await readPrivateStream(Readable.from([Buffer.from('{"na'), Buffer.from('me":"x"}')]))).toBe('{"name":"x"}');
    expect(await readPrivateStream(Object.assign(Readable.from([]), { isTTY: true }))).toBe('');
    await expect(readPrivateStream(Readable.from([Buffer.alloc(5_000, 32)])))
      .rejects.toMatchObject({ code: 'INPUT_TOO_LARGE' });
  });
});
