import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/app.js';
import { InMemoryQuestStore } from '../../src/server/db/memory-store.js';
import {
  canonicalLevelEditorProjectJson,
  createLevelEditorProject,
  createWorldEditorProject,
  isLevelEditorProjectV2,
  LEVEL_EDITOR_PROJECT_MAX_BYTES,
  parseLevelEditorProject,
  type LevelEditorProject,
  type LevelEditorProjectV2,
} from '../../src/shared/editor-project.js';
import { createAdventureStateAtLevel } from '../../src/shared/adventure.js';
import { parseStoredAdventure } from '../../src/server/adventure-schema.js';
import { prepareEditorPreview } from '../../src/server/editor-preview.js';
import { shiftAuthoredLevelX } from '../editor-project-fixtures.js';

const ORIGIN = 'https://quest.test';
const SECRET = 'fixture-session-secret-that-is-at-least-32-characters';

function makeApp(
  overrides: Partial<Parameters<typeof createApp>[0]> = {},
  store = InMemoryQuestStore.ephemeral(),
) {
  return {
    store,
    app: createApp({
      store,
      fixtureMode: true,
      ephemeralPlaytest: true,
      sessionSecret: SECRET,
      appOrigin: ORIGIN,
      clientDir: '/tmp/quest-client-not-present',
      studioDir: '/tmp/quest-studio-not-present',
      ...overrides,
    }),
  };
}

function persistentApp() {
  const store = new InMemoryQuestStore();
  return {
    store,
    app: createApp({
      store,
      fixtureMode: true,
      sessionSecret: SECRET,
      appOrigin: ORIGIN,
      clientDir: '/tmp/quest-client-not-present',
      studioDir: '/tmp/quest-studio-not-present',
    }),
  };
}

type App = ReturnType<typeof makeApp>['app'];

async function startSession(app: App): Promise<string> {
  return (await openSession(app)).cookie;
}

async function openSession(app: App): Promise<{ cookie: string; playerId: string }> {
  const response = await app.request('/api/session');
  expect(response.status).toBe(200);
  return {
    cookie: response.headers.get('set-cookie')!.split(';', 1)[0]!,
    playerId: (await response.json()).player.id,
  };
}

function mutation(
  cookie: string | null,
  body: unknown,
  extra: Record<string, string> = {},
): RequestInit {
  return {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      ...(cookie ? { cookie } : {}),
      origin: ORIGIN,
      'content-type': 'application/json',
      'x-quest-request': '1',
      ...extra,
    },
  };
}

/** The project the editor's New project action produces. */
function templateProject(): LevelEditorProject {
  return createLevelEditorProject({ projectId: 'editor-preview-fixture' });
}

/** A mutable JSON draft, the way an import or a CLI edit hands one over. */
interface DraftProject {
  [key: string]: unknown;
  chapters: Array<{
    [key: string]: unknown;
    name: string;
    level: {
      [key: string]: unknown;
      pieces: Array<Record<string, unknown>>;
      anchors: { memories: { major: { position: { x: number } } } };
    };
  }>;
}

interface MutableWorldProjectDraft {
  chapters: Array<{
    encounterSlots: Record<string, Record<string, unknown>>;
  }>;
  enemyCandidates: Array<Record<string, unknown>>;
}

function draftProject(): DraftProject {
  return JSON.parse(JSON.stringify(templateProject())) as DraftProject;
}

/** A valid author edit: both chapters slid along X. */
function editedProject(dx: number): LevelEditorProject {
  const base = templateProject();
  return parseLevelEditorProject({
    ...base,
    revision: base.revision + 1,
    chapters: base.chapters.map((chapter) => ({
      ...chapter,
      level: shiftAuthoredLevelX(chapter.level, dx),
    })),
  });
}

