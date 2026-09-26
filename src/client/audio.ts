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

/**
 * DESIGN-008's eight family world v001 candidates, played only on family world
 * levels (an `authored-level-v4` route or a family plan). Nobody has listened
 * to them yet and Tom's exact-version review is pending; the review pages
 * record the measurements the trims came from.
 *
 * Gains follow the playtest rule above: at the 0.8 master, each one-shot peaks
 * between -12.5 and -10.0 dBFS. The glide wind loops under everything else, so
 * it peaks near -16 dBFS instead. Priorities keep the reward sparkle with the
 * memory cues, warnings (crack, chime, honk, poof) and the wind above the
 * movement blips, and the whoosh and boing with the jump sounds.
 */
export const familyWorldCues = {
  "bounce-pad-boing": {
    assetId: "bounce-pad-boing",
    version: "v001",
    path: "/studio/assets/media/bounce-pad-boing/v001/cue.wav",
    sha256: "ccc7dc45d2fadc86f9ed2405588e217d0f6b399de823223e992df07559e151b4",
    durationSeconds: 0.6,
    loop: false,
    gain: 1.1,
    priority: 1,
    maxInstances: 1,
  },
  "lift-arrival-chime": {
    assetId: "lift-arrival-chime",
    version: "v001",
    path: "/studio/assets/media/lift-arrival-chime/v001/cue.wav",
    sha256: "cc3bd16ca66ac18f1d33586de4771a069e611ac28de1e8650d1d21a48d71343e",
    durationSeconds: 0.8,
    loop: false,
    gain: 1.1,
    priority: 2,
    maxInstances: 1,
  },
  "crumble-crack": {
    assetId: "crumble-crack",
    version: "v001",
    path: "/studio/assets/media/crumble-crack/v001/cue.wav",
    sha256: "2ac76e286d5ea86d6f9945242325328146bf0728a8a9c9fd84faaf74caf6c714",
    durationSeconds: 0.7,
    loop: false,
    gain: 1.4,
    priority: 2,
    maxInstances: 2,
  },
  "double-jump-whoosh": {
    assetId: "double-jump-whoosh",
    version: "v001",
    path: "/studio/assets/media/double-jump-whoosh/v001/cue.wav",
    sha256: "bfef347311b767f83405e2dde0c32461a9c1c282e56d3ce649886056ab91ac87",
    durationSeconds: 0.45,
    loop: false,
    gain: 1.3,
    priority: 1,
    maxInstances: 1,
  },
  "glide-wind": {
    assetId: "glide-wind",
    version: "v001",
    path: "/studio/assets/media/glide-wind/v001/cue.wav",
    sha256: "771b0b48ed90995151f5702dbe6bfc629055a845a1fee0d58216dbdb80c3d046",
    durationSeconds: 1.6,
    loop: true,
    gain: 1.6,
    priority: 2,
    maxInstances: 1,
  },
  "golden-ticket-sparkle": {
    assetId: "golden-ticket-sparkle",
    version: "v001",
    path: "/studio/assets/media/golden-ticket-sparkle/v001/cue.wav",
    sha256: "6552e29f39594831ae26c43ed957ba8e47b53074ba762d50c7e1ab2d18d1ad60",
    durationSeconds: 1,
    loop: false,
    gain: 1.1,
    priority: 3,
    maxInstances: 1,
  },
  "honk-bus-honk": {
    assetId: "honk-bus-honk",
    version: "v001",
    path: "/studio/assets/media/honk-bus-honk/v001/cue.wav",
    sha256: "9cf5a706227fa651a3b4890f439191b1c9bd49e67de14789badca06dcb914087",
    durationSeconds: 0.8,
    loop: false,
    gain: 1.3,
    priority: 2,
    maxInstances: 1,
  },
  "enemy-poof": {
    assetId: "enemy-poof",
    version: "v001",
    path: "/studio/assets/media/enemy-poof/v001/cue.wav",
    sha256: "b4ae4aa1bc598ef7ebe9e42296dedbe83e799532045ed3cfc45c1cf9da339712",
    durationSeconds: 0.6,
    loop: false,
    gain: 1.1,
    priority: 2,
    maxInstances: 2,
  },
} as const satisfies Readonly<Record<string, QuestAudioCue>>;

export type FamilyWorldCueId = keyof typeof familyWorldCues;

