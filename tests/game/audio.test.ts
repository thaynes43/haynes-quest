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

class FakeCompressor {
  readonly threshold = { value: -24 };
  readonly knee = { value: 30 };
  readonly ratio = { value: 12 };
  readonly attack = { value: 0.003 };
  readonly release = { value: 0.25 };
  readonly connect = vi.fn();
  readonly disconnect = vi.fn();
}

class FakeAudioContext extends EventTarget {
  state: AudioContextState = "suspended";
  readonly destination = {} as AudioDestinationNode;
  readonly gains: FakeGain[] = [];
  readonly compressors: FakeCompressor[] = [];
  readonly sources: FakeSource[] = [];
  failSourceStart = false;
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

  constructor() {
    super();
  }

  createGain(): GainNode {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain as unknown as GainNode;
  }

  createBufferSource(): AudioBufferSourceNode {
    const source = new FakeSource();
    if (this.failSourceStart)
      source.start.mockImplementation(() => {
        throw new DOMException("Source start failed", "InvalidStateError");
      });
    this.sources.push(source);
    return source as unknown as AudioBufferSourceNode;
  }

  createDynamicsCompressor(): DynamicsCompressorNode {
    const compressor = new FakeCompressor();
    this.compressors.push(compressor);
    return compressor as unknown as DynamicsCompressorNode;
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
  const audioSession = { type: "auto" };
  const contextFactory = vi.fn(() => context as unknown as AudioContext);
  const fetcher = successfulFetch();
  const audio = new QuestAudio({
    storage,
    pageDocument: null,
    audioSession,
    contextFactory,
    fetcher,
    ...overrides,
  });
  return { audio, audioSession, context, contextFactory, fetcher, storage };
}

describe("QuestAudio", () => {
  it("waits for an explicit start before loading or playing a cue", async () => {
    const { audio, audioSession, context, contextFactory, fetcher } =
      audioFixture();

    expect(audio.preferences()).toEqual({ muted: false, volume: 0.8 });
    expect(audio.status()).toEqual({
      muted: false,
      volume: 0.8,
      ready: false,
      contextState: "unavailable",
    });
    await expect(audio.cue("memory-collected")).resolves.toBe(false);
    expect(contextFactory).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();

    const started = audio.start();
    expect(contextFactory).toHaveBeenCalledOnce();
    await expect(started).resolves.toBe(true);
    expect(audioSession.type).toBe("playback");
    expect(context.compressors[0]).toMatchObject({
      threshold: { value: -3 },
      knee: { value: 0 },
      ratio: { value: 20 },
      attack: { value: 0.003 },
      release: { value: 0.1 },
    });
    expect(audio.status()).toMatchObject({
      ready: true,
      contextState: "running",
    });
    await expect(
      audio.cue("memory-collected", { gain: 0.5, playbackRate: 0.5 }),
    ).resolves.toBe(true);
    expect(context.sources[0]?.start).toHaveBeenCalledOnce();
    expect(context.sources[0]?.playbackRate.value).toBe(0.75);
    expect(context.gains[1]?.gain.value).toBe(
      playtestCues["memory-collected"].gain * 0.5,
    );
    audio.dispose();
    expect(audioSession.type).toBe("auto");
  });

  it("starts fresh from legacy playtest preferences, then persists the new preference namespace", async () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "quest-audio",
      JSON.stringify({ muted: true, volume: 0.8 }),
    );
    const { audio, context, contextFactory } = audioFixture({ storage });

    expect(audio.preferences()).toEqual({ muted: false, volume: 0.8 });
    await expect(audio.start()).resolves.toBe(true);
    expect(contextFactory).toHaveBeenCalledOnce();

    audio.setPreferences(true, 0.25);
    expect(JSON.parse(storage.getItem("quest-audio-v2")!)).toEqual({
      muted: true,
      volume: 0.25,
    });
    await expect(audio.start()).resolves.toBe(false);
    audio.setPreferences(false);
    await expect(audio.cue("ui-confirmed")).resolves.toBe(true);
    audio.setPreferences(true);

    expect(context.gains[0]?.gain.value).toBe(0);
    expect(context.sources[0]?.stop).toHaveBeenCalledOnce();
  });

  it("honors an explicit mute in the current preference namespace", async () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "quest-audio-v2",
      JSON.stringify({ muted: true, volume: 0.45 }),
    );
    const { audio, contextFactory } = audioFixture({ storage });

