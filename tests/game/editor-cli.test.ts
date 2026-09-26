import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { AUTHORED_LEVEL_LIMITS } from "../../src/shared/authored-level";
import {
  LEVEL_EDITOR_ANCHOR_SLOTS,
  LEVEL_EDITOR_PROJECT_MAX_BYTES,
  parseLevelEditorProjectJson,
} from "../../src/shared/editor-project";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
const exampleCommands = join(
  repositoryRoot,
  "scripts/levels/examples/editor-commands-v1.json",
);

function runEditor(...args: string[]) {
  const result = spawnSync(
    "pnpm",
    ["exec", "tsx", "scripts/levels/editor.ts", ...args],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
    },
  );
  if (result.error) throw result.error;
  return result;
}

interface Vector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

interface InspectedPlatform {
  readonly id: string;
  readonly type: "platform" | "moving-platform";
  readonly center: Vector3;
  readonly size: Vector3;
  readonly topY: number;
  readonly mainPathIndex: number | null;
  readonly branchIndices: readonly number[];
  readonly optional: boolean;
  readonly checkpointIds: readonly string[];
  readonly safeMissFor: readonly number[];
  readonly motion?: {
    readonly axis: "x" | "z";
    readonly distance: number;
    readonly period: number;
  };
}

interface InspectedAnchor {
  readonly slot: string;
  readonly platformId: string;
  readonly position: Vector3;
  readonly kind?: string;
  readonly checkpointId?: string;
  readonly arena?: {
    readonly minX: number;
    readonly maxX: number;
    readonly minZ: number;
    readonly maxZ: number;
  };
}

interface InspectedChapter {
  readonly chapterId: string;
  readonly encounterSlots?: Readonly<Record<string, unknown>>;
  readonly platforms: number;
  readonly connections: number;
  readonly branches: number;
  readonly spatial: {
    readonly bounds: {
      readonly horizontal: {
        readonly minX: number;
        readonly maxX: number;
        readonly minZ: number;
        readonly maxZ: number;
        readonly spanX: number;
        readonly spanZ: number;
      };
      readonly platformTop: { readonly min: number; readonly max: number };
    } | null;
    readonly platforms: readonly InspectedPlatform[];
    readonly routes: {
      readonly mainPath: readonly string[];
      readonly branches: readonly (readonly string[])[];
    };
    readonly connections: readonly {
      readonly index: number;
      readonly from: string;
      readonly to: string;
      readonly mode: string;
      readonly safeMissPlatformId?: string;
    }[];
    readonly anchors: readonly InspectedAnchor[];
  };
}

interface Inspection {
  readonly revision: number;
  readonly limits: Record<string, number>;
  readonly chapters: readonly InspectedChapter[];
  readonly issues: readonly { readonly code: string }[];
}

function inspectProject(path: string): Inspection {
  const result = runEditor("inspect", path);
  expect(result.status).toBe(0);
  expect(result.stderr).toBe("");
  return JSON.parse(result.stdout) as Inspection;
}

function platformById(chapter: InspectedChapter, id: string): InspectedPlatform {
  const platform = chapter.spatial.platforms.find((entry) => entry.id === id);
  if (!platform) throw new Error(`Inspection reported no platform ${id}`);
  return platform;
}

function anchorBySlot(chapter: InspectedChapter, slot: string): InspectedAnchor {
  const anchor = chapter.spatial.anchors.find((entry) => entry.slot === slot);
  if (!anchor) throw new Error(`Inspection reported no anchor ${slot}`);
  return anchor;
}

function boundsOf(chapter: InspectedChapter) {
  const { bounds } = chapter.spatial;
  if (!bounds)
    throw new Error(`Inspection reported no bounds for ${chapter.chapterId}`);
  return bounds;
}

