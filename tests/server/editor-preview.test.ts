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
  LEVEL_EDITOR_PROJECT_MAX_BYTES,
  parseLevelEditorProject,
  type LevelEditorProject,
} from '../../src/shared/editor-project.js';
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
