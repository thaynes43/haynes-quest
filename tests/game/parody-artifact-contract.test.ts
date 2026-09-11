import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parodyArtwork } from "../../src/game/scene-catalog";
import {
  PARODY_CANDIDATES,
  PARODY_CATALOGS,
} from "../../src/shared/parody-catalog";

const REQUIRED_CLIPS = ["attack", "defeat", "hit", "idle", "move"];
const BESTIES_REQUIRED_CLIPS = [
  "attack",
  "cheer",
  "defeat",
  "dizzy",
  "high-five",
  "hit",
  "idle",
  "move",
];
const ARCHIVED_UNSELECTABLE_IDS = ["nap-captain", "one-star-diva"];
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;
const MAX_GLB_BYTES = 2 * 1024 * 1024;
const MAX_MATERIALS = 6;
const MAX_PRIMITIVES = 6;
const MAX_TRIANGLES = 15_000;

interface ExactArtifact {
  contactFraction: number;
  durations: Record<string, number>;
  glbBytes: number;
  glbSha256: string;
  height: number;
  manifestBytes: number;
  manifestSha256: string;
  resources: {
    bufferBytes: number;
    images: number;
    materials: number;
    primitives: number;
    skins: number;
    textures: number;
    triangles: number;
  };
}

const EXACT_ARTIFACTS: Record<string, ExactArtifact> = {
  "mister-hiss": {
    contactFraction: 0.6,
    durations: { attack: 1.5, defeat: 2, hit: 0.5, idle: 2.5, move: 1 },
    glbBytes: 1_202_456,
    glbSha256:
      "14bcfe2dcc060cbfd6908a281de0795f6b426144a63d322f89f1ec234e42572f",
    height: 1,
    manifestBytes: 93_676,
    manifestSha256:
      "b7ad2d5672747bc2b13be5b0e776c0edb0dd8841c74652feb8b84789b70b3a89",
    resources: {
      bufferBytes: 1_145_660,
      images: 1,
      materials: 3,
      primitives: 3,
      skins: 1,
      textures: 3,
      triangles: 12_872,
    },
  },
  "peel-patrol": {
    contactFraction: 0.625,
    durations: {
      attack: 1.6,
      defeat: 2,
      hit: 0.6,
      idle: 2.5,
      move: 1.2,
    },
    glbBytes: 652_424,
    glbSha256:
      "72962eb3a1cb2a08e13d9082dd506fbe7186798f48d0dee7af3cdd72b7891ed5",
    height: 1.15,
    manifestBytes: 65_809,
    manifestSha256:
      "350734a909e7043e5093a503a03361cea5030d08b8bfa009f57a636ca28e97b9",
    resources: {
      bufferBytes: 588_856,
      images: 1,
      materials: 4,
      primitives: 4,
      skins: 1,
      textures: 4,
      triangles: 9_084,
    },
  },
  "drama-dragon": {
    contactFraction: 0.625,
    durations: {
      attack: 2,
      defeat: 2.4,
      hit: 0.7,
      idle: 3,
      move: 1.6,
    },
    glbBytes: 917_980,
    glbSha256:
      "13c6cb5185385f85cda2e16027ad201a2ea1e2a4ad0f5eb7a13cba9d073fa933",
    height: 1.8,
    manifestBytes: 84_422,
    manifestSha256:
      "ac5b4c432518f7f1e9275cc6b9a95f30ab2fe0955c8e055da4cdca1c9ced9281",
    resources: {
      bufferBytes: 831_380,
      images: 1,
      materials: 3,
      primitives: 3,
      skins: 1,
      textures: 4,
      triangles: 11_960,
    },
  },
  "sir-flush-a-lot": {
    contactFraction: 0.625,
    durations: {
      attack: 1.6,
      defeat: 2,
      hit: 0.5,
      idle: 2.5,
      move: 1,
    },
    glbBytes: 782_488,
    glbSha256:
      "c4db8f231fcdb29d71ddc605df89b928ef0aeaa29b91af3b1e3041041f0cdf49",
    height: 1,
    manifestBytes: 58_013,
    manifestSha256:
      "1c29300de08956176879b9bc1e1407ef359c4918f5ed9248c4f25568696fb2ad",
    resources: {
      bufferBytes: 741_444,
      images: 1,
      materials: 5,
      primitives: 5,
      skins: 1,
      textures: 5,
      triangles: 14_676,
    },
  },
};

