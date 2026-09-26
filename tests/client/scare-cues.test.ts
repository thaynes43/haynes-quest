// @vitest-environment jsdom
/**
 * DESIGN-027 D-06 scare sounds: each scare event maps to its cue id in the
 * merged manifest, and the audio owner still plays nothing (and raises
 * nothing) for a cue its manifest does not list.
 */
import { describe, expect, it, vi } from "vitest";
import {
  QuestAudio,
  familyWorldCues,
  playtestCues,
  questCues,
  scareCues,
  type ScareCueId,
} from "../../src/client/audio";
import {
  SCARE_AMBIENT_LOOP,
  feedbackSounds,
  playFeedbackSounds,
} from "../../src/client/feedback-sounds";
import type { GameFeedbackEvent } from "../../src/game/types";

class FakeNode {
  readonly gain = { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), cancelScheduledValues: vi.fn() };
  readonly threshold = { value: 0 };
  readonly knee = { value: 0 };
  readonly ratio = { value: 0 };
  readonly attack = { value: 0 };
  readonly release = { value: 0 };
  readonly playbackRate = { value: 1 };
  buffer: unknown = null;
  loop = false;
  onended: (() => void) | null = null;
  readonly connect = vi.fn();
  readonly disconnect = vi.fn();
  readonly start = vi.fn();
  readonly stop = vi.fn();
}

class FakeContext extends EventTarget {
  state: AudioContextState = "suspended";
  currentTime = 0;
  readonly destination = {};
  readonly resume = vi.fn(async () => {
    this.state = "running";
  });
  readonly suspend = vi.fn(async () => {});
  readonly close = vi.fn(async () => {});
  readonly decodeAudioData = vi.fn(async () => ({}) as AudioBuffer);
  createGain() {
    return new FakeNode();
  }
  createBufferSource() {
    return new FakeNode();
  }
  createDynamicsCompressor() {
    return new FakeNode();
  }
}

const SCARE_CUE_IDS = Object.keys(scareCues) as ScareCueId[];

const events: readonly [GameFeedbackEvent, ScareCueId, "cue" | "loop"][] = [
  [{ type: "jump-scare", encounterId: "rat", durationMs: 900 }, "jump-scare-sting", "cue"],
  [{ type: "watcher-creak", encounterId: "moth" }, "servo-creak", "cue"],
  [{ type: "blackout-return" }, "light-buzz", "cue"],
  [{ type: "ambient-laugh" }, "distant-laugh", "cue"],
  [{ type: "radio-static", encounterId: "showman" }, "radio-static", "cue"],
  [{ type: "scare-ambient-loop", active: true }, "casino-hum", "loop"],
];

describe("scare sounds", () => {
  it("map each scare event to its DESIGN-027 cue", () => {
    for (const [event, id, kind] of events)
      expect(feedbackSounds(event), event.type).toEqual([
        kind === "loop" ? { kind, id, active: true } : { kind, id },
      ]);
    expect(feedbackSounds({ type: "scare-ambient-loop", active: false })).toEqual([
      { kind: "loop", id: SCARE_AMBIENT_LOOP, active: false },
    ]);
    expect(new Set(events.map(([, id]) => id))).toEqual(new Set(SCARE_CUE_IDS));
  });

  it("name cues the manifest plays, and only the ambience loops", () => {
    for (const id of SCARE_CUE_IDS) {
      expect(questCues[id], id).toBe(scareCues[id]);
      expect(scareCues[id].loop, id).toBe(id === SCARE_AMBIENT_LOOP);
    }
  });

  it("stay silent, without errors, when a manifest lacks the scare cues", async () => {
    const context = new FakeContext();
    const fetcher = vi.fn(async (_input: RequestInfo | URL) => new Response(new Uint8Array([1, 2, 3, 4])));
    const audio = new QuestAudio({
      cues: { ...playtestCues, ...familyWorldCues },
      storage: null,
      pageDocument: null,
      audioSession: null,
      contextFactory: () => context as unknown as AudioContext,
      fetcher,
    });
    await expect(audio.start()).resolves.toBe(true);
    for (const id of SCARE_CUE_IDS) {
      await expect(audio.cue(id)).resolves.toBe(false);
      await expect(audio.loop(id, true)).resolves.toBe(false);
      await expect(audio.loop(id, false)).resolves.toBe(false);
    }
    for (const id of SCARE_CUE_IDS)
      expect(fetcher.mock.calls.some(([url]) => String(url).includes(`/${id}/`))).toBe(false);
    // The event path tolerates them too.
    for (const [event] of events) expect(() => playFeedbackSounds(audio, event)).not.toThrow();
    audio.dispose();
  });
});
