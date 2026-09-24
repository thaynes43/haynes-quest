// Renders the browser and home-screen icons from the site header's sprout seal
// (`Sprout` in src/client/main.tsx) in the art brief's ink and honey colors.
// Run `pnpm brand:icons` after changing the mark and commit the files in public/.
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const SPROUT =
  "M16 27V13m0 6C6 20 3 13 4 7c7-1 12 3 12 10m0-3C16 6 22 3 28 4c1 7-3 13-12 13";
const INK = "#342c46";
const HONEY = "#dca953";

// The seal on a 64-unit canvas. Tab icons fill the canvas with heavier strokes
// so the sprout survives 16 px; the touch icon is a full-bleed square because
// iOS masks its corners and fills transparency with black.
function seal(kind: "tab" | "touch"): string {
  const tab = kind === "tab";
  const ring = tab ? 4 : 2.1;
  const stroke = tab ? 3.4 : 2.6;
  const radius = tab ? 32 - ring / 2 - 0.5 : 24;
  const scale = tab ? 1.45 : 1.12;
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">',
    ...(tab ? [] : [`  <rect width="64" height="64" fill="${INK}"/>`]),
    `  <circle cx="32" cy="32" r="${radius}" fill="${INK}" stroke="${HONEY}" stroke-width="${ring}"/>`,
    `  <path d="${SPROUT}" transform="translate(32 33) scale(${scale}) translate(-16.1 -15.5)" fill="none" stroke="${HONEY}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/>`,
    "</svg>",
    "",
  ].join("\n");
}

// Rasterize at 4x the target density, then downsample for smooth edges.
async function png(svg: string, size: number): Promise<Buffer> {
  return sharp(Buffer.from(svg), { density: (72 * size * 4) / 64 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer();
}

// An ICO container of PNG frames, which every current browser accepts.
function ico(frames: Array<{ size: number; data: Buffer }>): Buffer {
  const directory = Buffer.alloc(6 + 16 * frames.length);
  directory.writeUInt16LE(0, 0);
  directory.writeUInt16LE(1, 2);
  directory.writeUInt16LE(frames.length, 4);
  let offset = directory.length;
  frames.forEach(({ size, data }, index) => {
    const entry = 6 + 16 * index;
    directory.writeUInt8(size, entry);
    directory.writeUInt8(size, entry + 1);
    directory.writeUInt16LE(1, entry + 4);
    directory.writeUInt16LE(32, entry + 6);
    directory.writeUInt32LE(data.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  return Buffer.concat([directory, ...frames.map((frame) => frame.data)]);
}

const outDir = fileURLToPath(new URL("../../public/", import.meta.url));
await mkdir(outDir, { recursive: true });
const tabIcon = seal("tab");
const frames = await Promise.all(
  [16, 32, 48].map(async (size) => ({ size, data: await png(tabIcon, size) })),
);
await writeFile(`${outDir}favicon.svg`, tabIcon);
await writeFile(`${outDir}favicon.ico`, ico(frames));
await writeFile(`${outDir}apple-touch-icon.png`, await png(seal("touch"), 180));
console.log(`Wrote favicon.svg, favicon.ico (16/32/48) and apple-touch-icon.png to ${outDir}`);
