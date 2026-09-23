import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { playtestCues } from "../../src/client/audio";
import { equipmentArtwork, parodyArtwork } from "../../src/game/scene-catalog";
import { modelUrls } from "../../src/game/scene-assets";
import { FRIENDLY_CATALOG_V1 } from "../../src/shared/friendly";
import { PARODY_CANDIDATES } from "../../src/shared/parody-catalog";

interface MediaRecord {
  id?: string;
  path: string;
  bytes: number;
  sha256: string;
}

interface ArtworkManifest {
  catalog_version: string;
  archived_catalogs: string[];
  friendly_catalog: string;
  files: MediaRecord[];
  cues: MediaRecord[];
}

interface InventoryEntry {
  id: string;
  category: string;
  models: string[];
  audio: string[];
  state: string;
  gameplay_use?: "private-candidate";
  checksums: Record<string, string>;
}

interface Inventory {
  counts: Record<string, number>;
  assets: InventoryEntry[];
}

const mediaRoot = new URL("../../docs/assets/media/", import.meta.url);
const manifest = JSON.parse(
  readFileSync(new URL("playtest/v002/artwork.json", mediaRoot), "utf8"),
) as ArtworkManifest;
const inventory = JSON.parse(
  readFileSync(
    new URL("../../scripts/assets/catalog-inventory.json", import.meta.url),
    "utf8",
  ),
) as Inventory;

const friendlyIds = FRIENDLY_CATALOG_V1.map((entry) => entry.assetId);
const integratedModelIds = ["bestie-pink", "bestie-black", ...friendlyIds];
const integratedCueIds = Object.keys(playtestCues);

function mediaPath(url: string): string {
  const prefix = "/studio/assets/media/";
  expect(url.startsWith(prefix), `${url}: local asset media URL`).toBe(true);
  return url.slice(prefix.length);
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function expectExactFile(record: MediaRecord): void {
  const bytes = readFileSync(new URL(record.path, mediaRoot));
  expect(bytes.length, `${record.path}: exact byte count`).toBe(record.bytes);
  expect(sha256(bytes), `${record.path}: exact SHA-256`).toBe(record.sha256);
}

function inventoryEntryForPath(
  field: "models" | "audio",
  relativePath: string,
): InventoryEntry {
  const repositoryPath = `docs/assets/media/${relativePath}`;
  const matches = inventory.assets.filter((entry) =>
    entry[field].includes(repositoryPath),
  );
  expect(matches, `${relativePath}: one inventory owner`).toHaveLength(1);
  expect(matches[0]!.checksums[repositoryPath]).toMatch(/^[a-f0-9]{64}$/);
  return matches[0]!;
}

function runtimeModelPaths(): string[] {
  const paths = Object.values(modelUrls).map(mediaPath);
  for (const kind of ["attack-tool", "guard-tool"] as const)
    for (const tier of [1, 2])
      paths.push(mediaPath(equipmentArtwork(kind, tier).url));
  for (const entry of PARODY_CANDIDATES) {
    const artwork = parodyArtwork({
      catalogEntryId: entry.id,
      catalogEntryVersion: entry.version,
      assetId: entry.assetId,
      assetVersion: entry.assetVersion,
    });
    expect(artwork, `${entry.id}: current artwork`).not.toBeNull();
    if (!artwork) continue;
    if (artwork.kind === "single") paths.push(mediaPath(artwork.url));
    else paths.push(...artwork.models.map((model) => mediaPath(model.url)));
  }
  for (const entry of FRIENDLY_CATALOG_V1)
    paths.push(`${entry.assetId}/${entry.assetVersion}/${entry.assetId}.glb`);
  return [...new Set(paths)].sort();
}

describe("current playtest artwork manifest", () => {
  it("pins every runtime model to an exact inventoried file", () => {
    expect(manifest).toMatchObject({
      catalog_version: "parody-catalog-v3",
      archived_catalogs: ["parody-catalog-v1", "parody-catalog-v2"],
      friendly_catalog: "friendly-catalog-v1",
    });
    expect(inventory.counts).toMatchObject({
      entries: 57,
      fixture_illustration_sets: 1,
      reference_sheet_entries: 8,
      model_entries: 42,
      model_files: 42,
      completed_model_candidates: 40,
      paused_partial_model_candidates: 2,
      concept_only_entries: 2,
      audio_entries: 4,
      owner_approved_entries: 1,
    });
    expect(
      inventory.assets
        .filter(
          (entry) =>
            entry.models.length > 0 &&
            /paused partial model/i.test(entry.state),
        )
        .map((entry) => entry.id)
        .sort(),
    ).toEqual(["nap-captain", "rat-pit-boss-v001-checkpoint"]);

    const expectedPaths = runtimeModelPaths();
    expect(expectedPaths).toHaveLength(23);
    expect(manifest.files.map((file) => file.path).sort()).toEqual(
      expectedPaths,
    );
    expect(new Set(manifest.files.map((file) => file.path)).size).toBe(23);

    for (const record of manifest.files) {
      expectExactFile(record);
      const entry = inventoryEntryForPath("models", record.path);
      expect(entry.checksums[`docs/assets/media/${record.path}`]).toBe(
        record.sha256,
      );
    }

    for (const id of integratedModelIds) {
      const entry = inventory.assets.find((candidate) => candidate.id === id);
      expect(entry, `${id}: gameplay model inventory entry`).toBeDefined();
      expect(entry!.gameplay_use).toBe("private-candidate");
    }
  });

  it("pins all four runtime cues to exact inventoried files", () => {
    expect(manifest.cues).toHaveLength(4);
    expect(manifest.cues.map((cue) => cue.id).sort()).toEqual(
      [...integratedCueIds].sort(),
    );
    expect(new Set(manifest.cues.map((cue) => cue.path)).size).toBe(4);

    for (const record of manifest.cues) {
      const cue = playtestCues[record.id as keyof typeof playtestCues];
      expect(cue, `${record.id}: runtime cue`).toBeDefined();
      expect(record.path).toBe(mediaPath(cue.path));
      expect(record.sha256).toBe(cue.sha256);
      expectExactFile(record);
      const entry = inventoryEntryForPath("audio", record.path);
      expect(entry.id).toBe(record.id);
      expect(entry.gameplay_use).toBe("private-candidate");
      expect(entry.checksums[`docs/assets/media/${record.path}`]).toBe(
        record.sha256,
      );
    }
  });
});