function threeLevelWorldProject(
  candidateName = 'Midnight Pizza Gremlin',
): LevelEditorProjectV2 {
  const base = createWorldEditorProject({ projectId: 'complete-world-preview' });
  const candidates = [
    {
      id: 'midnight-sprinter',
      name: candidateName,
      periodId: 'besties-obby-v1' as const,
      recognizableReference: 'A fast arcade mascot parody',
      visualJoke: 'A pizza box cape that keeps folding shut',
      obstacleOrAttack: 'Runs a short familiar chase pattern',
      eligibility: { startDate: '2027-01-01', endDate: '2030-01-01' },
      role: 'ordinary' as const,
      kind: 'ordinary-a' as const,
      behaviorPreset: 'ordinary-a' as const,
    },
    {
      id: 'midnight-bouncer',
      name: 'Token Bouncer',
      periodId: 'besties-obby-v1' as const,
      recognizableReference: 'A bulky arcade guard parody',
      visualJoke: 'Counts pizza toppings instead of tickets',
      obstacleOrAttack: 'Uses the second ordinary movement preset',
      eligibility: { startDate: '2027-01-01', endDate: '2030-01-01' },
      role: 'ordinary' as const,
      kind: 'ordinary-b' as const,
      behaviorPreset: 'ordinary-b' as const,
    },
    {
      id: 'midnight-manager',
      name: 'The Midnight Manager',
      periodId: 'besties-obby-v1' as const,
      recognizableReference: 'A dramatic family arcade boss parody',
      visualJoke: 'Wields an enormous receipt like a royal scroll',
      obstacleOrAttack: 'Uses the known boss pursuit preset',
      eligibility: { startDate: '2027-01-01', endDate: '2030-01-01' },
      role: 'boss' as const,
      kind: 'boss' as const,
      behaviorPreset: 'boss' as const,
    },
  ];
  const source = base.chapters[1]!;
  const routeId = 'midnight-pizza-arcade';
  const parsed = parseLevelEditorProject({
    ...base,
    enemyCandidates: candidates,
    chapters: [
      ...base.chapters,
      {
        ...structuredClone(source),
        chapterId: 'chapter-3',
        routeId,
        name: 'Midnight Pizza Arcade',
        subtitle: 'Pizza, prizes and a manager who never clocks out',
        description: 'Cross the arcade course and recover the last fictional memory.',
        level: { ...structuredClone(source.level), id: routeId },
        representedDateRange: { startDate: '2027-01-01', endDate: '2030-01-01' },
        recoveredAge: { fromYears: 7, toYears: 10 },
        previewMemories: [
          { slotId: 'minor-one', date: '2028-01-01', label: 'The glowing token' },
          { slotId: 'minor-two', date: '2029-01-01', label: 'The giant prize' },
          { slotId: 'major', date: '2030-01-01', label: 'The midnight marquee' },
        ],
        encounterSlots: {
          'ordinary-1': { source: 'candidate', candidateId: 'midnight-sprinter' },
          'ordinary-2': { source: 'candidate', candidateId: 'midnight-bouncer' },
          'ordinary-3': { source: 'candidate', candidateId: 'midnight-sprinter' },
          'ordinary-4': { source: 'candidate', candidateId: 'midnight-bouncer' },
          boss: { source: 'candidate', candidateId: 'midnight-manager' },
        },
      },
    ],
  });
  if (!isLevelEditorProjectV2(parsed)) throw new Error('Expected a v2 editor project');
  return parsed;
}

function fingerprintOf(project: unknown): string {
  return createHash('sha256')
    .update(canonicalLevelEditorProjectJson(project), 'utf8')
    .digest('hex');
}

async function preview(
  app: App,
  cookie: string,
  body: unknown,
  extra: Record<string, string> = {},
) {
  return app.request('/api/editor/playtests', mutation(cookie, body, extra));
}