const EXPECTED_ALIAS_MAP = {
  "drama-dragon": "drama-dragon",
  "drama-dragon-encore": "drama-dragon",
  "mister-hiss": "mister-hiss",
  "peel-patrol": "peel-patrol",
  "peel-patrol-encore": "peel-patrol",
  "sir-flush-a-lot-encore": "sir-flush-a-lot",
};

const v2Candidates = PARODY_CATALOGS["parody-catalog-v2"];
const selectedArtifacts = [
  ...new Map(
    v2Candidates.map((entry) => [
      `${entry.assetId}@${entry.assetVersion}`,
      entry,
    ]),
  ).values(),
];

const BESTIES_ARTIFACTS = {
  "bestie-pink": {
    glbBytes: 956_924,
    glbSha256:
      "0f7020f53ed257dd88e6a8cb9e8fb0011c70e84bf33bc2e55fb671473aea96ae",
    resources: { bufferBytes: 860_824, triangles: 14_588 },
  },
  "bestie-black": {
    glbBytes: 928_000,
    glbSha256:
      "0819c67a17d38f340ace0ebdaff6bd316a800286af7f7a0da91273e898d80f05",
    resources: { bufferBytes: 829_788, triangles: 14_056 },
  },
} as const;

const BESTIES_DURATIONS: Record<string, number> = {
  attack: 1.6,
  cheer: 2,
  defeat: 2,
  dizzy: 2.4,
  "high-five": 1.6,
  hit: 0.6,
  idle: 2.4,
  move: 1.2,
};

interface ManifestClip {
  name: string;
  duration_s: number;
  contact_time_s?: number | null;
  contact_fraction?: number | null;
}

interface ManifestFile {
  artifact_id?: string;
  artifact_url?: string;
  bytes?: number;
  file?: string;
  local_name?: string;
  remote_relative_path?: string;
  repository_path?: string;
  sha256?: string;
  url?: string;
}

interface ParodyManifest {
  asset_id?: string;
  files?: ManifestFile[] | Record<string, Omit<ManifestFile, "file">>;
  glb_sha256?: string;
  runtime?: {
    asset_id?: string;
    attack_contact_fraction?: number;
    attack_contact_time_s?: number;
    clips?: Record<string, ManifestClip>;
    glb?: string;
    glb_sha256?: string;
    ground_to_top_m?: number;
    rest_ground_y_m?: number;
    runtime_scale?: number;
    version?: string;
  };
}

interface GlbAccessor {
  bufferView?: number;
  byteOffset?: number;
  componentType?: number;
  count?: number;
  max?: number[];
  min?: number[];
  normalized?: boolean;
  sparse?: unknown;
  type?: string;
}

interface GlbPrimitive {
  attributes?: { POSITION?: number };
  indices?: number;
  mode?: number;
}

interface GlbDocument {
  accessors?: GlbAccessor[];
  animations?: Array<{
    name?: string;
    samplers?: Array<{ input?: number }>;
  }>;
  bufferViews?: Array<{
    buffer?: number;
    byteLength?: number;
    byteOffset?: number;
    byteStride?: number;
  }>;
  buffers?: Array<{ byteLength?: number; uri?: string }>;
  extensionsRequired?: string[];
  images?: Array<{ bufferView?: number; uri?: string }>;
  materials?: unknown[];
  meshes?: Array<{ primitives?: GlbPrimitive[] }>;
  nodes?: Array<{
    matrix?: number[];
    mesh?: number;
    rotation?: number[];
    scale?: number[];
    translation?: number[];
  }>;
  skins?: unknown[];
  textures?: unknown[];
}

