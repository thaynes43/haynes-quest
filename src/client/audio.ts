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
 * The trims follow the checked-in PCM measurements: at the 0.8 fresh-playtest
 * master, each unvaried cue peaks between -12.5 and -9.9 dBFS. A limiter handles
 * coincident transients without flattening those individual sounds.
 */
export const playtestCues = {
  "ui-confirmed": {
    assetId: "ui-confirmed",
    version: "v001",
    path: "/studio/assets/media/ui-confirmed/v001/cue.wav",
    sha256: "e9a0541c87b518de9b7d989ae4b6ef99d3ee03e40bfc1e65855bfe9069597608",
    durationSeconds: 0.3,
    loop: false,
    gain: 1.5,
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
    gain: 1.1,
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
    gain: 1,
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
    gain: 2,
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

export const gameplayFeedback = {
  jump: {
    cueId: "ui-confirmed",
    options: { gain: 1.1, playbackRate: 1.45 },
  },
  attack: {
    cueId: "ui-confirmed",
    options: { gain: 1.2, playbackRate: 0.9 },
  },
  secondary: {
    cueId: "ui-confirmed",
    options: { gain: 0.9, playbackRate: 1.1 },
  },
  pickup: {
    cueId: "ui-confirmed",
    options: { gain: 1.1, playbackRate: 1.2 },
  },
  impact: {
    cueId: "ui-confirmed",
    options: { gain: 1.3, playbackRate: 0.75 },
  },
  landed: {
    cueId: "movement-landed",
    options: { gain: 0.65, playbackRate: 1 },
  },
} as const satisfies Readonly<
  Record<
    string,
    { readonly cueId: PlaytestCueId; readonly options: CuePlaybackOptions }
  >
>;

export type GameplayFeedbackId = keyof typeof gameplayFeedback;

export interface QuestAudioStartOptions {
  /** Plays the confirmation cue once after this audio owner first unlocks. */
  readonly confirmation?: boolean;
}

export interface QuestAudioStatus {
  readonly muted: boolean;
  readonly volume: number;
  readonly ready: boolean;
  readonly contextState: AudioContextState | "unavailable";
}

interface VisibilityDocument {
  readonly hidden: boolean;
  addEventListener(type: "visibilitychange", listener: () => void): void;
  removeEventListener(type: "visibilitychange", listener: () => void): void;
}

interface AudioSessionControl {
  type: string;
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
  readonly audioSession?: AudioSessionControl | null;
  /** Maximum time to trust a browser AudioContext resume attempt. */
  readonly resumeTimeoutMs?: number;
  /** Maximum time to fetch and decode one cue before allowing a retry. */
  readonly loadTimeoutMs?: number;
}

interface ActiveSource {
  readonly cueId: string;
  readonly priority: number;
  readonly sequence: number;
  readonly source: AudioBufferSourceNode;
  readonly gain: GainNode;
}

interface ResumeAttempt {
  readonly context: AudioContext;
  readonly promise: Promise<boolean>;
  readonly cancel: () => void;
}

const DEFAULT_STORAGE_KEY = "quest-audio-v2";
const DEFAULT_VOLUME = 0.8;
const DEFAULT_MAX_SOURCES = 4;
const DEFAULT_RESUME_TIMEOUT_MS = 1_500;
const DEFAULT_LOAD_TIMEOUT_MS = 5_000;

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

function defaultAudioSession(): AudioSessionControl | undefined {
  if (typeof navigator === "undefined") return undefined;
  return (
    navigator as Navigator & { readonly audioSession?: AudioSessionControl }
  ).audioSession;
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
  private readonly audioSession: AudioSessionControl | undefined;
  private readonly resumeTimeoutMs: number;
  private readonly loadTimeoutMs: number;
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly loads = new Map<string, Promise<AudioBuffer | undefined>>();
  private readonly loadCancels = new Map<string, () => void>();
  private readonly sources = new Set<ActiveSource>();
  private readonly visibilityListener: () => void;
  private context: AudioContext | undefined;
  private masterGain: GainNode | undefined;
  private limiter: DynamicsCompressorNode | undefined;
  private contextStateListener: (() => void) | undefined;
  private resumeAttempt: ResumeAttempt | undefined;
  private confirmationPromise: Promise<boolean> | undefined;
  private previousAudioSessionType: string | undefined;
  private audioSessionConfigured = false;
  private disposed = false;
  private unlocked = false;
  private confirmationPlayed = false;
  private paused = false;
  private backgrounded = false;
  private contextNeedsReplacement = false;
  private muted: boolean;
  private volume: number;
  private sequence = 0;
  private suspendSequence = 0;

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
    this.resumeTimeoutMs = Math.round(
      clamp(options.resumeTimeoutMs ?? DEFAULT_RESUME_TIMEOUT_MS, 1, 10_000),
    );
    this.loadTimeoutMs = Math.round(
      clamp(options.loadTimeoutMs ?? DEFAULT_LOAD_TIMEOUT_MS, 1, 30_000),
    );
    this.audioSession =
      options.audioSession === null
        ? undefined
        : (options.audioSession ?? defaultAudioSession());
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

  status(): QuestAudioStatus {
    const contextState = this.context?.state ?? "unavailable";
    return {
      ...this.preferences(),
      ready:
        !this.disposed &&
        !this.muted &&
        this.volume > 0 &&
        !this.paused &&
        !this.backgrounded &&
        this.unlocked &&
        contextState === "running",
      contextState,
    };
  }

  setPreferences(muted: boolean, volume = this.volume): void {
    const wasMuted = this.muted;
    this.muted = muted;
    this.volume = clamp(volume, 0, 1);
    if (this.masterGain)
      this.masterGain.gain.value = this.muted ? 0 : this.volume;
    if (this.muted) this.stopAll();
    if (wasMuted && !this.muted) this.confirmationPlayed = false;
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
  async start(options: QuestAudioStartOptions = {}): Promise<boolean> {
    const ready = await this.startContext(options.confirmation === true);
    if (!ready) return false;
    return options.confirmation ? this.confirmOnce() : true;
  }

  /** Plays a repeatable explicit sound check, including while gameplay is paused. */
  async audition(id: PlaytestCueId = "memory-collected"): Promise<boolean> {
    if (!(await this.startContext(true))) return false;
    return this.playCue(id, {}, true);
  }

  private async startContext(allowWhilePaused: boolean): Promise<boolean> {
    if (
      this.disposed ||
      this.muted ||
      this.volume <= 0 ||
      (this.paused && !allowWhilePaused) ||
      this.backgrounded
    )
      return false;

    if (
      this.context?.state === "closed" ||
      (this.context && this.contextNeedsReplacement)
    )
      this.retireContext();

    const suspendSequence = this.suspendSequence;
    try {
      if (!this.context) {
        this.configureAudioSession();
        this.context = this.contextFactory();
        if (!this.context) return false;
        this.contextNeedsReplacement = false;
        const context = this.context;
        this.contextStateListener = () => {
          if (this.context === context && context.state !== "running") {
            this.unlocked = false;
            this.contextNeedsReplacement = true;
            this.stopAll();
          }
        };
        context.addEventListener("statechange", this.contextStateListener);
      }
      const context = this.context;
      if (!this.masterGain) {
        const masterGain = context.createGain();
        const limiter = context.createDynamicsCompressor();
        masterGain.gain.value = this.volume;
        limiter.threshold.value = -3;
        limiter.knee.value = 0;
        limiter.ratio.value = 20;
        limiter.attack.value = 0.003;
        limiter.release.value = 0.1;
        masterGain.connect(limiter);
        limiter.connect(context.destination);
        this.masterGain = masterGain;
        this.limiter = limiter;
      }
      if (context.state !== "running" && !(await this.resumeContext(context))) {
        this.unlocked = false;
        if (this.context === context) this.retireContext();
        return false;
      }
      if (
        this.disposed ||
        this.muted ||
        (this.paused && !allowWhilePaused) ||
        this.backgrounded ||
        this.context !== context ||
        this.contextNeedsReplacement ||
        this.suspendSequence !== suspendSequence ||
        context.state !== "running"
      ) {
        this.unlocked = false;
        if (this.context === context) {
          if (this.contextNeedsReplacement) this.retireContext();
          else if (context.state === "running")
            await context.suspend().catch(() => undefined);
        }
        return false;
      }
      this.unlocked = true;
      return true;
    } catch {
      this.unlocked = false;
      if (this.context) this.retireContext();
      return false;
    }
  }

  /** Stops transient sounds and suspends the context without marking game pause. */
  suspend(): void {
    this.suspendSequence += 1;
    this.unlocked = false;
    if (this.context) this.contextNeedsReplacement = true;
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
    if (paused) this.stopAll();
  }

  feedback(id: GameplayFeedbackId): Promise<boolean> {
    const feedback = gameplayFeedback[id];
    return this.cue(feedback.cueId, feedback.options);
  }

  cue(id: string, options: CuePlaybackOptions = {}): Promise<boolean> {
    return this.playCue(id, options, false);
  }

  private async playCue(
    id: string,
    options: CuePlaybackOptions,
    allowWhilePaused: boolean,
  ): Promise<boolean> {
    const cue = this.cues[id];
    const context = this.context;
    const masterGain = this.masterGain;
    if (
      !cue ||
      this.disposed ||
      !this.unlocked ||
      this.muted ||
      this.volume <= 0 ||
      (this.paused && !allowWhilePaused) ||
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
      this.volume <= 0 ||
      (this.paused && !allowWhilePaused) ||
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
    let active: ActiveSource | undefined;
    try {
      source = context.createBufferSource();
      sourceGain = context.createGain();
      source.buffer = buffer;
      source.loop = cue.loop;
      source.playbackRate.value = clamp(options.playbackRate ?? 1, 0.75, 1.5);
      sourceGain.gain.value = cue.gain * clamp(options.gain ?? 1, 0, 2);
      source.connect(sourceGain);
      sourceGain.connect(masterGain);
      active = {
        cueId: id,
        priority: cue.priority,
        sequence: this.sequence++,
        source,
        gain: sourceGain,
      };
      const activeSource = active;
      source.onended = () => this.removeSource(activeSource);
      this.sources.add(active);
      source.start();
      return true;
    } catch {
      if (active) {
        this.removeSource(active);
        return false;
      }
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
    this.suspendSequence += 1;
    this.unlocked = false;
    this.pageDocument?.removeEventListener(
      "visibilitychange",
      this.visibilityListener,
    );
    this.stopAll();
    this.buffers.clear();
    this.cancelLoads();
    this.retireContext();
    if (
      this.audioSessionConfigured &&
      this.previousAudioSessionType !== undefined &&
      this.audioSession
    ) {
      try {
        if (this.audioSession.type === "playback")
          this.audioSession.type = this.previousAudioSessionType;
      } catch {
        /* The draft Audio Session API is optional. */
      }
    }
  }

  private configureAudioSession(): void {
    if (!this.audioSession || this.audioSessionConfigured) return;
    try {
      this.previousAudioSessionType = this.audioSession.type;
      this.audioSession.type = "playback";
      this.audioSessionConfigured = this.audioSession.type === "playback";
    } catch {
      /* Unsupported or policy-restricted implementations use their default. */
    }
  }

  private confirmOnce(): Promise<boolean> {
    if (this.confirmationPlayed) return Promise.resolve(true);
    if (this.confirmationPromise) return this.confirmationPromise;
    const confirmation = this.playCue(
      "ui-confirmed",
      { gain: 1, playbackRate: 1 },
      true,
    )
      .then((played) => {
        if (played) this.confirmationPlayed = true;
        return played;
      })
      .finally(() => {
        if (this.confirmationPromise === confirmation)
          this.confirmationPromise = undefined;
      });
    this.confirmationPromise = confirmation;
    return confirmation;
  }

  /**
   * Safari can leave resume() pending indefinitely after an interruption. One
   * physical tap may also surface as several pointer/touch/click events, so all
   * callers share one bounded attempt for the current context.
   */
  private resumeContext(context: AudioContext): Promise<boolean> {
    if (this.resumeAttempt?.context === context)
      return this.resumeAttempt.promise;

    let cancel: () => void = () => undefined;
    const promise = new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (ready: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(ready);
      };
      cancel = () => finish(false);
      const timer = setTimeout(cancel, this.resumeTimeoutMs);
      try {
        void context.resume().then(
          () => finish(context.state === "running"),
          () => finish(false),
        );
      } catch {
        finish(false);
      }
    });
    const attempt = { context, promise, cancel };
    this.resumeAttempt = attempt;
    void promise.then(() => {
      if (this.resumeAttempt === attempt) this.resumeAttempt = undefined;
    });
    return promise;
  }

  private retireContext(): void {
    const context = this.context;
    this.releaseContext();
    if (!context || context.state === "closed") return;
    try {
      void context.close().catch(() => undefined);
    } catch {
      /* Closing unsupported or interrupted audio remains harmless. */
    }
  }

  private releaseContext(): void {
    const context = this.context;
    this.stopAll();
    if (context && this.contextStateListener)
      context.removeEventListener("statechange", this.contextStateListener);
    try {
      this.masterGain?.disconnect();
      this.limiter?.disconnect();
    } catch {
      /* A closed context may have already detached its graph. */
    }
    this.contextStateListener = undefined;
    this.resumeAttempt?.cancel();
    this.resumeAttempt = undefined;
    this.confirmationPromise = undefined;
    this.confirmationPlayed = false;
    this.limiter = undefined;
    this.masterGain = undefined;
    this.context = undefined;
    this.contextNeedsReplacement = false;
    this.unlocked = false;
    this.buffers.clear();
    this.cancelLoads();
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

    if (!isSameOriginAsset(cue.path)) return Promise.resolve(undefined);
    const abort = new AbortController();
    let cancel: () => void = () => undefined;
    const load = new Promise<AudioBuffer | undefined>((resolve) => {
      let settled = false;
      const finish = (buffer: AudioBuffer | undefined) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(buffer);
      };
      cancel = () => {
        abort.abort();
        finish(undefined);
      };
      const timer = setTimeout(cancel, this.loadTimeoutMs);

      void (async () => {
        try {
          const response = await this.fetcher(cue.path, {
            credentials: "same-origin",
            redirect: "error",
            signal: abort.signal,
          });
          if (!response.ok) {
            finish(undefined);
            return;
          }
          const buffer = await context.decodeAudioData(
            await response.arrayBuffer(),
          );
          if (
            settled ||
            this.disposed ||
            this.context !== context ||
            abort.signal.aborted
          )
            return;
          this.buffers.set(id, buffer);
          finish(buffer);
        } catch {
          finish(undefined);
        }
      })();
    });
    this.loads.set(id, load);
    this.loadCancels.set(id, cancel);
    void load.then(() => {
      if (this.loads.get(id) === load) this.loads.delete(id);
      if (this.loadCancels.get(id) === cancel) this.loadCancels.delete(id);
    });
    return load;
  }

  private cancelLoads(): void {
    for (const cancel of [...this.loadCancels.values()]) cancel();
    this.loadCancels.clear();
    this.loads.clear();
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
