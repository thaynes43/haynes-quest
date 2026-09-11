// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import {
  playtestCues,
  QuestAudio,
  type QuestAudioOptions,
} from "../../src/client/audio";

class MemoryStorage implements Pick<Storage, "getItem" | "setItem"> {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

class FakeGain {
  readonly gain = { value: 1 };
  readonly connect = vi.fn();
  readonly disconnect = vi.fn();
}

class FakeSource {
  buffer: AudioBuffer | null = null;
  loop = false;
  readonly playbackRate = { value: 1 };
  onended: (() => void) | null = null;
  readonly connect = vi.fn();
  readonly disconnect = vi.fn();
  readonly start = vi.fn();
  readonly stop = vi.fn();
}

class FakeAudioContext {
  state: AudioContextState = "suspended";
  readonly destination = {} as AudioDestinationNode;
  readonly gains: FakeGain[] = [];
  readonly sources: FakeSource[] = [];
  readonly resume = vi.fn(async () => {
    this.state = "running";
  });
  readonly suspend = vi.fn(async () => {
    this.state = "suspended";
  });
  readonly close = vi.fn(async () => {
    this.state = "closed";
  });
  readonly decodeAudioData = vi.fn(async () => ({}) as AudioBuffer);

  createGain(): GainNode {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain as unknown as GainNode;
  }

  createBufferSource(): AudioBufferSourceNode {
    const source = new FakeSource();
    this.sources.push(source);
    return source as unknown as AudioBufferSourceNode;
  }
}

class FakePage extends EventTarget {
  hidden = false;
}

function successfulFetch(): typeof fetch {
  return vi.fn(
    async () => new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 }),
  );
}

function audioFixture(overrides: QuestAudioOptions = {}) {
  const context = new FakeAudioContext();
  const storage = new MemoryStorage();
  const contextFactory = vi.fn(() => context as unknown as AudioContext);
  const fetcher = successfulFetch();
  const audio = new QuestAudio({
    storage,
    pageDocument: null,
    contextFactory,
    fetcher,
    ...overrides,
  });
  return { audio, context, contextFactory, fetcher, storage };
}

describe("QuestAudio", () => {
  it("waits for an explicit start before loading or playing a cue", async () => {
    const { audio, context, contextFactory, fetcher } = audioFixture();

    expect(audio.preferences()).toEqual({ muted: false, volume: 0.35 });
    await expect(audio.cue("memory-collected")).resolves.toBe(false);
    expect(contextFactory).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();

    const started = audio.start();
    expect(contextFactory).toHaveBeenCalledOnce();
    await expect(started).resolves.toBe(true);
    await expect(
      audio.cue("memory-collected", { gain: 0.5, playbackRate: 0.5 }),
    ).resolves.toBe(true);
    expect(context.sources[0]?.start).toHaveBeenCalledOnce();
    expect(context.sources[0]?.playbackRate.value).toBe(0.75);
    expect(context.gains[1]?.gain.value).toBe(
      playtestCues["memory-collected"].gain * 0.5,
    );
  });

  it("honors and updates an explicit persisted mute and volume preference", async () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "quest-audio",
      JSON.stringify({ muted: true, volume: 0.8 }),
    );
    const { audio, context, contextFactory } = audioFixture({ storage });

    expect(audio.preferences()).toEqual({ muted: true, volume: 0.8 });
    await expect(audio.start()).resolves.toBe(false);
    expect(contextFactory).not.toHaveBeenCalled();

    audio.setPreferences(false, 0.25);
    expect(JSON.parse(storage.getItem("quest-audio")!)).toEqual({
      muted: false,
      volume: 0.25,
    });
    await expect(audio.start()).resolves.toBe(true);
    await expect(audio.cue("ui-confirmed")).resolves.toBe(true);
    audio.setPreferences(true);

    expect(context.gains[0]?.gain.value).toBe(0);
    expect(context.sources[0]?.stop).toHaveBeenCalledOnce();
  });

  it("keeps load/decode failures silent, retryable, and same-origin", async () => {
    const retryingFetch = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockImplementation(
        async () => new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 }),
      );
    const { audio, context } = audioFixture({ fetcher: retryingFetch });
    context.decodeAudioData.mockRejectedValueOnce(new Error("bad wav"));
    await audio.start();

    await expect(audio.cue("ui-confirmed")).resolves.toBe(false);
    await expect(audio.cue("ui-confirmed")).resolves.toBe(false);
    await expect(audio.cue("ui-confirmed")).resolves.toBe(true);
    expect(retryingFetch).toHaveBeenCalledTimes(3);

    const externalFetch = successfulFetch();
    const external = audioFixture({
      fetcher: externalFetch,
      cues: {
        external: {
          ...playtestCues["ui-confirmed"],
          path: "https://media.example.test/cue.wav",
        },
      },
    }).audio;
    await external.start();
    await expect(external.cue("external")).resolves.toBe(false);
    expect(externalFetch).not.toHaveBeenCalled();
  });

  it("stays silent while paused or backgrounded and cannot revive after dispose", async () => {
    const page = new FakePage();
    const { audio, context, fetcher } = audioFixture({ pageDocument: page });
    await audio.start();
    await audio.cue("memory-collected");

    audio.setPaused(true);
    expect(context.sources[0]?.stop).toHaveBeenCalledOnce();
    expect(context.suspend).toHaveBeenCalledOnce();
    audio.setPaused(false);
    await expect(audio.cue("memory-collected")).resolves.toBe(false);
    await audio.start();
    await expect(audio.cue("memory-collected")).resolves.toBe(true);

    page.hidden = true;
    page.dispatchEvent(new Event("visibilitychange"));
    expect(context.sources[1]?.stop).toHaveBeenCalledOnce();
    page.hidden = false;
    page.dispatchEvent(new Event("visibilitychange"));
    await expect(audio.cue("memory-collected")).resolves.toBe(false);
    await expect(audio.start()).resolves.toBe(true);

    audio.dispose();
    expect(context.close).toHaveBeenCalledOnce();
    const requestsAtDispose = vi.mocked(fetcher).mock.calls.length;
    await expect(audio.start()).resolves.toBe(false);
    await expect(audio.cue("memory-collected")).resolves.toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(requestsAtDispose);
  });

  it("bounds overlap and lets important feedback replace movement sounds", async () => {
    const { audio, context } = audioFixture({ maxSources: 2 });
    await audio.start();
    await audio.cue("movement-landed");
    await audio.cue("movement-landed");
    expect(context.sources).toHaveLength(2);

    await expect(audio.cue("ability-unlocked")).resolves.toBe(true);
    expect(context.sources).toHaveLength(3);
    expect(context.sources[0]?.stop).toHaveBeenCalledOnce();
    expect(context.sources[1]?.stop).not.toHaveBeenCalled();
    expect(context.sources[2]?.start).toHaveBeenCalledOnce();
  });
});
