// @vitest-environment jsdom
// WO068 probe: when AudioBufferSourceNode.start() throws, playCue's catch block
// disconnects the nodes but never removes the ActiveSource it already added to
// this.sources (src/client/audio.ts:492-511). The entry has no scheduled
// playback, so its onended never fires and the slot is held until the next
// stopAll(). Once the budget is full of such entries, the priority rule refuses
// to evict them and later gameplay cues are dropped while status().ready is true.
import { describe, expect, it } from "vitest";
import { audioFixture } from "./fakes";

describe("QuestAudio source budget after a failed source start", () => {
  it("keeps playing gameplay cues after transient source-start failures", async () => {
    const { audio, context } = audioFixture({ maxSources: 2 });
    await audio.start();

    // Safari raises InvalidStateError when the context is torn down between the
    // guard checks and playback; QuestAudio treats that as a silent no-op.
    context.failStart = true;
    await expect(audio.cue("memory-collected")).resolves.toBe(false);
    await expect(audio.cue("memory-collected")).resolves.toBe(false);
    context.failStart = false;

    // Audio still claims to be ready and the context is running...
    expect(audio.status()).toMatchObject({
      ready: true,
      contextState: "running",
    });

    // ...but every lower-priority cue is now refused by the eviction rule.
    await expect(audio.feedback("jump")).resolves.toBe(true);
    await expect(audio.feedback("landed")).resolves.toBe(true);
    await expect(audio.cue("ability-unlocked")).resolves.toBe(true);
  });
});