function sha256(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

function basename(value: string | undefined) {
  if (!value) return undefined;
  const pathname = value.includes("://") ? new URL(value).pathname : value;
  return decodeURIComponent(pathname.split(/[?#]/)[0]!.split("/").at(-1)!);
}

function manifestFiles(manifest: ParodyManifest): ManifestFile[] {
  if (Array.isArray(manifest.files)) return manifest.files;
  return Object.entries(manifest.files ?? {}).map(([file, declaration]) => ({
    file,
    ...declaration,
  }));
}

function parseGlb(bytes: Buffer) {
  expect(bytes.length).toBeGreaterThanOrEqual(20);
  expect(bytes.toString("utf8", 0, 4)).toBe("glTF");
  expect(bytes.readUInt32LE(4)).toBe(2);
  expect(bytes.readUInt32LE(8)).toBe(bytes.length);

  let document: GlbDocument | undefined;
  let binary: Buffer | undefined;
  let offset = 12;
  while (offset < bytes.length) {
    const chunkLength = bytes.readUInt32LE(offset);
    const chunkType = bytes.readUInt32LE(offset + 4);
    const chunk = bytes.subarray(offset + 8, offset + 8 + chunkLength);
    if (chunkType === JSON_CHUNK) {
      let jsonLength = chunk.length;
      while (jsonLength > 0 && chunk[jsonLength - 1]! <= 32) jsonLength -= 1;
      document = JSON.parse(chunk.subarray(0, jsonLength).toString("utf8"));
    }
    if (chunkType === BIN_CHUNK) binary = chunk;
    offset += 8 + chunkLength;
  }
  expect(offset).toBe(bytes.length);
  expect(document).toBeDefined();
  expect(binary).toBeDefined();
  return { document: document!, binary: binary! };
}

function accessorValues(
  document: GlbDocument,
  binary: Buffer,
  accessorIndex: number,
) {
  const accessor = document.accessors?.[accessorIndex];
  expect(accessor, `missing accessor ${accessorIndex}`).toBeDefined();
  expect(accessor!.bufferView).toBeTypeOf("number");
  expect(accessor!.componentType).toBe(5126);
  expect(accessor!.count).toBeTypeOf("number");
  expect(accessor!.normalized ?? false).toBe(false);
  expect(accessor!.sparse).toBeUndefined();
  const components =
    accessor!.type === "SCALAR" ? 1 : accessor!.type === "VEC3" ? 3 : 0;
  expect(
    components,
    `unsupported accessor type ${String(accessor!.type)}`,
  ).toBeGreaterThan(0);
  const view = document.bufferViews?.[accessor!.bufferView!];
  expect(view).toBeDefined();
  expect(view!.buffer ?? 0).toBe(0);
  const packedStride = components * Float32Array.BYTES_PER_ELEMENT;
  const stride = view!.byteStride ?? packedStride;
  expect(stride).toBeGreaterThanOrEqual(packedStride);
  const start = (view!.byteOffset ?? 0) + (accessor!.byteOffset ?? 0);
  const end = start + (accessor!.count! - 1) * stride + packedStride;
  expect(end).toBeLessThanOrEqual(binary.length);

  const values: number[][] = [];
  for (let item = 0; item < accessor!.count!; item += 1) {
    values.push(
      Array.from({ length: components }, (_unused, component) =>
        binary.readFloatLE(
          start + item * stride + component * Float32Array.BYTES_PER_ELEMENT,
        ),
      ),
    );
  }
  return { accessor: accessor!, values };
}

function animationDurations(document: GlbDocument, binary: Buffer) {
  return Object.fromEntries(
    (document.animations ?? []).map((animation) => {
      const inputAccessors = new Set(
        (animation.samplers ?? []).map((sampler) => sampler.input),
      );
      expect(animation.name).toBeTypeOf("string");
      expect(inputAccessors.has(undefined)).toBe(false);
      const times = [...inputAccessors].flatMap(
        (index) => accessorValues(document, binary, index!).values,
      );
      expect(times.length).toBeGreaterThan(0);
      expect(times.every((value) => value.length === 1)).toBe(true);
      return [animation.name!, Math.max(...times.map(([time]) => time!))];
    }),
  );
}

function restGeometryHeight(document: GlbDocument, binary: Buffer) {
  const positionAccessors = new Set(
    (document.meshes ?? []).flatMap((mesh) =>
      (mesh.primitives ?? []).map(
        (primitive) => primitive.attributes?.POSITION,
      ),
    ),
  );
  expect(positionAccessors.size).toBeGreaterThan(0);
  expect(positionAccessors.has(undefined)).toBe(false);
  const yValues = [...positionAccessors].flatMap((index) => {
    const { accessor, values } = accessorValues(document, binary, index!);
    expect(accessor.type).toBe("VEC3");
    const minimum = Math.min(...values.map((value) => value[1]!));
    const maximum = Math.max(...values.map((value) => value[1]!));
    expect(minimum).toBeCloseTo(accessor.min![1]!, 5);
    expect(maximum).toBeCloseTo(accessor.max![1]!, 5);
    return values.map((value) => value[1]!);
  });
  return { minimum: Math.min(...yValues), maximum: Math.max(...yValues) };
}

function triangleCount(document: GlbDocument) {
  return (document.meshes ?? [])
    .flatMap((mesh) => mesh.primitives ?? [])
    .reduce((total, primitive) => {
      expect(primitive.mode ?? 4).toBe(4);
      const accessorIndex = primitive.indices ?? primitive.attributes?.POSITION;
      expect(accessorIndex).toBeTypeOf("number");
      const count = document.accessors?.[accessorIndex!]?.count;
      expect(count).toBeTypeOf("number");
      expect(count! % 3).toBe(0);
      return total + count! / 3;
    }, 0);
}

function expectIdentityMeshNodes(document: GlbDocument) {
  const meshNodes = (document.nodes ?? []).filter(
    (node) => node.mesh !== undefined,
  );
  expect(meshNodes.length).toBeGreaterThan(0);
  for (const node of meshNodes) {
    expect(
      node.matrix ?? [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    ).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    expect(node.translation ?? [0, 0, 0]).toEqual([0, 0, 0]);
    expect(node.rotation ?? [0, 0, 0, 1]).toEqual([0, 0, 0, 1]);
    expect(node.scale ?? [1, 1, 1]).toEqual([1, 1, 1]);
  }
}

describe("selectable parody runtime artifact contract", () => {
  it("maps all six v2 encounter identities onto the four completed assets", () => {
    expect(v2Candidates).toHaveLength(6);
    expect(
      Object.fromEntries(
        v2Candidates.map((entry) => [entry.id, entry.assetId]),
      ),
    ).toEqual(EXPECTED_ALIAS_MAP);
    expect(
      v2Candidates.filter((entry) =>
        [entry.id, entry.assetId].some((id) =>
          ARCHIVED_UNSELECTABLE_IDS.includes(id),
        ),
      ),
    ).toEqual([]);
    expect(
      selectedArtifacts
        .map((entry) => `${entry.assetId}@${entry.assetVersion}`)
        .sort(),
    ).toEqual([
      "drama-dragon@v001",
      "mister-hiss@v001",
      "peel-patrol@v001",
      "sir-flush-a-lot@v001",
    ]);

    for (const entry of v2Candidates) {
      const exact = EXACT_ARTIFACTS[entry.assetId];
      expect(exact, `${entry.id}: selected asset contract`).toBeDefined();
      expect(
        parodyArtwork({
          catalogEntryId: entry.id,
          catalogEntryVersion: entry.version,
          assetId: entry.assetId,
          assetVersion: entry.assetVersion,
        }),
      ).toEqual({
        contactFraction: exact!.contactFraction,
        height: exact!.height,
        id: entry.assetId,
        kind: "single",
        url: `/studio/assets/media/${entry.assetId}/${entry.assetVersion}/${entry.assetId}.glb`,
      });
    }
  });

  it("maps all nine v3 identities and resolves the logical boss as two models", () => {
    expect(PARODY_CANDIDATES).toHaveLength(9);
    expect(
      Object.fromEntries(
        PARODY_CANDIDATES.map((entry) => [entry.id, entry.assetId]),
      ),
    ).toEqual({
      ...EXPECTED_ALIAS_MAP,
      "bickering-besties": "bickering-besties",
      "peel-patrol-besties": "peel-patrol",
      "sir-flush-a-lot-besties": "sir-flush-a-lot",
    });

    const entry = PARODY_CANDIDATES.find(
      (candidate) => candidate.id === "bickering-besties",
    )!;
    expect(
      parodyArtwork({
        catalogEntryId: entry.id,
        catalogEntryVersion: entry.version,
        assetId: entry.assetId,
        assetVersion: entry.assetVersion,
      }),
    ).toEqual({
      contactFraction: 0.625,
      height: 1.4,
      id: "bickering-besties",
      kind: "duo",
      models: [
        {
          id: "bestie-pink",
          url: "/studio/assets/media/bestie-pink/v001/bestie-pink.glb",
        },
        {
          id: "bestie-black",
          url: "/studio/assets/media/bestie-black/v001/bestie-black.glb",
        },
      ],
    });
    expect(
      parodyArtwork({
        catalogEntryId: entry.id,
        catalogEntryVersion: entry.version,
        assetId: "bestie-pink",
        assetVersion: entry.assetVersion,
      }),
    ).toBeNull();
  });

  for (const entry of selectedArtifacts) {
    it(`${entry.assetId}@${entry.assetVersion} matches its exact manifest and GLB`, () => {
      const exact = EXACT_ARTIFACTS[entry.assetId];
      expect(exact, `${entry.assetId}: exact artifact contract`).toBeDefined();
      const aliases = PARODY_CANDIDATES.filter(
        (candidate) =>
          candidate.assetId === entry.assetId &&
          candidate.assetVersion === entry.assetVersion,
      );
      expect(aliases.length).toBeGreaterThan(0);
      for (const alias of aliases) {
        expect(
          parodyArtwork({
            catalogEntryId: alias.id,
            catalogEntryVersion: alias.version,
            assetId: alias.assetId,
            assetVersion: alias.assetVersion,
          }),
        ).toMatchObject({
          contactFraction: exact!.contactFraction,
          height: exact!.height,
          id: entry.assetId,
        });
      }

      const assetRoot = new URL(
        `../../docs/assets/media/${entry.assetId}/${entry.assetVersion}/`,
        import.meta.url,
      );
      const manifestUrl = new URL("manifest.json", assetRoot);
      const glbUrl = new URL(`${entry.assetId}.glb`, assetRoot);
      const missing = [manifestUrl, glbUrl]
        .filter((url) => !existsSync(url))
        .map((url) => fileURLToPath(url));
      expect(missing, `${entry.assetId}: required published files`).toEqual([]);

      const manifestBytes = readFileSync(manifestUrl);
      const glbBytes = readFileSync(glbUrl);
      expect(manifestBytes.length).toBe(exact!.manifestBytes);
      expect(sha256(manifestBytes)).toBe(exact!.manifestSha256);
      expect(glbBytes.length).toBe(exact!.glbBytes);
      expect(sha256(glbBytes)).toBe(exact!.glbSha256);
      expect(glbBytes.length).toBeLessThanOrEqual(MAX_GLB_BYTES);

      const manifest: ParodyManifest = JSON.parse(
        manifestBytes.toString("utf8"),
      );
      const glbFiles = manifestFiles(manifest).filter((file) =>
        [
          file.artifact_id,
          file.artifact_url,
          file.file,
          file.local_name,
          file.remote_relative_path,
          file.repository_path,
          file.url,
        ].some((value) => basename(value) === `${entry.assetId}.glb`),
      );
      expect(glbFiles).toHaveLength(1);
      expect(manifest.asset_id).toBe(entry.assetId);
      expect(manifest.runtime).toMatchObject({
        asset_id: entry.assetId,
        version: entry.assetVersion,
        glb: `${entry.assetId}.glb`,
        glb_sha256: exact!.glbSha256,
        runtime_scale: 1,
        ground_to_top_m: exact!.height,
        rest_ground_y_m: 0,
        attack_contact_fraction: exact!.contactFraction,
      });
      expect(glbFiles[0]).toMatchObject({
        bytes: exact!.glbBytes,
        sha256: exact!.glbSha256,
      });
      expect(manifest.glb_sha256).toBe(exact!.glbSha256);

      const { document, binary } = parseGlb(glbBytes);
      const primitives = (document.meshes ?? []).flatMap(
        (mesh) => mesh.primitives ?? [],
      );
      expect(document.buffers).toHaveLength(1);
      expect(document.buffers?.[0]?.byteLength).toBe(
        exact!.resources.bufferBytes,
      );
      expect(
        document.buffers?.every((buffer) => buffer.uri === undefined),
      ).toBe(true);
      expect(document.images).toHaveLength(exact!.resources.images);
      expect(
        document.images?.every(
          (image) =>
            image.uri === undefined && Number.isInteger(image.bufferView),
        ),
      ).toBe(true);
      expect(document.textures).toHaveLength(exact!.resources.textures);
      expect(document.materials).toHaveLength(exact!.resources.materials);
      expect(document.skins).toHaveLength(exact!.resources.skins);
      expect(primitives).toHaveLength(exact!.resources.primitives);
      expect(triangleCount(document)).toBe(exact!.resources.triangles);
      expect(document.materials!.length).toBeLessThanOrEqual(MAX_MATERIALS);
      expect(primitives.length).toBeLessThanOrEqual(MAX_PRIMITIVES);
      expect(exact!.resources.triangles).toBeLessThanOrEqual(MAX_TRIANGLES);
      expect(document.extensionsRequired ?? []).toEqual([]);

      const manifestClips = manifest.runtime!.clips!;
      expect(Object.keys(manifestClips).sort()).toEqual(REQUIRED_CLIPS);
      expect(document.animations).toHaveLength(REQUIRED_CLIPS.length);
      const durations = animationDurations(document, binary);
      expect(Object.keys(durations).sort()).toEqual(REQUIRED_CLIPS);
      for (const clipName of REQUIRED_CLIPS) {
        expect(manifestClips[clipName]!.name).toBe(clipName);
        expect(manifestClips[clipName]!.duration_s).toBe(
          exact!.durations[clipName],
        );
        expect(durations[clipName]).toBeCloseTo(exact!.durations[clipName]!, 5);
      }

      expect(manifestClips.attack!.contact_fraction).toBe(
        exact!.contactFraction,
      );
      expect(manifest.runtime!.attack_contact_time_s).toBeCloseTo(
        exact!.durations.attack! * exact!.contactFraction,
        5,
      );
      expect(manifestClips.attack!.contact_time_s).toBeCloseTo(
        exact!.durations.attack! * exact!.contactFraction,
        5,
      );

      expectIdentityMeshNodes(document);
      const height = restGeometryHeight(document, binary);
      expect(height.minimum).toBeCloseTo(0, 5);
      expect(height.maximum).toBeCloseTo(exact!.height, 5);
    });
  }

  for (const [actorId, exact] of Object.entries(BESTIES_ARTIFACTS)) {
    it(`${actorId}@v001 matches its exact bounded eight-clip GLB`, () => {
      const glbUrl = new URL(
        `../../docs/assets/media/${actorId}/v001/${actorId}.glb`,
        import.meta.url,
      );
      expect(existsSync(glbUrl), `${actorId}: required published GLB`).toBe(
        true,
      );
      const glbBytes = readFileSync(glbUrl);
      expect(glbBytes.length).toBe(exact.glbBytes);
      expect(sha256(glbBytes)).toBe(exact.glbSha256);
      expect(glbBytes.length).toBeLessThanOrEqual(MAX_GLB_BYTES);

      const { document, binary } = parseGlb(glbBytes);
      const primitives = (document.meshes ?? []).flatMap(
        (mesh) => mesh.primitives ?? [],
      );
      expect(document.buffers).toHaveLength(1);
      expect(document.buffers?.[0]?.byteLength).toBe(
        exact.resources.bufferBytes,
      );
      expect(
        document.buffers?.every((buffer) => buffer.uri === undefined),
      ).toBe(true);
      expect(document.images).toHaveLength(1);
      expect(
        document.images?.every(
          (image) =>
            image.uri === undefined && Number.isInteger(image.bufferView),
        ),
      ).toBe(true);
      expect(document.textures).toHaveLength(5);
      expect(document.materials).toHaveLength(5);
      expect(document.skins).toHaveLength(1);
      expect(primitives).toHaveLength(5);
      expect(triangleCount(document)).toBe(exact.resources.triangles);
      expect(document.materials!.length).toBeLessThanOrEqual(MAX_MATERIALS);
      expect(primitives.length).toBeLessThanOrEqual(MAX_PRIMITIVES);
      expect(exact.resources.triangles).toBeLessThanOrEqual(MAX_TRIANGLES);
      expect(document.extensionsRequired ?? []).toEqual([]);

      expect(document.animations).toHaveLength(BESTIES_REQUIRED_CLIPS.length);
      const durations = animationDurations(document, binary);
      expect(Object.keys(durations).sort()).toEqual(BESTIES_REQUIRED_CLIPS);
      for (const clipName of BESTIES_REQUIRED_CLIPS)
        expect(durations[clipName]).toBeCloseTo(
          BESTIES_DURATIONS[clipName]!,
          5,
        );

      expectIdentityMeshNodes(document);
      const height = restGeometryHeight(document, binary);
      expect(height.minimum).toBeCloseTo(0, 5);
      expect(height.maximum).toBeCloseTo(1.4, 5);
    });
  }
});
