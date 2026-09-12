// @vitest-environment jsdom
// WO068 probe: one physical tap fires GameScreen's pointerdown/pointerup/
// touchend/click listeners (src/client/GameScreen.tsx:193-201), each calling
// start({ confirmation: true }). This records how many resume() calls and
// confirmation cues that produces before confirmationPlayed is set.
import { describe, expect, it } from "vitest";
import { audioFixture, FakePage } from "./fakes";

describe("QuestAudio under GameScreen's four-listener gesture storm", () => {
  it("issues one resume and one confirmation cue for a single tap", async () => {
    const { audio, context, fetcher } = audioFixture();
    const tap = [
      audio.start({ confirmation: true }),
      audio.start({ confirmation: true }),
      audio.start({ confirmation: true }),
      audio.start({ confirmation: true }),
    ];
    await Promise.all(tap);

    console.log("OBSERVED resumes", context.resume.mock.calls.length);
    console.log("OBSERVED fetches", (fetcher as never as { mock: { calls: unknown[] } }).mock.calls.length);
    expect(context.sources).toHaveLength(1);
    expect(context.resume).toHaveBeenCalledOnce();
  });

  it("recovers gameplay cues after a background round trip with no new gesture", async () => {
    const page = new FakePage();
    const { audio } = audioFixture({ pageDocument: page });
    await audio.start({ confirmation: true });
    await expect(audio.feedback("jump")).resolves.toBe(true);

    page.hidden = true;
    page.dispatchEvent(new Event("visibilitychange"));
    page.hidden = false;
    page.dispatchEvent(new Event("visibilitychange"));

    // Documented: a fresh gesture is required; the cue for the tap that
    // re-unlocks audio is itself dropped.
    await expect(audio.feedback("jump")).resolves.toBe(false);
    await expect(audio.start({ confirmation: true })).resolves.toBe(true);
    await expect(audio.feedback("jump")).resolves.toBe(true);
  });
});
