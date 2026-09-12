// @vitest-environment jsdom
// WO068 probe: volume 0 silences the master gain but status().ready and the
// cue()/audition() "played" booleans keep reporting playable audio
// (src/client/audio.ts:291-322).
import { describe, expect, it } from "vitest";
import { audioFixture } from "./fakes";

describe("QuestAudio readiness at zero volume", () => {
  it("does not report playable audio while the master gain is silent", async () => {
    const { audio, context } = audioFixture();
    await expect(audio.start({ confirmation: true })).resolves.toBe(true);

    audio.setPreferences(false, 0);
    expect(context.gains[0]?.gain.value).toBe(0);

    expect(audio.status()).toMatchObject({ muted: false, ready: false });
    await expect(audio.cue("memory-collected")).resolves.toBe(false);
    await expect(audio.audition()).resolves.toBe(false);
  });
});
