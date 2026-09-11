import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { equipmentArtwork, parodyArtwork } from "../../src/game/scene-catalog";
import { PARODY_CANDIDATES } from "../../src/shared/parody-catalog";

const { versionProbeIdentity } = vi.hoisted(() => ({
  versionProbeIdentity: {
    catalogEntryId: "bickering-besties-version-probe",
    catalogEntryVersion: "test-entry-version",
    assetId: "bickering-besties",
    assetVersion: "test-asset-version",
  } as const,
}));

vi.mock("../../src/shared/parody-catalog", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/shared/parody-catalog")>();
  const besties = actual.PARODY_CANDIDATES.find(
    (candidate) => candidate.id === "bickering-besties",
  );
  if (!besties) throw new Error("The Besties catalog entry is missing");
  return {
    ...actual,
    ALL_PARODY_CANDIDATES: [
      ...actual.ALL_PARODY_CANDIDATES,
      Object.freeze({
        ...besties,
        id: versionProbeIdentity.catalogEntryId,
        version: versionProbeIdentity.catalogEntryVersion,
        assetId: versionProbeIdentity.assetId,
        assetVersion: versionProbeIdentity.assetVersion,
      }),
    ],
  };
});

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
  it("threads a matched asset version through both Besties model URLs", () => {
    expect(parodyArtwork(versionProbeIdentity)).toMatchObject({
      kind: "duo",
      models: [
        {
          id: "bestie-pink",
          url: "/studio/assets/media/bestie-pink/test-asset-version/bestie-pink.glb",
        },
        {
          id: "bestie-black",
          url: "/studio/assets/media/bestie-black/test-asset-version/bestie-black.glb",
        },
      ],
    });
  });

  it("derives both Besties model URLs from the exact matched entry version", () => {
    const entry = PARODY_CANDIDATES.find(
      (candidate) => candidate.id === "bickering-besties",
    );
    expect(entry).toBeDefined();
    if (!entry) throw new Error("The Besties catalog entry is missing");

    const identity = {
      catalogEntryId: entry.id,
      catalogEntryVersion: entry.version,
      assetId: entry.assetId,
      assetVersion: entry.assetVersion,
    };
    const artwork = parodyArtwork(identity);
    expect(artwork).toEqual({
      id: "bickering-besties",
      kind: "duo",
      contactFraction: 0.625,
      height: 1.4,
      models: [
        {
          id: "bestie-pink",
          url: `/studio/assets/media/bestie-pink/${entry.assetVersion}/bestie-pink.glb`,
        },
        {
          id: "bestie-black",
          url: `/studio/assets/media/bestie-black/${entry.assetVersion}/bestie-black.glb`,
        },
      ],
    });
    if (!artwork || artwork.kind !== "duo")
      throw new Error("The Besties catalog entry did not resolve as a duo");
    for (const model of artwork.models) exportedModel(model.url);

    expect(
      parodyArtwork({
        ...identity,
        assetVersion: `${entry.assetVersion}-other`,
      }),
    ).toBeNull();
  });

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
