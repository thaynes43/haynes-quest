export interface QuestAudioCue {
  readonly assetId: string;
  readonly version: string;
  readonly path: string;
  readonly sha256: string;
  readonly durationSeconds: number;
  readonly loop: boolean;
  /** Gain relative to the player's global volume preference. */
  readonly gain: number;
  /** Higher-priority cues may replace lower-priority sounds at the source cap. */
  readonly priority: number;
  readonly maxInstances: number;
}

/**
 * Existing v001 candidates authorized for this private playtest.
 * Catalog inclusion and playtest use do not imply listening or final-art approval.
 */
export const playtestCues = {
  "ui-confirmed": {
    assetId: "ui-confirmed",
    version: "v001",
    path: "/studio/assets/media/ui-confirmed/v001/cue.wav",
    sha256: "e9a0541c87b518de9b7d989ae4b6ef99d3ee03e40bfc1e65855bfe9069597608",
    durationSeconds: 0.3,
    loop: false,
    gain: 0.7,
    priority: 1,
    maxInstances: 2,
  },
  "memory-collected": {
    assetId: "memory-collected",
    version: "v001",
    path: "/studio/assets/media/memory-collected/v001/cue.wav",
    sha256: "86ed72b341775dbb6f60414994912ec0d0292140e6408c20de54e5eb7ba0d358",
    durationSeconds: 1.2,
    loop: false,
    gain: 0.85,
    priority: 3,
    maxInstances: 2,
  },
  "ability-unlocked": {
    assetId: "ability-unlocked",
    version: "v001",
    path: "/studio/assets/media/ability-unlocked/v001/cue.wav",
    sha256: "46318afe6c77579a6b063fa704e887cd6112601b4cc4144351fa9085845115c0",
    durationSeconds: 1.8,
    loop: false,
    gain: 0.8,
    priority: 4,
    maxInstances: 1,
  },
  "movement-landed": {
    assetId: "movement-landed",
    version: "v001",
    path: "/studio/assets/media/movement-landed/v001/cue.wav",
    sha256: "2c869c641b29e5df0ede83ad5dfab63f26a4d41c9b7258b56d3acb4dd71bf127",
    durationSeconds: 0.25,
    loop: false,
    gain: 0.55,
    priority: 0,
    maxInstances: 2,
  },
} as const satisfies Readonly<Record<string, QuestAudioCue>>;

export type PlaytestCueId = keyof typeof playtestCues;

export interface CuePlaybackOptions {
  /** Multiplies the cue's own gain; clamped to 0..2. */
  readonly gain?: number;
  /** Allows restrained pitch variation for candidate reuse; clamped to 0.75..1.5. */
  readonly playbackRate?: number;
}

interface VisibilityDocument {
  readonly hidden: boolean;
  addEventListener(type: "visibilitychange", listener: () => void): void;
  removeEventListener(type: "visibilitychange", listener: () => void): void;
}

export interface QuestAudioOptions {
  readonly cues?: Readonly<Record<string, QuestAudioCue>>;
  readonly storage?: Pick<Storage, "getItem" | "setItem"> | null;
  readonly storageKey?: string;
  readonly pageDocument?: VisibilityDocument | null;
  readonly contextFactory?: () => AudioContext | undefined;
  readonly fetcher?: typeof fetch;
  readonly defaultMuted?: boolean;
  readonly defaultVolume?: number;
  readonly maxSources?: number;
}

interface ActiveSource {
  readonly cueId: string;
  readonly priority: number;
  readonly sequence: number;
  readonly source: AudioBufferSourceNode;
  readonly gain: GainNode;
}

const DEFAULT_STORAGE_KEY = "quest-audio";
const DEFAULT_VOLUME = 0.35;
const DEFAULT_MAX_SOURCES = 4;

function clamp(value: number, minimum: number, maximum: number): number {
  return Number.isFinite(value)
    ? Math.max(minimum, Math.min(maximum, value))
    : minimum;
}

function defaultStorage(): Pick<Storage, "getItem" | "setItem"> | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function defaultPageDocument(): VisibilityDocument | undefined {
  return typeof document === "undefined" ? undefined : document;
}

function defaultContextFactory(): AudioContext | undefined {
  type AudioContextConstructor = new () => AudioContext;
  const scope = globalThis as typeof globalThis & {
    webkitAudioContext?: AudioContextConstructor;
  };
  const Context = scope.AudioContext ?? scope.webkitAudioContext;
  return Context ? new Context() : undefined;
}

