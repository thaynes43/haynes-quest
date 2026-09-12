import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { fixtureSvg } from "../../src/server/media.js";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const outputDirectory = path.join(
  repositoryRoot,
  "docs/assets/media/fixture-memories/v001",
);
const sourcePath = "src/server/media.ts";
const scriptPath = "scripts/assets/fixture-memory-review.ts";
const tileWidth = 480;
const tileHeight = 270;
const gutter = 8;
const columns = 2;
const rows = 3;

const fixtures = [
  { key: "demo-memory-2020-07", label: "The first glow" },
  { key: "demo-memory-2022-01", label: "A small discovery" },
  { key: "demo-memory-2024-01", label: "A taller path" },
  { key: "demo-memory-2025-01", label: "A bright detour" },
  { key: "demo-memory-2026-01", label: "A brave crossing" },
  { key: "demo-memory-2027-01", label: "The lantern gate" },
] as const;

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

await fs.mkdir(outputDirectory, { recursive: true });

const files: Array<Record<string, unknown>> = [];
const tiles: Buffer[] = [];
for (const fixture of fixtures) {
  const svg = fixtureSvg(fixture.key);
  if (svg === null) throw new Error(`Missing fixture SVG for ${fixture.key}`);
  const svgBytes = Buffer.from(svg, "utf8");
  const fileName = `${fixture.key}.svg`;
  const repositoryPath = `docs/assets/media/fixture-memories/v001/${fileName}`;
  await fs.writeFile(path.join(outputDirectory, fileName), svgBytes);
  files.push({
    role: "fixture-picture",
    fixture_key: fixture.key,
    label: fixture.label,
    path: repositoryPath,
    media_type: "image/svg+xml",
    width: 960,
    height: 540,
    bytes: svgBytes.length,
    sha256: sha256(svgBytes),
  });
  tiles.push(
    await sharp(svgBytes)
      .resize(tileWidth, tileHeight, { fit: "fill" })
      .png({ compressionLevel: 9, adaptiveFiltering: false })
      .toBuffer(),
  );
}

const contactSheet = await sharp({
  create: {
    width: columns * tileWidth + (columns + 1) * gutter,
    height: rows * tileHeight + (rows + 1) * gutter,
    channels: 3,
    background: "#fff5dc",
  },
})
  .composite(
    tiles.map((input, index) => ({
      input,
      left: gutter + (index % columns) * (tileWidth + gutter),
      top: gutter + Math.floor(index / columns) * (tileHeight + gutter),
    })),
  )
  .png({ compressionLevel: 9, adaptiveFiltering: false })
  .toBuffer();
const contactSheetPath =
  "docs/assets/media/fixture-memories/v001/contact-sheet.png";
await fs.writeFile(path.join(repositoryRoot, contactSheetPath), contactSheet);
files.push({
  role: "contact-sheet",
  path: contactSheetPath,
  media_type: "image/png",
  width: columns * tileWidth + (columns + 1) * gutter,
  height: rows * tileHeight + (rows + 1) * gutter,
  bytes: contactSheet.length,
  sha256: sha256(contactSheet),
});

const sourceBytes = await fs.readFile(path.join(repositoryRoot, sourcePath));
const manifest = {
  schema_version: 1,
  catalog_id: "fixture-route-memories",
  version: "v001",
  source: {
    kind: "repository-code",
    path: sourcePath,
    export: "fixtureSvg",
    sha256: sha256(sourceBytes),
    generated_by: scriptPath,
    external_inputs: [],
    private_inputs: false,
  },
  recipe:
    "Write fixtureSvg output bytes unchanged; render a two-column, three-row PNG contact sheet with Sharp using 480x270 tiles and 8px gutters.",
  files,
};
await fs.writeFile(
  path.join(outputDirectory, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);

console.log(
  `Prepared ${fixtures.length} exact fixture SVGs and ${contactSheetPath}`,
);
