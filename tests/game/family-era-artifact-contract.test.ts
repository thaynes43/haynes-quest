/**
 * Runtime artifact contract for the family-era enemies registered in
 * parody-catalog-v8 (DESIGN-026, WO111). Each exact GLB must match its
 * delivery log, checksum manifest and catalog inventory, stay inside the
 * enemy budget and give the enemy animation adapter what it needs: five named
 * clips, a stationary floor-centred root, the measured height the scene puts
 * the health bar above, and an attack contact fraction derived from the
 * logged contact time.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parodyArtwork } from "../../src/game/scene-catalog";
import { PARODY_CATALOGS } from "../../src/shared/parody-catalog";

const REQUIRED_CLIPS = ["attack", "defeat", "hit", "idle", "move"];
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;
const MAX_GLB_BYTES = 2 * 1024 * 1024;
const MAX_MATERIALS = 2;
const MAX_PRIMITIVES = 2;
const MAX_TRIANGLES = 15_000;

/** Exact values read from each delivered GLB at intake. */
const EXACT: Record<
  string,
  { bytes: number; bufferBytes: number; triangles: number; textures: number }
> = {
  "clubhouse-bully-cat": { bytes: 1_073_732, bufferBytes: 1_001_204, triangles: 14_492, textures: 2 },
  "honk-bus": { bytes: 1_105_872, bufferBytes: 1_073_432, triangles: 14_642, textures: 2 },
};

interface Delivery {
  assetId: string;
  version: string;
  role: string;
  glb: string;
  sha256: string;
  heightM: number;
  attackContactS: number;
  clips: { name: string; duration_s: number }[];
  manifest: string;
  bounds: { rest: { min: number[]; max: number[] } };
}

interface GlbDocument {
  accessors: { bufferView: number; byteOffset?: number; componentType: number; count: number; type: string; min?: number[]; max?: number[] }[];
  animations: { name: string; samplers: { input: number }[] }[];
  bufferViews: { buffer?: number; byteOffset?: number; byteLength: number; byteStride?: number }[];
  buffers: { byteLength: number; uri?: string }[];
  extensionsRequired?: string[];
  images: { bufferView?: number; uri?: string }[];
  materials: unknown[];
  meshes: { primitives: { attributes: { POSITION: number }; indices?: number; mode?: number }[] }[];
  nodes: { mesh?: number; matrix?: number[]; rotation?: number[]; scale?: number[]; translation?: number[] }[];
  scenes: { extras?: Record<string, unknown> }[];
  skins: unknown[];
  textures: unknown[];
}

const deliveries = (
  JSON.parse(
    readFileSync(new URL("../../.agents/evidence/era-cast-deliveries.json", import.meta.url), "utf8"),
  ) as { deliveries: Delivery[] }
).deliveries;
const inventory = JSON.parse(
  readFileSync(new URL("../../scripts/assets/catalog-inventory.json", import.meta.url), "utf8"),
) as { assets: { id: string; version: string; models: string[]; gameplay_use?: string; checksums: Record<string, string> }[] };

/** The v8 additions: every entry v7 does not list. */
const v7Ids = new Set(PARODY_CATALOGS["parody-catalog-v7"].map((entry) => entry.id));
const additions = PARODY_CATALOGS["parody-catalog-v8"].filter((entry) => !v7Ids.has(entry.id));

function repoFile(path: string): Buffer {
  return readFileSync(new URL(`../../${path}`, import.meta.url));
}

function parseGlb(bytes: Buffer): { document: GlbDocument; binary: Buffer } {
  expect(bytes.toString("utf8", 0, 4)).toBe("glTF");
  expect(bytes.readUInt32LE(4)).toBe(2);
  expect(bytes.readUInt32LE(8)).toBe(bytes.length);
  let document: GlbDocument | undefined;
  let binary: Buffer | undefined;
  let offset = 12;
  while (offset < bytes.length) {
    const length = bytes.readUInt32LE(offset);
    const type = bytes.readUInt32LE(offset + 4);
    const chunk = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === JSON_CHUNK) document = JSON.parse(chunk.toString("utf8").trimEnd()) as GlbDocument;
    if (type === BIN_CHUNK) binary = chunk;
    offset += 8 + length;
  }
  expect(offset).toBe(bytes.length);
  if (!document || !binary) throw new Error("GLB is missing its JSON or binary chunk");
  return { document, binary };
}

function floats(document: GlbDocument, binary: Buffer, index: number): number[][] {
  const accessor = document.accessors[index]!;
  expect(accessor.componentType).toBe(5126);
  const components = accessor.type === "SCALAR" ? 1 : accessor.type === "VEC3" ? 3 : 0;
  expect(components).toBeGreaterThan(0);
  const view = document.bufferViews[accessor.bufferView]!;
  expect(view.buffer ?? 0).toBe(0);
  const stride = view.byteStride ?? components * 4;
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  return Array.from({ length: accessor.count }, (_unused, item) =>
    Array.from({ length: components }, (_none, component) =>
      binary.readFloatLE(start + item * stride + component * 4),
    ),
  );
}

