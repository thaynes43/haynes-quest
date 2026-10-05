import { describe, expect, it } from "vitest";
import { photoTextureUrl } from "../../src/game/photo-texture-url";

describe("in-world photo requests", () => {
  it("selects the texture variant without changing the issued media path", () => {
    expect(photoTextureUrl("/api/saves/save/media/memory"))
      .toBe("/api/saves/save/media/memory?size=texture");
    expect(photoTextureUrl("/api/fixture-media/memory?source=fixture#view"))
      .toBe("/api/fixture-media/memory?source=fixture&size=texture#view");
    expect(photoTextureUrl("/api/saves/save/media/memory?size=preview&source=fixture#view"))
      .toBe("/api/saves/save/media/memory?size=texture&source=fixture#view");
    expect(photoTextureUrl(photoTextureUrl("/api/fixture-media/memory?source=fixture")))
      .toBe("/api/fixture-media/memory?source=fixture&size=texture");
  });
});
