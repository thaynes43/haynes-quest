import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { SharpImageSanitizer } from "../../src/server/photos/sanitizer";

describe("private image sanitization", () => {
  it("decodes, bounds and reencodes images without EXIF", async () => {
    const input = await sharp({
      create: { width: 2000, height: 1000, channels: 3, background: "#557363" },
    })
      .jpeg()
      .withMetadata({ exif: { IFD0: { Artist: "Synthetic fixture" } } })
      .toBuffer();
    expect((await sharp(input).metadata()).exif).toBeDefined();
    const output = await new SharpImageSanitizer().sanitize(
      input,
      "image/jpeg",
      500000,
    );
    const metadata = await sharp(output.bytes).metadata();
    expect(output.contentType).toBe("image/webp");
    expect(metadata.width).toBe(1600);
    expect(metadata.height).toBe(800);
    expect(metadata.exif).toBeUndefined();
    expect(metadata.icc).toBeUndefined();
  });
  it("bounds the game texture below the default preview while retaining portrait detail", async () => {
    const input = await sharp({
      create: { width: 1000, height: 2000, channels: 3, background: "#557363" },
    }).jpeg().toBuffer();
    const sanitizer = new SharpImageSanitizer();
    const preview = await sanitizer.sanitize(input, "image/jpeg", 500000);
    const texture = await sanitizer.sanitize(input, "image/jpeg", 500000, "texture");
    const textureMetadata = await sharp(texture.bytes).metadata();
    expect(await sharp(preview.bytes).metadata()).toMatchObject({
      width: 800, height: 1600, format: "webp",
    });
    expect(textureMetadata).toMatchObject({
      width: 512, height: 1024, format: "webp",
    });
    expect(textureMetadata.exif).toBeUndefined();
    expect(texture.bytes.byteLength).toBeLessThan(preview.bytes.byteLength);
  });
  it("rejects corrupt payloads and oversize output", async () => {
    const sanitizer = new SharpImageSanitizer();
    await expect(
      sanitizer.sanitize(
        new Uint8Array([255, 216, 255, 217]),
        "image/jpeg",
        500000,
      ),
    ).rejects.toMatchObject({ code: "MEDIA_INVALID" });
    const input = await sharp({
      create: { width: 10, height: 10, channels: 3, background: "#557363" },
    })
      .png()
      .toBuffer();
    await expect(
      sanitizer.sanitize(input, "image/png", 1),
    ).rejects.toMatchObject({ code: "MEDIA_INVALID" });
  });
});