describe("family-era enemy artifacts registered in parody-catalog-v8", () => {
  it("adds exactly the delivered family-era models", () => {
    expect(additions.map((entry) => `${entry.assetId}@${entry.assetVersion}`)).toEqual([
      "clubhouse-bully-cat@v001",
      "honk-bus@v001",
    ]);
    for (const entry of additions)
      expect(deliveries.some((delivery) => delivery.assetId === entry.assetId && delivery.version === entry.assetVersion)).toBe(true);
  });

  for (const entry of additions) {
    it(`${entry.assetId}@${entry.assetVersion} matches its delivery log, manifest, inventory and runtime registration`, () => {
      const delivery = deliveries.find(
        (candidate) => candidate.assetId === entry.assetId && candidate.version === entry.assetVersion,
      )!;
      const exact = EXACT[entry.assetId];
      expect(exact, `${entry.assetId}: exact intake values`).toBeDefined();
      expect(delivery.role).toBe(entry.role);
      const glbPath = `docs/assets/media/${entry.assetId}/${entry.assetVersion}/${entry.assetId}.glb`;
      expect(delivery.glb).toBe(glbPath);
      expect(existsSync(new URL(`../../${glbPath}`, import.meta.url))).toBe(true);

      // The scene loads exactly this published file.
      const clips = Object.fromEntries(delivery.clips.map((clip) => [clip.name, clip.duration_s]));
      const contactFraction = delivery.attackContactS / clips.attack!;
      expect(
        parodyArtwork({
          catalogEntryId: entry.id,
          catalogEntryVersion: entry.version,
          assetId: entry.assetId,
          assetVersion: entry.assetVersion,
        }),
      ).toEqual({
        id: entry.assetId,
        kind: "single",
        contactFraction,
        height: delivery.heightM,
        url: `/studio/${glbPath.replace(/^docs\//, "")}`,
      });

      // Bytes and checksums agree across the GLB, manifest and inventory.
      const bytes = repoFile(glbPath);
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      expect(bytes.length).toBe(exact!.bytes);
      expect(bytes.length).toBeLessThanOrEqual(MAX_GLB_BYTES);
      expect(sha256).toBe(delivery.sha256);
      const manifest = JSON.parse(repoFile(delivery.manifest).toString("utf8")) as {
        asset_id: string;
        version: string;
        files: { path: string; bytes: number; sha256: string }[];
      };
      expect(manifest).toMatchObject({ asset_id: entry.assetId, version: entry.assetVersion });
      expect(manifest.files.filter((file) => file.path === `${entry.assetId}.glb`)).toEqual([
        expect.objectContaining({ bytes: exact!.bytes, sha256 }),
      ]);
      const inventoried = inventory.assets.find((asset) => asset.id === entry.assetId);
      expect(inventoried).toMatchObject({ version: entry.assetVersion, gameplay_use: "private-candidate" });
      expect(inventoried!.models).toContain(glbPath);
      expect(inventoried!.checksums[glbPath]).toBe(sha256);

      // Budget and self-contained resources.
      const { document, binary } = parseGlb(bytes);
      const primitives = document.meshes.flatMap((mesh) => mesh.primitives);
      const triangles = primitives.reduce((total, primitive) => {
        expect(primitive.mode ?? 4).toBe(4);
        const count = document.accessors[primitive.indices ?? primitive.attributes.POSITION]!.count;
        expect(count % 3).toBe(0);
        return total + count / 3;
      }, 0);
      expect(document.buffers).toEqual([{ byteLength: exact!.bufferBytes }]);
      expect(document.images).toHaveLength(1);
      expect(document.images.every((image) => image.uri === undefined && Number.isInteger(image.bufferView))).toBe(true);
      expect(document.textures).toHaveLength(exact!.textures);
      expect(document.materials.length).toBeLessThanOrEqual(MAX_MATERIALS);
      expect(primitives.length).toBeLessThanOrEqual(MAX_PRIMITIVES);
      expect(triangles).toBe(exact!.triangles);
      expect(triangles).toBeLessThanOrEqual(MAX_TRIANGLES);
      expect(document.skins).toHaveLength(1);
      expect(document.extensionsRequired ?? []).toEqual([]);
      // The exported scene names this asset, not an earlier author's scene.
      expect(document.scenes[0]!.extras).toMatchObject({
        asset_id: entry.assetId,
        asset_version: entry.assetVersion,
        work_order: "WO111",
      });

      // Five clips with the logged durations.
      expect(document.animations.map((animation) => animation.name).sort()).toEqual(REQUIRED_CLIPS);
      expect(Object.keys(clips).sort()).toEqual(REQUIRED_CLIPS);
      for (const animation of document.animations) {
        const times = [...new Set(animation.samplers.map((sampler) => sampler.input))].flatMap((index) =>
          floats(document, binary, index).map(([time]) => time!),
        );
        expect(Math.max(...times)).toBeCloseTo(clips[animation.name]!, 5);
      }
      expect(contactFraction).toBeGreaterThan(0);
      expect(contactFraction).toBeLessThan(1);

      // A floor-centred identity root whose rest geometry spans the logged height.
      for (const node of document.nodes.filter((candidate) => candidate.mesh !== undefined)) {
        expect(node.matrix).toBeUndefined();
        expect(node.translation ?? [0, 0, 0]).toEqual([0, 0, 0]);
        expect(node.rotation ?? [0, 0, 0, 1]).toEqual([0, 0, 0, 1]);
        expect(node.scale ?? [1, 1, 1]).toEqual([1, 1, 1]);
      }
      const heights = [...new Set(primitives.map((primitive) => primitive.attributes.POSITION))].flatMap((index) =>
        floats(document, binary, index).map((position) => position[1]!),
      );
      expect(Math.min(...heights)).toBeCloseTo(0, 5);
      expect(Math.max(...heights)).toBeCloseTo(delivery.heightM, 5);
      expect(Math.max(...heights)).toBeCloseTo(delivery.bounds.rest.max[1]!, 5);
    });
  }
});
