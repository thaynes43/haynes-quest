import sharp from "sharp";
import { AppError } from "../errors.js";
import type { ImageSanitizer } from "./immich.js";

/** Private server-only decode/reencode. No original metadata is retained. */
export class SharpImageSanitizer implements ImageSanitizer {
  async sanitize(
    input: Uint8Array,
    _contentType: string,
    maxOutputBytes: number,
  ): Promise<{ bytes: Uint8Array; contentType: string }> {
    try {
      const bytes = await sharp(input, {
        limitInputPixels: 20_000_000,
        failOn: "warning",
        animated: false,
      })
        .rotate()
        .resize({
          width: 1600,
          height: 1600,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 82, effort: 3 })
        .timeout({ seconds: 3 })
        .toBuffer();
      if (bytes.byteLength > maxOutputBytes)
        throw new Error("Output too large");
      return { bytes: new Uint8Array(bytes), contentType: "image/webp" };
    } catch {
      throw new AppError(502, "MEDIA_INVALID", "Media unavailable");
    }
  }
}