/**
 * DESIGN-027 D-06's six scary-moment v001 candidates, for chapters with a
 * scare level. They are registered here so the scare pass can play them; no
 * gameplay event triggers them yet. Nobody has listened to them and Tom's
 * exact-version review is pending; the review pages record the measurements.
 *
 * Mix at the 0.8 master: the jump-scare sting is deliberately the loudest cue
 * (peak -6 dBFS, 3 dB under the limiter threshold) and outranks every other
 * sound at the source cap. The creak, buzz and static peak in the one-shot
 * range (-12.5 to -10.0 dBFS), the distant laugh sits under it near -16, and
 * the casino hum loops under everything near -20. The hum ranks with the
 * ability cue so ordinary one-shots cannot push the ambience out at the cap.
 */
export const scareCues = {
  "jump-scare-sting": {
    assetId: "jump-scare-sting",
    version: "v001",
    path: "/studio/assets/media/jump-scare-sting/v001/cue.wav",
    sha256: "cdc0b85cee5df4f9ffe68780c6916f58ce4bfda3678f1979102a698a9a8e81af",
    durationSeconds: 1,
    loop: false,
    gain: 1.25,
    priority: 5,
    maxInstances: 1,
  },
  "servo-creak": {
    assetId: "servo-creak",
    version: "v001",
    path: "/studio/assets/media/servo-creak/v001/cue.wav",
    sha256: "57b4353d22a9cb5b0579c204b653f1223b1b1a0d5b57b1d218e5927a56b5232f",
    durationSeconds: 0.8,
    loop: false,
    gain: 1.2,
    priority: 2,
    maxInstances: 1,
  },
  "light-buzz": {
    assetId: "light-buzz",
    version: "v001",
    path: "/studio/assets/media/light-buzz/v001/cue.wav",
    sha256: "2661589019ecf14ccc4a005df7b2225dee7efe4704fce1661383ac6e8d6c3e68",
    durationSeconds: 2,
    loop: false,
    gain: 1.4,
    priority: 3,
    maxInstances: 1,
  },
  "distant-laugh": {
    assetId: "distant-laugh",
    version: "v001",
    path: "/studio/assets/media/distant-laugh/v001/cue.wav",
    sha256: "86721f34a4e11b8706ec3aae9eabaeb0715cd0d9498ccf171f037e86f8fdc73a",
    durationSeconds: 1.5,
    loop: false,
    gain: 1,
    priority: 1,
    maxInstances: 1,
  },
  "radio-static": {
    assetId: "radio-static",
    version: "v001",
    path: "/studio/assets/media/radio-static/v001/cue.wav",
    sha256: "ed441796c364cb590401ebde30793f6764ce9a43469c6ec05baf9cb03f7c61a3",
    durationSeconds: 0.8,
    loop: false,
    gain: 1.1,
    priority: 2,
    maxInstances: 1,
  },
  "casino-hum": {
    assetId: "casino-hum",
    version: "v001",
    path: "/studio/assets/media/casino-hum/v001/cue.wav",
    sha256: "bed43b1b73a27f834715e75463e9719c5df363fe13833fd03459ecb0bcefdc6d",
    durationSeconds: 8,
    loop: true,
    gain: 1,
    priority: 4,
    maxInstances: 1,
  },
} as const satisfies Readonly<Record<string, QuestAudioCue>>;

export type ScareCueId = keyof typeof scareCues;

/**
 * Every cue the game may play: the playtest four, the family world eight and
 * the six scary-moment cues.
 */
export const questCues = {
  ...playtestCues,
  ...familyWorldCues,
  ...scareCues,
} as const satisfies Readonly<Record<string, QuestAudioCue>>;