describe('POST /api/editor/playtests', () => {
  describe('guards', () => {
    it('does not exist outside the ephemeral fixture playtest', async () => {
      for (const surface of [persistentApp(), { app: createApp({
        store: new InMemoryQuestStore(),
        fixtureMode: false,
        sessionSecret: SECRET,
        appOrigin: ORIGIN,
        clientDir: '/tmp/quest-client-not-present',
        studioDir: '/tmp/quest-studio-not-present',
      }) }]) {
        const response = await surface.app.request(
          '/api/editor/playtests',
          mutation(null, {
            project: templateProject(),
            chapterId: 'chapter-1',
            scope: 'adventure',
          }),
        );
        expect(response.status).toBe(404);
        expect((await response.json()).error.code).toBe('NOT_FOUND');
      }
    });

    it('requires a fixture session, the exact origin and the CSRF header', async () => {
      const { app } = makeApp();
      const cookie = await startSession(app);
      const body = {
        project: templateProject(),
        chapterId: 'chapter-1' as const,
        scope: 'adventure' as const,
      };

      const anonymous = await preview(app, '', body);
      expect(anonymous.status).toBe(401);
      expect((await anonymous.json()).error.code).toBe('AUTH_REQUIRED');

      const crossOrigin = await app.request(
        '/api/editor/playtests',
        mutation(cookie, body, { origin: 'https://evil.test' }),
      );
      expect(crossOrigin.status).toBe(403);
      expect((await crossOrigin.json()).error.code).toBe('ORIGIN_REJECTED');

      const forged = await app.request('/api/editor/playtests', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { cookie, origin: ORIGIN, 'content-type': 'application/json' },
      });
      expect(forged.status).toBe(403);
      expect((await forged.json()).error.code).toBe('CSRF_REJECTED');

      const formEncoded = await app.request(
        '/api/editor/playtests',
        mutation(cookie, body, { 'content-type': 'text/plain' }),
      );
      expect(formEncoded.status).toBe(415);
    });

    it('rejects a body past the transport ceiling before parsing it', async () => {
      const { app, store } = makeApp();
      const { cookie, playerId } = await openSession(app);
      const response = await preview(app, cookie, {
        project: templateProject(),
        chapterId: 'chapter-1',
        scope: 'adventure',
        padding: 'x'.repeat(LEVEL_EDITOR_PROJECT_MAX_BYTES + 16_384),
      });
      expect(response.status).toBe(413);
      expect((await response.json()).error.code).toBe('REQUEST_TOO_LARGE');
      expect(await store.listSaves(playerId)).toEqual([]);
    });

    it('rejects a malformed envelope', async () => {
      const { app } = makeApp();
      const cookie = await startSession(app);
      for (const body of [
        { project: templateProject(), chapterId: 'chapter-3', scope: 'adventure' },
        { project: templateProject(), chapterId: 'chapter-1', scope: 'level' },
        { project: templateProject(), chapterId: 'chapter-1' },
        {
          project: templateProject(),
          chapterId: 'chapter-1',
          scope: 'adventure',
          extra: true,
        },
      ]) {
        const response = await preview(app, cookie, body);
        expect(response.status).toBe(422);
        expect((await response.json()).error.code).toBe('INVALID_REQUEST');
      }
      const brokenJson = await app.request('/api/editor/playtests', {
        method: 'POST',
        body: '{"project":',
        headers: {
          cookie,
          origin: ORIGIN,
          'content-type': 'application/json',
          'x-quest-request': '1',
        },
      });
      expect(brokenJson.status).toBe(400);
      expect((await brokenJson.json()).error.code).toBe('INVALID_JSON');
    });
  });

  describe('project validation', () => {
    it('reports structural issues with a path and creates no save', async () => {
      const { app, store } = makeApp();
      const { cookie, playerId } = await openSession(app);
      const broken = draftProject();
      (broken.chapters[0] as Record<string, unknown>).level = 'not a level';
      const response = await preview(app, cookie, {
        project: broken,
        chapterId: 'chapter-1',
        scope: 'adventure',
      });

      expect(response.status).toBe(422);
      const body = await response.json();
      expect(body.error.code).toBe('EDITOR_PROJECT_INVALID');
      expect(body.error.message).toBe('Editor project is invalid');
      expect(body.error.issues.length).toBeGreaterThan(0);
      expect(body.error.issues[0]).toMatchObject({
        source: 'structure',
        path: expect.stringContaining('$.chapters[0].level'),
        code: expect.any(String),
        message: expect.any(String),
      });
      expect(JSON.stringify(body)).not.toMatch(/\bat .*\.ts:\d+/);
      expect(await store.listSaves(playerId)).toEqual([]);
      // Positive control: the same owner does get a save once the project is valid.
      expect(
        (
          await preview(app, cookie, {
            project: templateProject(),
            chapterId: 'chapter-1',
            scope: 'adventure',
          })
        ).status,
      ).toBe(201);
      expect(await store.listSaves(playerId)).toHaveLength(1);
    });

    it('reports semantic issues against the offending anchor and creates no save', async () => {
      const { app, store } = makeApp();
      const { cookie, playerId } = await openSession(app);
      const draft = draftProject();
      // Floated off its platform: structurally fine, unplayable.
      draft.chapters[0]!.level.anchors.memories.major.position.x = 40;
      const response = await preview(app, cookie, {
        project: draft,
        chapterId: 'chapter-1',
        scope: 'adventure',
      });

      expect(response.status).toBe(422);
      const body = await response.json();
      expect(body.error.code).toBe('EDITOR_PROJECT_INVALID');
      expect(body.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            source: 'semantic',
            path: '$.chapters[0].level.anchors.memories["major"].position',
            code: 'support.unsafe',
          }),
        ]),
      );
      expect(await store.listSaves(playerId)).toEqual([]);
    });

    it('rejects an unsupported coordinate rather than rendering it', async () => {
      const { app } = makeApp();
      const cookie = await startSession(app);
      const draft = draftProject();
      const platform = draft.chapters[1]!.level.pieces.find(
        (piece) => piece.type === 'platform',
      ) as { center: { y: number } };
      platform.center.y = 5_000;
      const response = await preview(app, cookie, {
        project: draft,
        chapterId: 'chapter-2',
        scope: 'chapter',
      });
      expect(response.status).toBe(422);
      expect((await response.json()).error.issues.length).toBeGreaterThan(0);
    });
  });

  describe('accepted previews', () => {
    it('starts chapter one for the full adventure and returns the frozen project', async () => {
      const { app } = makeApp();
      const cookie = await startSession(app);
      const project = editedProject(0.5);
      const response = await preview(app, cookie, {
        project,
        chapterId: 'chapter-1',
        scope: 'adventure',
      });

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(Object.keys(body).sort()).toEqual(['fingerprint', 'project', 'save']);
      expect(body.save).toMatchObject({
        format: 'era-combat-v2',
        adventure: {
          planVersion: 'era-level-plan-v3',
          catalogVersion: 'parody-catalog-v5',
          activeLevelIndex: 0,
          phase: 'exploring',
          activeLevel: { index: 0, routeId: 'garden-playground-v2' },
        },
      });
      // Nothing about the fixed roster or the progression rules moved.
      expect(body.save.adventure.activeLevel.encounters).toHaveLength(5);
      expect(body.save.adventure.activeLevel.minorMemoryIds).toHaveLength(2);
      expect(body.save.adventure.completedLevelIds).toEqual([]);

      expect(body.project).toEqual(JSON.parse(JSON.stringify(project)));
      expect(canonicalLevelEditorProjectJson(body.project)).toBe(
        canonicalLevelEditorProjectJson(project),
      );
      expect(body.fingerprint).toBe(fingerprintOf(project));
      expect(body.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    });

    it('starts the requested chapter with its prerequisites genuinely satisfied', async () => {
      const { app } = makeApp();
      const cookie = await startSession(app);
      const response = await preview(app, cookie, {
        project: editedProject(-0.75),
        chapterId: 'chapter-2',
        scope: 'chapter',
      });

      expect(response.status).toBe(201);
      const save = (await response.json()).save;
      expect(save.adventure).toMatchObject({
        planVersion: 'era-level-plan-v3',
        catalogVersion: 'parody-catalog-v5',
        activeLevelIndex: 1,
        phase: 'exploring',
        activeLevel: { index: 1, routeId: 'besties-playground-v2' },
      });
      // Chapter one was actually played by the ordinary reducers.
      expect(save.adventure.completedLevelIds).toHaveLength(1);
      expect(save.adventure.consumedMemoryIds).toHaveLength(3);
      expect(save.ageYears).toBeGreaterThan(0);
      expect(save.adventure.inventory.some((item: { collected: boolean }) => item.collected)).toBe(
        true,
      );
      expect(save.revision).toBeGreaterThan(0);
    });

    it('starts chapter one when the adventure scope names a later chapter', async () => {
      const { app } = makeApp();
      const cookie = await startSession(app);
      const response = await preview(app, cookie, {
        project: templateProject(),
        chapterId: 'chapter-2',
        scope: 'adventure',
      });
      expect(response.status).toBe(201);
      expect((await response.json()).save.adventure).toMatchObject({
        activeLevelIndex: 0,
        activeLevel: { routeId: 'garden-playground-v2' },
      });
    });

    it('retains two frozen previews as independently playable saves', async () => {
      const { app } = makeApp();
      const cookie = await startSession(app);
      const firstProject = parseLevelEditorProject({
        ...editedProject(-0.5),
        name: 'Left garden run',
      });
      const secondProject = parseLevelEditorProject({
        ...editedProject(0.75),
        name: 'Right garden run',
      });

      const firstResponse = await preview(app, cookie, {
        project: firstProject,
        chapterId: 'chapter-1',
        scope: 'adventure',
      });
      const secondResponse = await preview(app, cookie, {
        project: secondProject,
        chapterId: 'chapter-1',
        scope: 'adventure',
      });
      expect(firstResponse.status).toBe(201);
      expect(secondResponse.status).toBe(201);
      const first = await firstResponse.json();
      const second = await secondResponse.json();

      expect(first.save.id).not.toBe(second.save.id);
      expect(first.project).toEqual(JSON.parse(JSON.stringify(firstProject)));
      expect(second.project).toEqual(JSON.parse(JSON.stringify(secondProject)));
      expect(first.project.name).toBe('Left garden run');
      expect(second.project.name).toBe('Right garden run');
      expect(first.project.chapters[0].level).not.toEqual(second.project.chapters[0].level);

      const firstPickup = first.save.adventure.activeLevel.pickups.find(
        (entry: { kind: string }) => entry.kind === 'attack-tool',
      );
      const secondPickup = second.save.adventure.activeLevel.pickups.find(
        (entry: { kind: string }) => entry.kind === 'guard-tool',
      );

      const firstAction = await app.request(
        `/api/saves/${first.save.id}/actions`,
        mutation(cookie, {
          actionId: randomUUID(),
          expectedRevision: first.save.revision,
          action: {
            type: 'collect-equipment',
            levelId: first.save.adventure.currentLevelId,
            pickupId: firstPickup.pickupId,
          },
        }),
      );
      expect(firstAction.status).toBe(200);

      const secondAction = await app.request(
        `/api/saves/${second.save.id}/actions`,
        mutation(cookie, {
          actionId: randomUUID(),
          expectedRevision: second.save.revision,
          action: {
            type: 'collect-equipment',
            levelId: second.save.adventure.currentLevelId,
            pickupId: secondPickup.pickupId,
          },
        }),
      );
      expect(secondAction.status).toBe(200);

      const [firstAfter, secondAfter] = await Promise.all([
        app.request(`/api/saves/${first.save.id}`, { headers: { cookie } }),
        app.request(`/api/saves/${second.save.id}`, { headers: { cookie } }),
      ]);
      expect(firstAfter.status).toBe(200);
      expect(secondAfter.status).toBe(200);
      const firstSave = await firstAfter.json();
      const secondSave = await secondAfter.json();
      expect(firstSave.revision).toBe(first.save.revision + 1);
      expect(secondSave.revision).toBe(second.save.revision + 1);
      expect(
        firstSave.adventure.inventory
          .filter((entry: { collected: boolean }) => entry.collected)
          .map((entry: { kind: string }) => entry.kind),
      ).toEqual(['attack-tool']);
      expect(
        secondSave.adventure.inventory
          .filter((entry: { collected: boolean }) => entry.collected)
          .map((entry: { kind: string }) => entry.kind),
      ).toEqual(['guard-tool']);
    });

    it('fingerprints edits apart and identical submissions together', async () => {
      const { app } = makeApp();
      const cookie = await startSession(app);
      const project = editedProject(0.5);
      const request = {
        project,
        chapterId: 'chapter-1' as const,
        scope: 'adventure' as const,
      };
      const first = await preview(app, cookie, request);
      const second = await preview(app, cookie, request);
      const renamed = await preview(app, cookie, {
        ...request,
        project: parseLevelEditorProject({ ...project, name: 'Ivy garden run' }),
      });
      const bodies = await Promise.all([first.json(), second.json(), renamed.json()]);

      expect(bodies[0].fingerprint).toBe(bodies[1].fingerprint);
      expect(bodies[2].fingerprint).not.toBe(bodies[0].fingerprint);
      expect(bodies[2].project.name).toBe('Ivy garden run');
      expect(bodies[2].project.chapters[0].level).toEqual(
        bodies[0].project.chapters[0].level,
      );

      // Fingerprints describe submitted snapshots, not save retention. The
      // intentional two-run owner cap expires the oldest save on request three.
      const [expired, retainedSecond, retainedRenamed] = await Promise.all([
        app.request(`/api/saves/${bodies[0].save.id}`, { headers: { cookie } }),
        app.request(`/api/saves/${bodies[1].save.id}`, { headers: { cookie } }),
        app.request(`/api/saves/${bodies[2].save.id}`, { headers: { cookie } }),
      ]);
      expect(expired.status).toBe(404);
      expect((await expired.json()).error.code).toBe('SAVE_NOT_FOUND');
      expect(retainedSecond.status).toBe(200);
      expect(retainedRenamed.status).toBe(200);
    });

    it('keeps edited chapter names without changing the roster', async () => {
      const { app } = makeApp();
      const cookie = await startSession(app);
      const plain = await (
        await app.request('/api/playtest/start', mutation(cookie, { chapter: 1 }))
      ).json();
      const base = templateProject();
      const renamed = parseLevelEditorProject({
        ...base,
        chapters: [
          { ...base.chapters[0], name: 'Ivy Street Block Party' },
          { ...base.chapters[1], name: 'Sleepover Showdown' },
        ],
      });
      const response = await preview(app, cookie, {
        project: renamed,
        chapterId: 'chapter-1',
        scope: 'adventure',
      });

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.project.chapters.map((chapter: { name: string }) => chapter.name)).toEqual([
        'Ivy Street Block Party',
        'Sleepover Showdown',
      ]);
      // Renaming a chapter changes no gameplay identity at all.
      expect(body.save.adventure.activeLevel).toMatchObject({
        routeId: plain.adventure.activeLevel.routeId,
        periodId: plain.adventure.activeLevel.periodId,
        eraYear: plain.adventure.activeLevel.eraYear,
      });
      expect(
        body.save.adventure.activeLevel.encounters.map(
          (encounter: { kind: string; role: string; content?: { catalogEntryId: string } }) => [
            encounter.role,
            encounter.kind,
            encounter.content?.catalogEntryId,
          ],
        ),
      ).toEqual(
        plain.adventure.activeLevel.encounters.map(
          (encounter: { kind: string; role: string; content?: { catalogEntryId: string } }) => [
            encounter.role,
            encounter.kind,
            encounter.content?.catalogEntryId,
          ],
        ),
      );
    });

    it('continues through the ordinary save action routes', async () => {
      const { app } = makeApp();
      const cookie = await startSession(app);
      const started = await (
        await preview(app, cookie, {
          project: editedProject(0.5),
          chapterId: 'chapter-1',
          scope: 'adventure',
        })
      ).json();
      const save = started.save;
      const pickup = save.adventure.activeLevel.pickups.find(
        (entry: { kind: string }) => entry.kind === 'attack-tool',
      );

      const applied = await app.request(
        `/api/saves/${save.id}/actions`,
        mutation(cookie, {
          actionId: randomUUID(),
          expectedRevision: save.revision,
          action: {
            type: 'collect-equipment',
            levelId: save.adventure.currentLevelId,
            pickupId: pickup.pickupId,
          },
        }),
      );
      expect(applied.status).toBe(200);
      const next = await applied.json();
      expect(next.revision).toBe(save.revision + 1);
      expect(next.adventure.activeLevel.routeId).toBe('garden-playground-v2');
      // No sidecar: the action response is an ordinary save view only.
      expect(next.project).toBeUndefined();
      expect(next.fingerprint).toBeUndefined();

      // And there is no server-side recovery route for the frozen snapshot.
      const recovery = await app.request(`/api/editor/playtests/${save.id}`, {
        headers: { cookie },
      });
      expect(recovery.status).toBe(404);
    });

    it('leaves the ordinary private playtest untouched', async () => {
      const { app } = makeApp();
      const cookie = await startSession(app);
      await preview(app, cookie, {
        project: editedProject(0.5),
        chapterId: 'chapter-1',
        scope: 'adventure',
      });
      const plain = await app.request(
        '/api/playtest/start',
        mutation(cookie, { chapter: 2 }),
      );
      expect(plain.status).toBe(201);
      const save = await plain.json();
      expect(save.adventure).toMatchObject({
        activeLevelIndex: 1,
        activeLevel: { routeId: 'besties-playground-v2' },
      });
      expect(await (await app.request('/api/saves', { headers: { cookie } })).json()).toEqual({
        saves: [],
      });
    });

    it('freezes a three-level world, starts at level three and advances level two into it', async () => {
      let clockMs = Date.now();
      const { app } = makeApp({ now: () => new Date(clockMs) });
      const cookie = await startSession(app);
      const project = threeLevelWorldProject();

      const full = await preview(app, cookie, {
        project,
        chapterId: 'chapter-3',
        scope: 'adventure',
      });
      expect(full.status).toBe(201);
      expect((await full.json()).save.adventure).toMatchObject({
        planVersion: 'editor-world-plan-v1',
        activeLevelIndex: 0,
        activeLevel: { totalLevels: 3, routeId: 'chapter-1-route' },
      });

      const selected = await preview(app, cookie, {
        project,
        chapterId: 'chapter-3',
        scope: 'chapter',
      });
      expect(selected.status).toBe(201);
      const selectedBody = await selected.json();
      expect(selectedBody.save).toMatchObject({
        ageYears: 7,
        recoveredIds: expect.arrayContaining([
          'chapter-1-route-memory-major',
          'chapter-2-route-memory-major',
        ]),
        adventure: {
          planVersion: 'editor-world-plan-v1',
          catalogVersion: 'parody-catalog-v5',
          activeLevelIndex: 2,
          completedLevelIds: ['chapter-1-route', 'chapter-2-route'],
          consumedMemoryIds: expect.arrayContaining([
            'chapter-1-route-memory-minor-one',
            'chapter-2-route-memory-major',
          ]),
          activeLevel: {
            totalLevels: 3,
            routeId: 'midnight-pizza-arcade',
            bossGate: 'independent',
          },
        },
      });
      expect(new Set(selectedBody.save.memories.map((memory: { id: string }) => memory.id)).size)
        .toBe(9);
      expect(selectedBody.save.memories.slice(-3).map((memory: { label: string }) => memory.label))
        .toEqual(['The glowing token', 'The giant prize', 'The midnight marquee']);
      const activeFixtureMemory = selectedBody.save.memories.at(-3);
      expect(activeFixtureMemory).toMatchObject({ state: 'released', mediaUrl: expect.any(String) });
      const fixtureMedia = await app.request(activeFixtureMemory.mediaUrl, { headers: { cookie } });
      expect(fixtureMedia.status).toBe(200);
      expect(fixtureMedia.headers.get('content-type')).toContain('image/svg+xml');
      expect(await fixtureMedia.text()).toContain('Fictional illustration');
      expect(selectedBody.save.adventure.activeLevel.encounters).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            content: expect.objectContaining({
              displayName: 'Midnight Pizza Gremlin',
              placeholder: 'neutral-candidate-v1',
              assetId: 'neutral-enemy-placeholder',
            }),
          }),
        ]),
      );

      const levelTwoStart = await preview(app, cookie, {
        project,
        chapterId: 'chapter-2',
        scope: 'chapter',
      });
      expect(levelTwoStart.status).toBe(201);
      let save = (await levelTwoStart.json()).save;
      const perform = async (action: Record<string, unknown>) => {
        const response = await app.request(
          `/api/saves/${save.id}/actions`,
          mutation(cookie, {
            actionId: randomUUID(),
            expectedRevision: save.revision,
            action,
          }),
        );
        expect(response.status, JSON.stringify(await response.clone().json())).toBe(200);
        save = await response.json();
        clockMs += 500;
      };
      const levelTwo = save.adventure.activeLevel;
      const attackTool = levelTwo.pickups.find(
        (pickup: { kind: string }) => pickup.kind === 'attack-tool',
      );
      await perform({
        type: 'collect-equipment',
        levelId: levelTwo.id,
        pickupId: attackTool.pickupId,
      });
      for (const memoryId of levelTwo.minorMemoryIds) {
        await perform({ type: 'recover-memory', levelId: levelTwo.id, memoryId });
      }
      const boss = levelTwo.encounters.find(
        (encounter: { role: string }) => encounter.role === 'boss',
      );
      while (!save.adventure.activeLevel.encounters.find(
        (encounter: { id: string }) => encounter.id === boss.id,
      ).defeated) {
        await perform({ type: 'attack', levelId: levelTwo.id, encounterId: boss.id });
      }
      await perform({
        type: 'recover-memory',
        levelId: levelTwo.id,
        memoryId: levelTwo.majorMemoryId,
      });
      expect(save.adventure).toMatchObject({
        activeLevelIndex: 2,
        phase: 'exploring',
        activeLevel: { routeId: 'midnight-pizza-arcade' },
      });
    });

    it('keeps candidate identities and progress isolated between concurrent world runs', async () => {
      const { app } = makeApp();
      const cookie = await startSession(app);
      const starts = await Promise.all([
        preview(app, cookie, {
          project: threeLevelWorldProject('Pepperoni Phantom'),
          chapterId: 'chapter-3',
          scope: 'chapter',
        }),
        preview(app, cookie, {
          project: threeLevelWorldProject('Mozzarella Meteor'),
          chapterId: 'chapter-3',
          scope: 'chapter',
        }),
      ]);
      expect(starts.map((response) => response.status)).toEqual([201, 201]);
      const [first, second] = await Promise.all(starts.map((response) => response.json()));
      expect(first.save.id).not.toBe(second.save.id);
      expect(first.fingerprint).not.toBe(second.fingerprint);
      expect(first.save.adventure.activeLevel.encounters[0].content.displayName)
        .toBe('Pepperoni Phantom');
      expect(second.save.adventure.activeLevel.encounters[0].content.displayName)
        .toBe('Mozzarella Meteor');

      const pickup = first.save.adventure.activeLevel.pickups.find(
        (entry: { kind: string }) => entry.kind === 'attack-tool',
      );
      const changed = await app.request(
        `/api/saves/${first.save.id}/actions`,
        mutation(cookie, {
          actionId: randomUUID(),
          expectedRevision: first.save.revision,
          action: {
            type: 'collect-equipment',
            levelId: first.save.adventure.activeLevel.id,
            pickupId: pickup.pickupId,
          },
        }),
      );
      expect(changed.status).toBe(200);
      const untouched = await app.request(`/api/saves/${second.save.id}`, { headers: { cookie } });
      expect((await untouched.json()).revision).toBe(second.save.revision);
    });

    it('rejects missing candidates, unprepared catalog art and project asset URLs before storage', async () => {
      const { app, store } = makeApp();
      const { cookie, playerId } = await openSession(app);
      const invalidProjects: unknown[] = [];
      const missingCandidate = structuredClone(threeLevelWorldProject()) as unknown as MutableWorldProjectDraft;
      missingCandidate.chapters[2]!.encounterSlots['ordinary-1']!.candidateId = 'missing-candidate';
      invalidProjects.push(missingCandidate);
      const pausedAsset = structuredClone(
        createWorldEditorProject({ projectId: 'paused-art' }),
      ) as unknown as MutableWorldProjectDraft;
      pausedAsset.chapters[0]!.encounterSlots['ordinary-2'] = {
        source: 'catalog',
        catalogEntryId: 'nap-captain',
        catalogEntryVersion: 'v001',
      };
      invalidProjects.push(pausedAsset);
      const embeddedUrl = structuredClone(threeLevelWorldProject()) as unknown as MutableWorldProjectDraft;
      embeddedUrl.enemyCandidates[0]!.assetUrl = 'https://example.test/creature.glb';
      invalidProjects.push(embeddedUrl);

      for (const project of invalidProjects) {
        const response = await preview(app, cookie, {
          project,
          chapterId: 'chapter-1',
          scope: 'adventure',
        });
        expect(response.status).toBe(422);
        expect((await response.json()).error.code).toBe('EDITOR_PROJECT_INVALID');
      }
      expect(await store.listSaves(playerId)).toEqual([]);
    });

    it('keeps editor plans behind the explicit fixture parser gate', () => {
      const prepared = prepareEditorPreview(threeLevelWorldProject());
      if (!prepared.ok || !prepared.bundle.world) throw new Error('Expected editor world');
      const state = createAdventureStateAtLevel(prepared.bundle.world.plan, 2);
      expect(() => parseStoredAdventure(prepared.bundle.world!.plan, state)).toThrow(
        'Save unavailable',
      );
      expect(parseStoredAdventure(
        prepared.bundle.world.plan,
        state,
        { allowEditorPreviewPlan: true },
      ).plan.version).toBe('editor-world-plan-v1');
    });
  });
});

describe('GET /editor', () => {
  it('serves the app shell for a direct and a deep link', async () => {
    const clientDir = await mkdtemp(join(tmpdir(), 'quest-editor-client-'));
    try {
      await writeFile(
        join(clientDir, 'index.html'),
        '<!doctype html><title>Haynes Quest</title>',
      );
      const { app } = makeApp({ clientDir });
      for (const path of ['/', '/editor', '/editor/', '/editor/projects/demo']) {
        const response = await app.request(path);
        expect(response.status, path).toBe(200);
        expect(await response.text()).toContain('Haynes Quest');
        expect(response.headers.get('cache-control')).toBe('no-store');
      }
      // The route exists on every surface; the client decides what it can offer.
      const persistent = createApp({
        store: new InMemoryQuestStore(),
        fixtureMode: true,
        sessionSecret: SECRET,
        appOrigin: ORIGIN,
        clientDir,
        studioDir: '/tmp/quest-studio-not-present',
      });
      expect((await persistent.request('/editor')).status).toBe(200);
    } finally {
      await rm(clientDir, { recursive: true, force: true });
    }
  });
});