async function applyBatch(
  directory: string,
  projectPath: string,
  label: string,
  batch: Record<string, unknown>,
): Promise<string> {
  const batchPath = join(directory, `${label}-commands.json`);
  await writeFile(batchPath, JSON.stringify(batch), "utf8");
  const result = runEditor("apply", projectPath, batchPath);
  expect(result.stderr).toBe("");
  const application = JSON.parse(result.stdout) as {
    ok: boolean;
    project: unknown;
    issues: readonly unknown[];
  };
  expect(application).toMatchObject({ ok: true });
  const nextPath = join(directory, `${label}.json`);
  await writeFile(nextPath, JSON.stringify(application.project), "utf8");
  return nextPath;
}

describe("level editor CLI", () => {
  it("templates, describes, edits, validates and exports one portable project", async () => {
    const directory = await mkdtemp(join(tmpdir(), "quest-editor-cli-"));
    try {
      const projectPath = join(directory, "project.json");
      const editedPath = join(directory, "edited.json");
      const invalidPath = join(directory, "invalid.json");

      const template = runEditor(
        "template",
        "cli-project",
        "CLI adventure",
      );
      expect(template.status).toBe(0);
      expect(template.stderr).toBe("");
      const originalProject = parseLevelEditorProjectJson(template.stdout);
      expect(originalProject).toMatchObject({
        projectId: "cli-project",
        name: "CLI adventure",
        revision: 0,
      });
      await writeFile(projectPath, template.stdout, "utf8");

      const projectSchema = runEditor("schema", "project");
      expect(projectSchema.status).toBe(0);
      expect(projectSchema.stderr).toBe("");
      expect(JSON.parse(projectSchema.stdout)).toEqual(
        expect.objectContaining({ type: "object" }),
      );
      expect(projectSchema.stdout).toContain("chapters");

      const commandSchema = runEditor("schema");
      expect(commandSchema.status).toBe(0);
      expect(commandSchema.stderr).toBe("");
      expect(JSON.parse(commandSchema.stdout)).toEqual(
        expect.objectContaining({ type: "object" }),
      );
      expect(commandSchema.stdout).toContain("expectedRevision");

      const inspection = runEditor("inspect", projectPath);
      expect(inspection.status).toBe(0);
      expect(inspection.stderr).toBe("");
      expect(JSON.parse(inspection.stdout)).toMatchObject({
        projectId: "cli-project",
        name: "CLI adventure",
        revision: 0,
        chapters: [
          {
            chapterId: "chapter-1",
            templateRouteId: "garden-playground-v2",
          },
          {
            chapterId: "chapter-2",
            templateRouteId: "besties-playground-v2",
          },
        ],
        issues: [],
      });

      const apply = runEditor(
        "apply",
        projectPath,
        exampleCommands,
      );
      expect(apply.status).toBe(0);
      expect(apply.stderr).toBe("");
      const application = JSON.parse(apply.stdout) as {
        ok: boolean;
        project: unknown;
        issues: unknown[];
      };
      expect(application).toMatchObject({ ok: true, issues: [] });
      const editedProject = parseLevelEditorProjectJson(
        JSON.stringify(application.project),
      );
      expect(editedProject).toMatchObject({
        name: "Agent garden remix",
        revision: 1,
      });
      await writeFile(editedPath, JSON.stringify(application.project), "utf8");
      expect(await readFile(projectPath, "utf8")).toBe(template.stdout);

      const validation = runEditor("validate", editedPath);
      expect(validation.status).toBe(0);
      expect(validation.stderr).toBe("");
      expect(JSON.parse(validation.stdout)).toEqual({ ok: true, issues: [] });

      const exported = runEditor("export", editedPath);
      expect(exported.status).toBe(0);
      expect(exported.stderr).toBe("");
      expect(parseLevelEditorProjectJson(exported.stdout)).toEqual(
        editedProject,
      );

      const conflict = runEditor("apply", editedPath, exampleCommands);
      expect(conflict.status).toBe(1);
      expect(conflict.stderr).toBe("");
      expect(JSON.parse(conflict.stdout)).toMatchObject({
        ok: false,
        project: { revision: 1 },
        issues: [{ source: "command", code: "revision.conflict" }],
      });

      await writeFile(invalidPath, "{", "utf8");
      const malformed = runEditor("validate", invalidPath);
      expect(malformed.status).toBe(1);
      expect(malformed.stdout).toBe("");
      expect(JSON.parse(malformed.stderr)).toMatchObject({
        ok: false,
        issues: [{ source: "structure", code: "json.syntax" }],
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }, 30_000);

  it("adds, places, assigns, exports and removes an optional encounter", async () => {
    const directory = await mkdtemp(join(tmpdir(), "quest-editor-bonus-"));
    try {
      const projectPath = join(directory, "project.json");
      const template = runEditor(
        "world-template",
        "bonus-cli-project",
        "Bonus CLI project",
      );
      expect(template.status).toBe(0);
      expect(template.stderr).toBe("");
      await writeFile(projectPath, template.stdout, "utf8");

      const addedPath = await applyBatch(directory, projectPath, "bonus-added", {
        expectedRevision: 0,
        commands: [
          {
            type: "encounter.bonus.add",
            chapterId: "chapter-1",
            anchor: {
              platformId: "woodland-side-1",
              position: { x: 7, y: 0, z: -60.8 },
              kind: "ordinary-a",
              checkpointId: "woodland-safe",
              arena: { minX: 5.4, maxX: 8.6, minZ: -62.6, maxZ: -59 },
            },
            encounter: {
              source: "catalog",
              catalogEntryId: "mister-hiss",
              catalogEntryVersion: "v001",
            },
          },
        ],
      });
      const placedPath = await applyBatch(directory, addedPath, "bonus-placed", {
        expectedRevision: 1,
        commands: [
          {
            type: "encounter.assign",
            chapterId: "chapter-1",
            slot: "bonus-1",
            encounter: {
              source: "catalog",
              catalogEntryId: "mister-hiss",
              catalogEntryVersion: "v001",
            },
          },
          {
            type: "anchor.move",
            chapterId: "chapter-1",
            slot: "encounter.bonus-1",
            position: { x: 6.9, y: 0, z: -60.8 },
          },
        ],
      });

      const inspected = inspectProject(placedPath);
      expect(inspected.revision).toBe(2);
      expect(inspected.issues).toEqual([]);
      expect(anchorBySlot(inspected.chapters[0]!, "encounter.bonus-1"))
        .toMatchObject({
          platformId: "woodland-side-1",
          kind: "ordinary-a",
          position: { x: 6.9, y: 0, z: -60.8 },
        });
      expect(inspected.chapters[0]?.encounterSlots?.["bonus-1"]).toEqual({
        source: "catalog",
        catalogEntryId: "mister-hiss",
        catalogEntryVersion: "v001",
      });

      const exported = runEditor("export", placedPath);
      expect(exported.status).toBe(0);
      expect(exported.stderr).toBe("");
      const imported = parseLevelEditorProjectJson(exported.stdout);
      expect(imported.chapters[0]?.level.anchors.encounters["bonus-1"])
        .toBeDefined();

      const removedPath = await applyBatch(directory, placedPath, "bonus-removed", {
        expectedRevision: 2,
        commands: [{ type: "encounter.bonus.remove", chapterId: "chapter-1" }],
      });
      const removed = inspectProject(removedPath);
      expect(removed.issues).toEqual([]);
      expect(
        removed.chapters[0]?.spatial.anchors.some(
          (anchor) => anchor.slot === "encounter.bonus-1",
        ),
      ).toBe(false);
      expect(removed.chapters[0]?.encounterSlots?.["bonus-1"]).toBeUndefined();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }, 30_000);

  it("reports bounded spatial data for shifted, elevated and invalid geometry", async () => {
    const directory = await mkdtemp(join(tmpdir(), "quest-editor-space-"));
    try {
      const projectPath = join(directory, "project.json");
      const template = runEditor("template", "spatial-project", "Spatial project");
      expect(template.status).toBe(0);
      await writeFile(projectPath, template.stdout, "utf8");

      const baseline = inspectProject(projectPath);
      expect(baseline.limits).toEqual({ ...AUTHORED_LEVEL_LIMITS });

      const garden = baseline.chapters[0];
      expect(garden.spatial.platforms).toHaveLength(garden.platforms);
      expect(garden.spatial.connections).toHaveLength(garden.connections);
      expect(garden.spatial.routes.branches).toHaveLength(garden.branches);
      expect(garden.spatial.anchors.map((anchor) => anchor.slot)).toEqual(
        LEVEL_EDITOR_ANCHOR_SLOTS.filter(
          (slot) => slot !== "encounter.bonus-1",
        ),
      );
      expect(
        garden.spatial.connections.map((connection) => connection.index),
      ).toEqual(garden.spatial.connections.map((_, index) => index));

      // Route membership tells a builder which geometry is required, which is
      // branch scenery and which is optional v2 collision geometry.
      expect(platformById(garden, "welcome")).toMatchObject({
        mainPathIndex: 0,
        branchIndices: [],
        optional: false,
        checkpointIds: ["garden-start"],
        topY: 0,
      });
      expect(platformById(garden, "woodland-side-2")).toMatchObject({
        mainPathIndex: null,
        branchIndices: [0],
        optional: false,
      });
      expect(platformById(garden, "garden-practice-ground")).toMatchObject({
        mainPathIndex: null,
        branchIndices: [],
        optional: true,
      });
      // Route-optional does not mean free to move: the catch deck names every
      // jump it rescues, so a builder reading `optional` alone cannot mistake
      // it for scenery.
      const catchDeck = platformById(garden, "garden-practice-ground");
      expect(catchDeck.safeMissFor).toEqual(
        garden.spatial.connections
          .filter(
            (connection) =>
              connection.safeMissPlatformId === "garden-practice-ground",
          )
          .map((connection) => connection.index),
      );
      expect(catchDeck.safeMissFor.length).toBeGreaterThan(0);
      for (const index of catchDeck.safeMissFor)
        expect(garden.spatial.connections[index]).toMatchObject({
          index,
          safeMissPlatformId: "garden-practice-ground",
        });
      expect(platformById(garden, "welcome").safeMissFor).toEqual([]);
      const ferry = platformById(garden, "garden-ferry");
      expect(ferry.type).toBe("moving-platform");
      expect(ferry.motion?.distance).toBeGreaterThan(0);

      const gardenBounds = boundsOf(garden);
      const gardenTops = garden.spatial.platforms.map(
        (platform) => platform.topY,
      );
      expect(gardenBounds.platformTop).toEqual({
        min: Math.min(...gardenTops),
        max: Math.max(...gardenTops),
      });
      expect(gardenBounds.horizontal.spanX).toBeCloseTo(
        gardenBounds.horizontal.maxX - gardenBounds.horizontal.minX,
        6,
      );
      expect(gardenBounds.horizontal.spanZ).toBeCloseTo(
        gardenBounds.horizontal.maxZ - gardenBounds.horizontal.minZ,
        6,
      );
      for (const platform of garden.spatial.platforms) {
        expect(platform.center.x - platform.size.x / 2).toBeGreaterThanOrEqual(
          gardenBounds.horizontal.minX,
        );
        expect(platform.center.x + platform.size.x / 2).toBeLessThanOrEqual(
          gardenBounds.horizontal.maxX,
        );
        expect(platform.center.z - platform.size.z / 2).toBeGreaterThanOrEqual(
          gardenBounds.horizontal.minZ,
        );
        expect(platform.center.z + platform.size.z / 2).toBeLessThanOrEqual(
          gardenBounds.horizontal.maxZ,
        );
      }

      expect(anchorBySlot(garden, "spawn").platformId).toBe(
        garden.spatial.routes.mainPath[0],
      );
      expect(anchorBySlot(garden, "finish").platformId).toBe(
        garden.spatial.routes.mainPath.at(-1),
      );
      const boss = anchorBySlot(garden, "encounter.boss");
      expect(boss.kind).toBe("boss");
      const bossSupport = platformById(garden, boss.platformId);
      expect(bossSupport.checkpointIds).toContain(boss.checkpointId);
      expect(boss.arena?.minX).toBeGreaterThanOrEqual(
        bossSupport.center.x - bossSupport.size.x / 2,
      );
      expect(boss.arena?.maxZ).toBeLessThanOrEqual(
        bossSupport.center.z + bossSupport.size.z / 2,
      );

      // Shift one main-path platform up and hang an optional climbing stack
      // beside the course; both stay inside the authored rise and gap limits.
      const hop = platformById(garden, "garden-hop-3");
      const elevatedPath = await applyBatch(
        directory,
        projectPath,
        "elevated",
        {
          expectedRevision: baseline.revision,
          commands: [
            {
              type: "piece.move",
              chapterId: "chapter-1",
              pieceId: hop.id,
              position: { ...hop.center, y: hop.center.y + 0.05 },
            },
            {
              type: "piece.add",
              chapterId: "chapter-1",
              piece: {
                type: "platform",
                id: "sky-step-1",
                center: { x: 9, y: 0.7, z: -2 },
                size: { x: 4, y: 0.6, z: 4 },
              },
            },
            {
              type: "piece.add",
              chapterId: "chapter-1",
              piece: {
                type: "platform",
                id: "sky-step-2",
                center: { x: 9, y: 1, z: -6.4 },
                size: { x: 4, y: 0.6, z: 4 },
              },
            },
            {
              type: "piece.add",
              chapterId: "chapter-1",
              piece: {
                type: "platform",
                id: "sky-step-3",
                center: { x: 9, y: 1.3, z: -10.8 },
                size: { x: 4, y: 0.6, z: 4 },
              },
            },
            {
              type: "connection.add",
              chapterId: "chapter-1",
              connection: { from: "sky-step-1", to: "sky-step-2", mode: "jump" },
            },
            {
              type: "connection.add",
              chapterId: "chapter-1",
              connection: { from: "sky-step-2", to: "sky-step-3", mode: "jump" },
            },
          ],
        },
      );

      const elevated = inspectProject(elevatedPath);
      expect(elevated.revision).toBe(baseline.revision + 1);
      expect(elevated.issues).toEqual([]);
      const elevatedGarden = elevated.chapters[0];

      const elevatedHop = platformById(elevatedGarden, "garden-hop-3");
      expect(elevatedHop).toMatchObject({
        center: { ...hop.center, y: hop.center.y + 0.05 },
        size: hop.size,
        mainPathIndex: hop.mainPathIndex,
        optional: false,
      });
      // Derived metres are reported free of floating-point noise.
      expect(elevatedHop.topY).toBe(Number((hop.topY + 0.05).toFixed(6)));

      const stack = ["sky-step-1", "sky-step-2", "sky-step-3"].map((id) =>
        platformById(elevatedGarden, id),
      );
      expect(stack.map((platform) => platform.mainPathIndex)).toEqual([
        null,
        null,
        null,
      ]);
      expect(stack.map((platform) => platform.branchIndices)).toEqual([
        [],
        [],
        [],
      ]);
      expect(stack.map((platform) => platform.optional)).toEqual([
        true,
        true,
        true,
      ]);
      expect(stack.map((platform) => platform.safeMissFor)).toEqual([
        [],
        [],
        [],
      ]);
      expect(stack.map((platform) => platform.topY)).toEqual([1, 1.3, 1.6]);
      for (let index = 1; index < stack.length; index += 1)
        expect(stack[index].topY - stack[index - 1].topY).toBeLessThanOrEqual(
          elevated.limits.maxConnectionRise,
        );

      const elevatedBounds = boundsOf(elevatedGarden);
      expect(elevatedBounds.platformTop.max).toBe(1.6);
      expect(elevatedBounds.platformTop.max).toBeGreaterThan(
        gardenBounds.platformTop.max,
      );
      // The stack climbs without widening the course footprint.
      expect(elevatedBounds.horizontal).toEqual(gardenBounds.horizontal);

      expect(elevatedGarden.spatial.connections.slice(-2)).toEqual([
        {
          index: garden.spatial.connections.length,
          from: "sky-step-1",
          to: "sky-step-2",
          mode: "jump",
        },
        {
          index: garden.spatial.connections.length + 1,
          from: "sky-step-2",
          to: "sky-step-3",
          mode: "jump",
        },
      ]);
      expect(elevatedGarden.spatial.routes).toEqual(garden.spatial.routes);
      expect(elevated.chapters[1].spatial).toEqual(
        baseline.chapters[1].spatial,
      );

      // A draft that breaks the rise limit still reports its whole geometry,
      // so a builder can see where the offending platform actually sits.
      const brokenPath = await applyBatch(directory, elevatedPath, "broken", {
        expectedRevision: elevated.revision,
        commands: [
          {
            type: "piece.move",
            chapterId: "chapter-1",
            pieceId: "sky-step-2",
            position: { x: 9, y: 4, z: -6.4 },
          },
        ],
      });
      const broken = inspectProject(brokenPath);
      expect(broken.issues.map((issue) => issue.code)).toEqual([
        "connection.rise",
        "connection.rise",
      ]);
      const brokenGarden = broken.chapters[0];
      expect(platformById(brokenGarden, "sky-step-2").topY).toBe(4.3);
      expect(boundsOf(brokenGarden).platformTop.max).toBe(4.3);
      expect(brokenGarden.spatial.platforms).toHaveLength(
        elevatedGarden.spatial.platforms.length,
      );
      expect(brokenGarden.spatial.anchors).toHaveLength(
        LEVEL_EDITOR_ANCHOR_SLOTS.length - 1,
      );

      const malformedPath = join(directory, "malformed.json");
      await writeFile(malformedPath, "{", "utf8");
      const malformed = runEditor("inspect", malformedPath);
      expect(malformed.status).toBe(1);
      expect(malformed.stdout).toBe("");
      expect(JSON.parse(malformed.stderr)).toMatchObject({
        ok: false,
        issues: [{ source: "structure", code: "json.syntax" }],
      });

      const truncatedPath = join(directory, "truncated.json");
      const truncated = JSON.parse(template.stdout) as {
        chapters: readonly unknown[];
      };
      await writeFile(
        truncatedPath,
        JSON.stringify({ ...truncated, chapters: truncated.chapters.slice(0, 1) }),
        "utf8",
      );
      const structural = runEditor("inspect", truncatedPath);
      expect(structural.status).toBe(1);
      expect(structural.stdout).toBe("");
      expect(JSON.parse(structural.stderr)).toMatchObject({
        ok: false,
        issues: [{ source: "structure", path: "$.chapters" }],
      });

      const oversizedPath = join(directory, "oversized.json");
      await writeFile(
        oversizedPath,
        JSON.stringify({ padding: "x".repeat(LEVEL_EDITOR_PROJECT_MAX_BYTES) }),
        "utf8",
      );
      const oversized = runEditor("inspect", oversizedPath);
      expect(oversized.status).toBe(1);
      expect(oversized.stdout).toBe("");
      expect(JSON.parse(oversized.stderr)).toMatchObject({
        ok: false,
        issues: [{ source: "structure", code: "size.limit" }],
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }, 90_000);

  it("starts a world on a pinned parody catalog", () => {
    const current = runEditor("world-template", "catalog-cli");
    expect(current.status).toBe(0);
    expect(parseLevelEditorProjectJson(current.stdout)).toMatchObject({ catalogVersion: "parody-catalog-v5" });
    for (const args of [
      ["catalog-cli", "Family world", "--catalog", "parody-catalog-v7"],
      ["--catalog", "parody-catalog-v7", "catalog-cli", "Family world"],
    ]) {
      const pinned = runEditor("world-template", ...args);
      expect(pinned.status, args.join(" ")).toBe(0);
      const project = parseLevelEditorProjectJson(pinned.stdout);
      expect(project).toMatchObject({ catalogVersion: "parody-catalog-v7", name: "Family world" });
    }
    const unknown = runEditor("world-template", "catalog-cli", "--catalog", "parody-catalog-v99");
    expect(unknown.status).toBe(1);
    expect(unknown.stdout).toBe("");
    expect(unknown.stderr).toContain("Unknown catalog");
    const missing = runEditor("world-template", "catalog-cli", "--catalog");
    expect(missing.status).toBe(1);
  }, 60_000);
});