export type QuestCueId = keyof typeof questCues;

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
  // DESIGN-022 reuses the same candidates, unchanged, for casino rewards.
  token: {
    cueId: "ui-confirmed",
    options: { gain: 0.8, playbackRate: 1.25 },
  },
  ticket: {
    cueId: "ability-unlocked",
    options: { gain: 0.9, playbackRate: 1.12 },
  },
  defeat: {
    cueId: "memory-collected",
    options: { gain: 0.7, playbackRate: 1.3 },
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
/** A loop fades in and out over this long, so starting or stopping never clicks. */
const LOOP_FADE_SECONDS = 0.06;

function clamp(value: number, minimum: number, maximum: number): number {
  return Number.isFinite(value)
    ? Math.max(minimum, Math.min(maximum, value))
    : minimum;
}

/** Ramps a gain node; browsers without automation just jump to the target. */
function rampGain(
  context: AudioContext,
  node: GainNode,
  from: number,
  to: number,
  seconds: number,
): void {
  try {
    const now = context.currentTime;
    node.gain.cancelScheduledValues(now);
    node.gain.setValueAtTime(from, now);
    node.gain.linearRampToValueAtTime(to, now + seconds);
  } catch {
    node.gain.value = to;
  }
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
  /** The latest start request per looping cue; a newer request or a stop replaces it. */
  private readonly loopRequests = new Map<string, number>();
  private loopRequestSequence = 0;
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
    this.cues = options.cues ?? questCues;
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
    if (this.cues[id]?.loop) return false;
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
            const wasUnlocked = this.unlocked;
            this.unlocked = false;
            if (context.state !== "suspended" || wasUnlocked)
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
        if (this.context === context) this.retireContext();
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

  /** `pitch` scales the preset rate, so a quick run of tokens can climb. */
  feedback(id: GameplayFeedbackId, pitch = 1): Promise<boolean> {
    const feedback = gameplayFeedback[id];
    return this.cue(feedback.cueId, {
      ...feedback.options,
      playbackRate: feedback.options.playbackRate * pitch,
    });
  }

  /** Plays a one-shot cue; looping cues only start through `loop`. */
  cue(id: string, options: CuePlaybackOptions = {}): Promise<boolean> {
    if (this.cues[id]?.loop) return Promise.resolve(false);
    return this.playCue(id, options, false);
  }

  /**
   * Starts or stops a looping cue, such as the glide wind. One instance per
   * cue plays at a time, and it fades in and out briefly. Pause, mute,
   * backgrounding and disposal stop a loop like any other sound; it does not
   * restart by itself afterwards, only on the next `loop(id, true)`.
   * Resolves whether the loop is playing when the call settles.
   */
  async loop(id: string, active: boolean): Promise<boolean> {
    const cue = this.cues[id];
    if (!cue?.loop) return false;
    if (!active) {
      this.loopRequests.delete(id);
      for (const source of [...this.sources])
        if (source.cueId === id) this.fadeOutSource(source);
      return false;
    }
    if ([...this.sources].some((source) => source.cueId === id)) return true;
    const request = ++this.loopRequestSequence;
    this.loopRequests.set(id, request);
    const started = await this.startSource(
      id,
      {},
      false,
      () => this.loopRequests.get(id) === request,
    );
    if (!started) {
      if (this.loopRequests.get(id) === request) this.loopRequests.delete(id);
      return false;
    }
    if (this.loopRequests.get(id) !== request) {
      // A stop, or a newer start that already has its own source, won the race.
      this.stopSource(started);
      return false;
    }
    return true;
  }

  private async playCue(
    id: string,
    options: CuePlaybackOptions,
    allowWhilePaused: boolean,
  ): Promise<boolean> {
    return (await this.startSource(id, options, allowWhilePaused)) !== undefined;
  }

  /** `stillWanted` lets a loop stop request cancel a start still loading. */
  private async startSource(
    id: string,
    options: CuePlaybackOptions,
    allowWhilePaused: boolean,
    stillWanted: () => boolean = () => true,
  ): Promise<ActiveSource | undefined> {
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
      return undefined;

    const buffer = await this.load(id, cue, context);
    if (
      !buffer ||
      !stillWanted() ||
      this.disposed ||
      !this.unlocked ||
      this.muted ||
      this.volume <= 0 ||
      (this.paused && !allowWhilePaused) ||
      this.backgrounded ||
      this.context !== context ||
      context.state !== "running"
    )
      return undefined;

    const sameCue = [...this.sources]
      .filter((active) => active.cueId === id)
      .sort((left, right) => left.sequence - right.sequence);
    if (sameCue.length >= cue.maxInstances) this.stopSource(sameCue[0]!);

    if (this.sources.size >= this.maxSources) {
      const victim = [...this.sources].sort(
        (left, right) =>
          left.priority - right.priority || left.sequence - right.sequence,
      )[0]!;
      if (victim.priority > cue.priority) return undefined;
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
      const level = cue.gain * clamp(options.gain ?? 1, 0, 2);
      sourceGain.gain.value = level;
      if (cue.loop) rampGain(context, sourceGain, 0, level, LOOP_FADE_SECONDS);
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
      return active;
    } catch {
      if (active) {
        this.removeSource(active);
        return undefined;
      }
      try {
        source?.disconnect();
        sourceGain?.disconnect();
      } catch {
        /* Partially created nodes are already silent. */
      }
      return undefined;
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

  /** Removes a loop from the cap at once and lets it fade out before it stops. */
  private fadeOutSource(active: ActiveSource): void {
    const context = this.context;
    if (!context) {
      this.stopSource(active);
      return;
    }
    this.sources.delete(active);
    try {
      const now = context.currentTime;
      active.gain.gain.cancelScheduledValues(now);
      active.gain.gain.setValueAtTime(active.gain.gain.value, now);
      active.gain.gain.linearRampToValueAtTime(0, now + LOOP_FADE_SECONDS);
      active.source.onended = () => this.disconnectSource(active);
      active.source.stop(now + LOOP_FADE_SECONDS);
    } catch {
      this.stopSource(active);
    }
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
