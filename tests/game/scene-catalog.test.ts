import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { equipmentArtwork } from "../../src/game/scene-catalog";

function exportedModel(url: string) {
  const relative = url.replace(/^\/studio\//, "");
  const bytes = readFileSync(
    new URL(`../../docs/${relative}`, import.meta.url),
  );
  expect(bytes.toString("utf8", 0, 4)).toBe("glTF");
  expect(bytes.readUInt32LE(4)).toBe(2);
  expect(bytes.readUInt32LE(8)).toBe(bytes.length);
  expect(bytes.readUInt32LE(16)).toBe(0x4e4f534a);
  return JSON.parse(bytes.toString("utf8", 20, 20 + bytes.readUInt32LE(12)));
}

describe("candidate artwork is present in the published catalog", () => {
  // These studies are preserved for possible ambient/friendly reuse, not an enemy roster.
  for (const id of [
    "blockling",
    "signal-moth",
    "buffer-baron",
    "loop-dancer",
    "prism-mimic",
    "trendweaver",
  ]) {
    const artwork = { id, url: `/studio/assets/media/${id}/v001/${id}.glb` };
    it(`${artwork.id} ships its embedded skin and five required clips`, () => {
      const model = exportedModel(artwork.url);
      expect(model.skins.length).toBeGreaterThan(0);
      expect(
        model.animations.map((clip: { name: string }) => clip.name).sort(),
      ).toEqual(["idle", "move", "attack", "hit", "defeat"].sort());
      expect(model.images.length).toBeGreaterThan(0);
      for (const image of model.images) expect(image.uri).toBeUndefined();
      for (const buffer of model.buffers) expect(buffer.uri).toBeUndefined();
      expect(model.extensionsRequired ?? []).toEqual([]);
    });
  }
  for (const kind of ["attack-tool", "guard-tool"] as const)
    for (const tier of [1, 2]) {
      const artwork = equipmentArtwork(kind, tier);
      it(`${artwork.id} ships its rigid mesh and embedded texture`, () => {
        const model = exportedModel(artwork.url);
        expect(model.meshes.length).toBeGreaterThan(0);
        expect(model.animations ?? []).toEqual([]);
        expect(model.skins ?? []).toEqual([]);
        expect(model.images.length).toBeGreaterThan(0);
        for (const image of model.images) expect(image.uri).toBeUndefined();
        for (const buffer of model.buffers) expect(buffer.uri).toBeUndefined();
        expect(model.extensionsRequired ?? []).toEqual([]);
      });
    }
});
