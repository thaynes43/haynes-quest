import { describe, expect, it } from 'vitest';
import { ADMIN_USAGE, runAdminCommand } from '../../../src/server/admin.js';
import { familyHarness } from './harness.js';
import { TEST_CHILD_B } from './fake-immich.js';
import { upgradeRegistry } from './template-variants.js';

async function cli(options: Parameters<typeof familyHarness>[0] = {}) {
  const harness = familyHarness(options);
  const lines: string[] = [];
  const run = async (...argv: string[]) => {
    const start = lines.length;
    const code = await runAdminCommand(argv, {
      service: harness.service,
      store: harness.familyStore,
      media: harness.library,
    }, (line) => lines.push(line));
    return { code, output: lines.slice(start) };
  };
  return { harness, lines, run };
}

describe('operator CLI (DESIGN-024 D-09)', () => {
  it('sets up and publishes a journey printing only opaque ids and counts', async () => {
    const { harness, lines, run } = await cli();
    const people = await run('people', '--name', TEST_CHILD_B.name);
    expect(people.code).toBe(0);
    expect(people.output[0]).toBe('matches 1');
    const choice = /^choice (person-[a-f0-9]{32}) birth-date on-file$/.exec(people.output[1]!)?.[1];
    expect(choice).toBeDefined();
    expect((await run('templates', '--birth-date', TEST_CHILD_B.birthDate)).output)
      .toEqual([
        'templates 4',
        'template rat-casino-world@v1 chapters 3',
        'template rat-casino-world@v2 chapters 3',
        'template family-world-b@v1 chapters 3',
        'template family-world-b@v2 chapters 3',
      ]);

    const created = await run(
      'create-child', '--name', TEST_CHILD_B.name, '--choice', choice!, '--display-name', 'Test Child B',
      '--immich-birth-date', '--template', 'rat-casino-world@v2',
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
    const { lines, run } = await cli();
    const people = await run('people', '--name', TEST_CHILD_B.name);
    const choice = /^choice (person-[a-f0-9]{32}) /.exec(people.output[1]!)![1]!;
    const created = await run(
      'create-child', '--name', TEST_CHILD_B.name, '--choice', choice, '--display-name', 'Test Child B',
      '--immich-birth-date', '--template', 'family-world-b@v1',
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
    const { run } = await cli();
    expect((await run('help')).output).toEqual([ADMIN_USAGE]);
    await expect(run('people')).rejects.toMatchObject({ code: 'MISSING_OPTION' });
    await expect(run('create-child', '--name', TEST_CHILD_B.name, '--choice', 'person-x', '--display-name', 'X',
      '--template', 'rat-casino-world@v2')).rejects.toMatchObject({ code: 'MISSING_OPTION' });
    await expect(run('verify-media', '--child', '00000000-0000-4000-8000-000000000000'))
      .rejects.toMatchObject({ code: 'JOURNEY_NOT_PUBLISHED' });
  });

  it('moves a child to a newer world version printing only draft counts (D-11)', async () => {
    const { harness, lines, run } = await cli({ templates: upgradeRegistry() });
    const people = await run('people', '--name', TEST_CHILD_B.name);
    const choice = /^choice (\S+) /.exec(people.output[1]!)![1]!;
    const create = async (template: string) => /^child (\S+)$/.exec((await run(
      'create-child', '--name', TEST_CHILD_B.name, '--choice', choice, '--display-name', 'Test Child B',
      '--immich-birth-date', '--template', template,
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
});