function isSameOriginAsset(path: string): boolean {
  try {
    const base = new URL(
      typeof globalThis.location === "undefined"
        ? "https://quest.invalid/"
        : globalThis.location.href,
    );
    const resolved = new URL(path, base);
    return (
      resolved.origin === base.origin &&
      (resolved.protocol === "http:" || resolved.protocol === "https:")
    );
  } catch {
    return false;
  }
}

/** One browser-audio owner for transient game cues and their lifecycle. */
export class QuestAudio {
  private readonly cues: Readonly<Record<string, QuestAudioCue>>;
  private readonly storage: Pick<Storage, "getItem" | "setItem"> | undefined;
  private readonly storageKey: string;
  private readonly pageDocument: VisibilityDocument | undefined;
  private readonly contextFactory: () => AudioContext | undefined;
  private readonly fetcher: typeof fetch;
  private readonly maxSources: number;
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly loads = new Map<string, Promise<AudioBuffer | undefined>>();
  private readonly sources = new Set<ActiveSource>();
  private readonly visibilityListener: () => void;
  private context: AudioContext | undefined;
  private masterGain: GainNode | undefined;
  private disposed = false;
  private unlocked = false;
  private paused = false;
  private backgrounded = false;
  private muted: boolean;
  private volume: number;
  private sequence = 0;

  constructor(options: QuestAudioOptions = {}) {
    this.cues = options.cues ?? playtestCues;
    this.storage =
      options.storage === null
        ? undefined
        : (options.storage ?? defaultStorage());
    this.storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;
    this.pageDocument =
      options.pageDocument === null
        ? undefined
        : (options.pageDocument ?? defaultPageDocument());
    this.contextFactory = options.contextFactory ?? defaultContextFactory;
    this.fetcher =
      options.fetcher ?? ((input, init) => globalThis.fetch(input, init));
    this.maxSources = Math.round(
      clamp(options.maxSources ?? DEFAULT_MAX_SOURCES, 1, 16),
    );
    this.muted = options.defaultMuted ?? false;
    this.volume = clamp(options.defaultVolume ?? DEFAULT_VOLUME, 0, 1);

    try {
      const persisted = JSON.parse(
        this.storage?.getItem(this.storageKey) ?? "{}",
      );
      if (typeof persisted.muted === "boolean") this.muted = persisted.muted;
      if (typeof persisted.volume === "number")
        this.volume = clamp(persisted.volume, 0, 1);
    } catch {
      /* Storage is optional and malformed state must not gate the game. */
    }

    this.backgrounded = this.pageDocument?.hidden ?? false;
    this.visibilityListener = () => {
      this.backgrounded = this.pageDocument?.hidden ?? false;
      if (this.backgrounded) this.suspend();
    };
    this.pageDocument?.addEventListener(
      "visibilitychange",
      this.visibilityListener,
    );
  }

  preferences(): Readonly<{ muted: boolean; volume: number }> {
    return { muted: this.muted, volume: this.volume };
  }

  setPreferences(muted: boolean, volume = this.volume): void {
    this.muted = muted;
    this.volume = clamp(volume, 0, 1);
    if (this.masterGain)
      this.masterGain.gain.value = this.muted ? 0 : this.volume;
    if (this.muted) this.stopAll();
    try {
      this.storage?.setItem(
        this.storageKey,
        JSON.stringify(this.preferences()),
      );
    } catch {
      /* Storage is optional. */
    }
  }

  /**
   * Call synchronously from Play/Continue or another user gesture. Creating the
   * context before the first await preserves Safari's gesture-unlock window.
   */
  async start(): Promise<boolean> {
    if (this.disposed || this.muted || this.paused || this.backgrounded)
      return false;

    if (this.context?.state === "closed") {
      this.context = undefined;
      this.masterGain = undefined;
      this.unlocked = false;
      this.buffers.clear();
      this.loads.clear();
    }

    try {
      this.context ??= this.contextFactory();
      if (!this.context) return false;
      if (!this.masterGain) {
        this.masterGain = this.context.createGain();
        this.masterGain.gain.value = this.volume;
        this.masterGain.connect(this.context.destination);
      }
      if (this.context.state !== "running") await this.context.resume();
      this.unlocked = !this.disposed && this.context.state === "running";
      return this.unlocked;
    } catch {
      this.unlocked = false;
      return false;
    }
  }