    expect(audio.preferences()).toEqual({ muted: true, volume: 0.45 });
    await expect(audio.start({ confirmation: true })).resolves.toBe(false);
    expect(contextFactory).not.toHaveBeenCalled();
  });

  it("plays one retryable positive confirmation after gesture unlock", async () => {
    const retryingFetch = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockImplementation(
        async () => new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 }),
      );
    const { audio, context } = audioFixture({ fetcher: retryingFetch });

    await expect(audio.start({ confirmation: true })).resolves.toBe(false);
    expect(audio.status().ready).toBe(true);
    expect(context.sources).toHaveLength(0);
    await expect(audio.start({ confirmation: true })).resolves.toBe(true);
    expect(context.sources).toHaveLength(1);
    await expect(audio.start({ confirmation: true })).resolves.toBe(true);
    expect(context.sources).toHaveLength(1);

    audio.setPreferences(true);
    audio.setPreferences(false);
    audio.setPaused(true);
    await expect(audio.start({ confirmation: true })).resolves.toBe(true);
    expect(context.sources).toHaveLength(2);
    expect(audio.status().ready).toBe(false);
  });

  it("auditions a requested cue repeatedly while a gameplay modal is paused", async () => {
    const { audio, context } = audioFixture();
    audio.setPaused(true);

    await expect(audio.audition()).resolves.toBe(true);
    await expect(audio.audition("ui-confirmed")).resolves.toBe(true);

    expect(context.resume).toHaveBeenCalledOnce();
    expect(context.sources).toHaveLength(2);
    expect(audio.status().ready).toBe(false);

    audio.setPreferences(true);
    await expect(audio.audition()).resolves.toBe(false);
    expect(context.sources).toHaveLength(2);
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

  it("pauses modal cues without suspending hardware, but requires a gesture after backgrounding", async () => {
    const page = new FakePage();
    const { audio, context, fetcher } = audioFixture({ pageDocument: page });
    await audio.start();
    await audio.cue("memory-collected");

    audio.setPaused(true);
    expect(context.sources[0]?.stop).toHaveBeenCalledOnce();
    expect(context.suspend).not.toHaveBeenCalled();
    await expect(audio.cue("memory-collected")).resolves.toBe(false);
    audio.setPaused(false);
    await expect(audio.cue("memory-collected")).resolves.toBe(true);

    page.hidden = true;
    page.dispatchEvent(new Event("visibilitychange"));
    expect(context.sources[1]?.stop).toHaveBeenCalledOnce();
    expect(context.suspend).toHaveBeenCalledOnce();
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

  it("keeps a page-hide suspend authoritative over a pending resume", async () => {
    const page = new FakePage();
    const { audio, context } = audioFixture({ pageDocument: page });
    let finishResume!: () => void;
    context.resume.mockImplementationOnce(async () => {
      await new Promise<void>((resolve) => {
        finishResume = resolve;
      });
      context.state = "running";
    });

    const starting = audio.start();
    expect(context.resume).toHaveBeenCalledOnce();
    page.hidden = true;
    page.dispatchEvent(new Event("visibilitychange"));
    finishResume();

    await expect(starting).resolves.toBe(false);
    expect(context.state).toBe("suspended");
    expect(audio.status().ready).toBe(false);
    expect(context.suspend).toHaveBeenCalledTimes(2);
  });

  it("marks spontaneous interruption as not ready and resumes on a later gesture", async () => {
    const { audio, context } = audioFixture();
    await audio.start();

    context.state = "interrupted";
    context.dispatchEvent(new Event("statechange"));
    expect(audio.status()).toMatchObject({
      ready: false,
      contextState: "interrupted",
    });
    await expect(audio.cue("ui-confirmed")).resolves.toBe(false);
    await expect(audio.start()).resolves.toBe(true);
    expect(context.resume).toHaveBeenCalledTimes(2);
  });

  it("rebuilds the graph after the browser closes a context", async () => {
    const first = new FakeAudioContext();
    const second = new FakeAudioContext();
    const contextFactory = vi
      .fn<() => AudioContext | undefined>()
      .mockReturnValueOnce(first as unknown as AudioContext)
      .mockReturnValueOnce(second as unknown as AudioContext);
    const audio = new QuestAudio({
      storage: new MemoryStorage(),
      pageDocument: null,
      audioSession: null,
      contextFactory,
      fetcher: successfulFetch(),
    });
    await audio.start();
    await audio.cue("ui-confirmed");

    first.state = "closed";
    first.dispatchEvent(new Event("statechange"));
    await expect(audio.start()).resolves.toBe(true);

    expect(contextFactory).toHaveBeenCalledTimes(2);
    expect(first.sources[0]?.stop).toHaveBeenCalledOnce();
    expect(first.gains[0]?.disconnect).toHaveBeenCalledOnce();
    expect(first.compressors[0]?.disconnect).toHaveBeenCalledOnce();
    expect(second.state).toBe("running");
  });

  it("maps gameplay feedback to measured cue variants", async () => {
    const { audio, context } = audioFixture();
    await audio.start();

    await expect(audio.feedback("jump")).resolves.toBe(true);
    await expect(audio.feedback("impact")).resolves.toBe(true);
    expect(context.sources[0]?.playbackRate.value).toBe(1.45);
    expect(context.gains[1]?.gain.value).toBe(
      playtestCues["ui-confirmed"].gain * 1.1,
    );
    expect(context.sources[1]?.playbackRate.value).toBe(0.75);
    expect(context.gains[2]?.gain.value).toBe(
      playtestCues["ui-confirmed"].gain * 1.3,
    );
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

  it("releases failed source starts so later gameplay sounds still have room", async () => {
    const { audio, context } = audioFixture({ maxSources: 2 });
    await audio.start();
    context.failSourceStart = true;
    await expect(audio.cue("memory-collected")).resolves.toBe(false);
    await expect(audio.cue("memory-collected")).resolves.toBe(false);
    context.failSourceStart = false;
    await expect(audio.feedback("jump")).resolves.toBe(true);
    await expect(audio.feedback("landed")).resolves.toBe(true);
    expect(context.sources[0]?.disconnect).toHaveBeenCalledOnce();
    expect(context.sources[1]?.disconnect).toHaveBeenCalledOnce();
    audio.dispose();
  });

  it("reports zero volume as silent and recovers when volume is restored", async () => {
    const { audio } = audioFixture();
    await audio.start();
    audio.setPreferences(false, 0);
    expect(audio.status().ready).toBe(false);
    await expect(audio.cue("memory-collected")).resolves.toBe(false);
    await expect(audio.audition()).resolves.toBe(false);
    audio.setPreferences(false, 0.8);
    await expect(audio.audition()).resolves.toBe(true);
    audio.dispose();
  });
});
