// Probe-only fakes for WO068 adversarial review. Mirrors tests/game/audio.test.ts.
import { vi } from "vitest";
import { QuestAudio, type QuestAudioOptions } from "../../../src/client/audio";

export class MemoryStorage implements Pick<Storage, "getItem" | "setItem"> {
  readonly values = new Map<string, string>();
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

export class FakeGain {
  readonly gain = { value: 1 };
  readonly connect = vi.fn();
  readonly disconnect = vi.fn();
}

export class FakeSource {
  buffer: AudioBuffer | null = null;
  loop = false;
  readonly playbackRate = { value: 1 };
  onended: (() => void) | null = null;
  readonly connect = vi.fn();
  readonly disconnect = vi.fn();
  readonly stop = vi.fn();
  constructor(private readonly context: FakeAudioContext) {}
  start = vi.fn(() => {
    if (this.context.failStart) throw new Error("InvalidStateError");
  });
}

export class FakeCompressor {
  readonly threshold = { value: -24 };
  readonly knee = { value: 30 };
  readonly ratio = { value: 12 };
  readonly attack = { value: 0.003 };
  readonly release = { value: 0.25 };
  readonly connect = vi.fn();
  readonly disconnect = vi.fn();
}

export class FakeAudioContext extends EventTarget {
  state: AudioContextState = "suspended";
  failStart = false;
  readonly destination = {} as AudioDestinationNode;
  readonly gains: FakeGain[] = [];
  readonly compressors: FakeCompressor[] = [];
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
    const source = new FakeSource(this);
    this.sources.push(source);
    return source as unknown as AudioBufferSourceNode;
  }
  createDynamicsCompressor(): DynamicsCompressorNode {
    const compressor = new FakeCompressor();
    this.compressors.push(compressor);
    return compressor as unknown as DynamicsCompressorNode;
  }
}

export class FakePage extends EventTarget {
  hidden = false;
}

export function successfulFetch(): typeof fetch {
  return vi.fn(
    async () => new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 }),
  );
}

export function audioFixture(overrides: QuestAudioOptions = {}) {
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