  /** Stops transient sounds and suspends the context without marking game pause. */
  suspend(): void {
    this.unlocked = false;
    this.stopAll();
    try {
      void this.context?.suspend().catch(() => undefined);
    } catch {
      /* Audio lifecycle failures never gate the game. */
    }
  }

  /** A deliberate gameplay pause remains in force until explicitly cleared. */
  setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) this.suspend();
  }

  async cue(id: string, options: CuePlaybackOptions = {}): Promise<boolean> {
    const cue = this.cues[id];
    const context = this.context;
    const masterGain = this.masterGain;
    if (
      !cue ||
      this.disposed ||
      !this.unlocked ||
      this.muted ||
      this.paused ||
      this.backgrounded ||
      !context ||
      !masterGain ||
      context.state !== "running"
    )
      return false;

    const buffer = await this.load(id, cue, context);
    if (
      !buffer ||
      this.disposed ||
      !this.unlocked ||
      this.muted ||
      this.paused ||
      this.backgrounded ||
      this.context !== context ||
      context.state !== "running"
    )
      return false;

    const sameCue = [...this.sources]
      .filter((active) => active.cueId === id)
      .sort((left, right) => left.sequence - right.sequence);
    if (sameCue.length >= cue.maxInstances) this.stopSource(sameCue[0]!);

    if (this.sources.size >= this.maxSources) {
      const victim = [...this.sources].sort(
        (left, right) =>
          left.priority - right.priority || left.sequence - right.sequence,
      )[0]!;
      if (victim.priority > cue.priority) return false;
      this.stopSource(victim);
    }

    let source: AudioBufferSourceNode | undefined;
    let sourceGain: GainNode | undefined;
    try {
      source = context.createBufferSource();
      sourceGain = context.createGain();
      source.buffer = buffer;
      source.loop = cue.loop;
      source.playbackRate.value = clamp(options.playbackRate ?? 1, 0.75, 1.5);
      sourceGain.gain.value = cue.gain * clamp(options.gain ?? 1, 0, 2);
      source.connect(sourceGain);
      sourceGain.connect(masterGain);
      const active: ActiveSource = {
        cueId: id,
        priority: cue.priority,
        sequence: this.sequence++,
        source,
        gain: sourceGain,
      };
      source.onended = () => this.removeSource(active);
      this.sources.add(active);
      source.start();
      return true;
    } catch {
      try {
        source?.disconnect();
        sourceGain?.disconnect();
      } catch {
        /* Partially created nodes are already silent. */
      }
      return false;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unlocked = false;
    this.pageDocument?.removeEventListener(
      "visibilitychange",
      this.visibilityListener,
    );
    this.stopAll();
    this.buffers.clear();
    this.loads.clear();
    try {
      this.masterGain?.disconnect();
      void this.context?.close().catch(() => undefined);
    } catch {
      /* Closing unsupported or interrupted audio remains harmless. */
    }
    this.masterGain = undefined;
    this.context = undefined;
  }

  private load(
    id: string,
    cue: QuestAudioCue,
    context: AudioContext,
  ): Promise<AudioBuffer | undefined> {
    const cached = this.buffers.get(id);
    if (cached) return Promise.resolve(cached);
    const pending = this.loads.get(id);
    if (pending) return pending;

    const load = (async () => {
      if (!isSameOriginAsset(cue.path)) return undefined;
      try {
        const response = await this.fetcher(cue.path, {
          credentials: "same-origin",
          redirect: "error",
        });
        if (!response.ok) return undefined;
        const buffer = await context.decodeAudioData(
          await response.arrayBuffer(),
        );
        if (this.disposed || this.context !== context) return undefined;
        this.buffers.set(id, buffer);
        return buffer;
      } catch {
        return undefined;
      } finally {
        this.loads.delete(id);
      }
    })();
    this.loads.set(id, load);
    return load;
  }

  private stopAll(): void {
    [...this.sources].forEach((active) => this.stopSource(active));
  }

  private stopSource(active: ActiveSource): void {
    this.sources.delete(active);
    active.source.onended = null;
    try {
      active.source.stop();
    } catch {
      /* A source may already have ended. */
    }
    this.disconnectSource(active);
  }

  private removeSource(active: ActiveSource): void {
    this.sources.delete(active);
    this.disconnectSource(active);
  }

  private disconnectSource(active: ActiveSource): void {
    try {
      active.source.disconnect();
      active.gain.disconnect();
    } catch {
      /* Disconnecting an already detached node is harmless. */
    }
  }
}
