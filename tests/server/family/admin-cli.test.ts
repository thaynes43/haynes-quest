import { describe, expect, it } from 'vitest';
import { ADMIN_USAGE, runAdminCommand } from '../../../src/server/admin.js';
import { familyHarness } from './harness.js';
import { TEST_CHILD_B } from './fake-immich.js';

async function cli() {
  const harness = familyHarness();
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
        'templates 3',
        'template rat-casino-world@v1 chapters 3',
        'template rat-casino-world@v2 chapters 3',
        'template family-world-b@v1 chapters 3',
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

  it('reports needs-photo chapters by number and refuses incomplete input', async () => {
    const { run } = await cli();
    expect((await run('help')).output).toEqual([ADMIN_USAGE]);
    await expect(run('people')).rejects.toMatchObject({ code: 'MISSING_OPTION' });
    await expect(run('create-child', '--name', TEST_CHILD_B.name, '--choice', 'person-x', '--display-name', 'X',
      '--template', 'rat-casino-world@v2')).rejects.toMatchObject({ code: 'MISSING_OPTION' });
    await expect(run('verify-media', '--child', '00000000-0000-4000-8000-000000000000'))
      .rejects.toMatchObject({ code: 'JOURNEY_NOT_PUBLISHED' });
  });
});
