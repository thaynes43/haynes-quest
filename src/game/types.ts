import type { AuthoredLevelDocument } from "../shared/authored-level";
import type { AuthoredLevelResolver } from "./authored-layout";
import type { ObbySample } from "./obby";
import type {
  Ability,
  AdventurePhase,
  AppearanceStage,
  EncounterKind,
  EncounterRole,
  EquipmentKind,
  GameplayAction,
  GameplayActionRequest,
  SaveView,
} from "../shared/contracts";

export type GameInputAction =
  | "moveX"
  | "moveY"
  | "lookX"
  | "lookY"
  | "jump"
  | "interact"
  | "attack"
  | "guard";

export interface GameInputSnapshot {
  moveX: number;
  moveY: number;
  lookX: number;
  lookY: number;
  jump: boolean;
  interact: boolean;
  attack: boolean;
  guard: boolean;
}

export interface PositionSnapshot {
  x: number;
  y: number;
  z: number;
}

export type RequestState = "idle" | "acting" | "error";
export type RequestError = GameplayAction["type"] | null;

export type EnemyPhase =
  "idle" | "chasing" | "windup" | "strike" | "cooldown" | "defeated";

export interface EnemyFrame {
  id: string;
  position: PositionSnapshot;
  facing: number;
  phase: EnemyPhase;
  windupProgress: number;
  hp: number;
  maxHp: number;
  /**
   * DESIGN-027 D-04 watcher idle pose (0 is the authored stance). Present only
   * on scare levels 1+, so level 0 frames are exactly as before.
   */
  pose?: number;
}

export interface SceneFrame {
  deltaSeconds: number;
  moving: boolean;
  grounded: boolean;
  attacking: boolean;
  attackTargetId: string | null;
  guarding: boolean;
  attackSequence?: number;
  secondaryAttacking?: boolean;
  interacting?: boolean;
  enemies: EnemyFrame[];
  currentTarget: string | null;
  besties?: import("./besties").BestiesFrame;
  bestiesHitActorId?: import("./besties").BestieActorId | null;
  obby?: ObbySample;
  checkpointId?: string | null;
  recovering?: boolean;
  /** Animation time for this frame after hit-stop; physics uses `deltaSeconds`. */
  visualDeltaSeconds?: number;
  /** Camera shake offset in metres; zero or absent when calm. */
  cameraShake?: PositionSnapshot;
  /**
   * DESIGN-025 D-02 visual growth scale. Present only on levels that use growth
   * moves; absent keeps the exact published avatar and camera presentation.
   */
  growthScale?: number;
  /**
   * DESIGN-027 lighting, blackout and lunge state. Present only on chapters
   * playing at scare level 1 or 2; absent keeps today's presentation.
   */
  scare?: import("./scare").ScareFrame;
}

/**
 * Immediate presentation events for sound and effects (DESIGN-022).
 *
 * DESIGN-008's family world cues add the `familyWorld` and `theme` fields and
 * the events after `hurt`. They appear only on family world levels (an
 * `authored-level-v4` route or a family plan, the levels with growth moves),
 * so every older route reports exactly the events it did before.
 */
export type GameFeedbackEvent =
  | { type: "hit"; encounterId: string; kind: "primary" | "secondary" }
  | {
      type: "defeat";
      encounterId: string;
      boss: boolean;
      /** Present on family world levels, which layer a poof under the defeat. */
      familyWorld?: true;
    }
  | { type: "token"; streak: number }
  | {
      type: "ticket";
      /** The authored level's theme, present on family world levels. */
      theme?: string;
    }
  /** A bounce pad launched the player (DESIGN-025 D-04). */
  | { type: "bounce" }
  | { type: "hurt" }
  /** The second jump of an airtime (DESIGN-025 D-01). */
  | { type: "double-jump" }
  /** A crumbling platform started to shake under the player (DESIGN-025 D-04). */
  | { type: "crumble"; platformId: string }
  /** The lift the player rides reached its top or bottom stop (DESIGN-025 D-04). */
  | { type: "lift-stop"; platformId: string }
  /** The glide started holding the player's fall, or stopped (DESIGN-025 D-01). */
  | { type: "glide"; active: boolean }
  /** An enemy began winding up an attack; `assetId` is its rendered catalog model. */
  | { type: "windup"; encounterId: string; assetId: string }
  /*
   * DESIGN-027 scary moments. Only chapters playing at scare level 1 or 2
   * report these, so every other chapter's events are unchanged.
   */
  /** Level 2: an enemy's lethal attack became a lunge for `durationMs`; recovery follows. */
  | { type: "jump-scare"; encounterId: string; durationMs: number }
  /** A sleeping animatronic that moved while unseen was seen again. */
  | { type: "watcher-creak"; encounterId: string }
  /** Level 2: the lights came back after a blackout. */
  | { type: "blackout-return" }
  /** Level 2: random distant mechanical laughter. */
  | { type: "ambient-laugh" }
  /** The radio showman began an attack. */
  | { type: "radio-static"; encounterId: string }
  /** The creepy ambience should play (active world at level 1+) or stop. */
  | { type: "scare-ambient-loop"; active: boolean };

export type AttackAttemptOutcome =
  | "accepted"
  | "guarded"
  | "no-target"
  | "unarmed"
  | "cooldown"
  | "busy"
  | "unavailable";

export interface AttackFeedback {
  sequence: number;
  outcome: AttackAttemptOutcome;
  kind?: "primary" | "secondary";
}

export interface SceneMediaState {
  loading: number;
  failed: number;
  reloadRequired?: boolean;
}

export interface MemoryVisualInspection {
  id: string;
  /** The current value on the Three.js memory root. */
  visible: boolean;
}

export interface BestiesPoseInspection {
  head?: PositionSnapshot;
  leftHand?: PositionSnapshot;
  rightHand?: PositionSnapshot;
}

export interface BestiesActorVisualInspection {
  id: import("./besties").BestieActorId;
  /** World-space position of the actor's rendered root. */
  position: PositionSnapshot;
  /** False when the actor or any ancestor in the rendered scene is hidden. */
  visible: boolean;
  clip: import("./besties").BestiesClipName | null;
  pose?: BestiesPoseInspection;
}

export interface SceneVisualInspection {
  memories: MemoryVisualInspection[];
  besties?: BestiesActorVisualInspection[];
  collectibles?: import("./token-scene").TokenSceneInspection;
  /** Live effect particles, for checking that contact and pickups burst. */
  particles?: number;
  /** DESIGN-027 presentation on chapters playing at scare level 1+. */
  scare?: {
    practicals: number;
    practicalScale: number;
    eyes: number;
    /** Level 2 eyes always show; they glow faintly between scares. */
    eyesVisible: boolean;
    /** The eyes flare in a flicker dip, a blackout or a lunge. */
    eyesFlared: boolean;
  };
}

export interface GameStatus {
  jumpSequence?: number;
  /**
   * How many `jumpSequence` increments were a bounce pad launch or a double
   * jump, which sound through `onFeedback` instead of the jump cue. Present
   * only on levels with growth moves (DESIGN-025).
   */
  launchJumpSequence?: number;
  interactionSequence?: number;
  nearFriendlyId?: string | null;
  bestiesPhase?: import("./besties").BestiesPhase;
  bossEngaged?: boolean;
  nearPickupId: string | null;
  nearEncounterId: string | null;
  nearMemoryId: string | null;
  /** A visible big memory in contact range whose little memories remain incomplete. */
  nearLockedMajorMemoryId?: string | null;
  /** An approached boss whose frozen ordinary-win prerequisite is still unmet. */
  nearLockedBossId?: string | null;
  nearFinish: boolean;
  canConsume: boolean;
  position: PositionSnapshot;
  ageYears: number;
  appearanceStage: AppearanceStage;
  abilities: Ability[];
  /** DESIGN-025 growth moves in force on this level; absent means jump-only. */
  growthMoves?: string[];
  grounded: boolean;
  playerHp: number;
  maxPlayerHp: number;
  phase: AdventurePhase;
  activeLevelId: string | null;
  eraYear: number | null;
  attackReady: boolean;
  attackFeedback: AttackFeedback | null;
  guardActive: boolean;
  guardReady: boolean;
  requestBusy: boolean;
  requestState: RequestState;
  requestError: RequestError;
  requestErrorCode: string | null;
  mediaLoading: number;
  mediaFailed: number;
  mediaReloadRequired?: boolean;
  /** Casino tokens and golden tickets this run; absent on other chapters. */
  collectibles?: import("./casino-tokens").CollectibleCounts | null;
  /**
   * Themed names for a v4 trail (DESIGN-025 D-05); absent means the casino's
   * tokens and golden tickets.
   */
  collectibleNames?: import("./theme-kits").TrailNames;
}

export interface MemoryPlacementInspection extends PositionSnapshot {
  id: string;
  state: "locked" | "released" | "revealed" | "consumed";
}

export interface PickupInspection extends PositionSnapshot {
  id: string;
  equipmentId: string;
  kind: EquipmentKind;
  collected: boolean;
}

export interface EncounterInspection extends PositionSnapshot {
  id: string;
  role: EncounterRole;
  kind: EncounterKind;
  hp: number;
  maxHp: number;
  localPhase: EnemyPhase;
}

export interface LevelInspection {
  id: string | null;
  authored?: AuthoredLevelDocument;
  memoryIds: string[];
  memoryPositions: MemoryPlacementInspection[];
  pickupPositions: PickupInspection[];
  encounterPositions: EncounterInspection[];
  friendlyPositions?: Array<PositionSnapshot & { id: string; assetId: string }>;
  finishPosition: PositionSnapshot;
  step: null | { z: number; height: number; unlockMemoryId: string };
}

export interface GameInspection {
  status: GameStatus;
  input: GameInputSnapshot;
  checkpoint: PositionSnapshot;
  level: LevelInspection;
  enemies: EnemyFrame[];
  visuals?: SceneVisualInspection;
  obby?: ObbySample & {
    routeId: string;
    checkpointId: string | null;
    supportId: string | null;
    recoveryRemaining: number;
    recoveries: number;
    /** The course clock the sampled geometry is at (seconds since the route started). */
    timeSeconds: number;
    /**
     * A copy of the traversal state, for lockstep harnesses that plan the
     * next frames with the same `stepObby`. Read-only: changing it has no effect.
     */
    state: import("./obby").ObbyState;
  };
  /** Planned casino collectibles with their collected state; null elsewhere. */
  collectibles?: {
    counts: import("./casino-tokens").CollectibleCounts;
    items: Array<
      import("./casino-tokens").CollectiblePlacement & { collected: boolean }
    >;
  } | null;
  /** DESIGN-027 runtime state; present only on chapters playing at scare level 1+. */
  scare?: {
    level: import("./scare").ScareLevel;
    lighting: import("./scare").ScareLighting;
    lunge: import("./scare").ScareLunge | null;
    blackouts: number;
    flickers: number;
    watcherMoves: number;
    /** Changed watchers seen again (each creaks once), and the ids of the latest frame that had any. */
    watcherCreaks: number;
    lastWatcherCreakIds: string[];
    jumpScares: number;
  };
  disposed: boolean;
}

export interface CreateGameOptions {
  container: HTMLElement;
  save: SaveView;
  onAction: (request: GameplayActionRequest) => Promise<SaveView>;
  onRefresh: () => Promise<SaveView>;
  onStatus?: (status: GameStatus) => void;
  /**
   * Resolves the authored document behind the active route. An editor preview
   * passes its frozen per-project resolver; every rebuild this game performs
   * reads it again, so an action response or a chapter transition cannot fall
   * back to the published route. Omit it for ordinary play.
   */
  authoredLevelResolver?: AuthoredLevelResolver;
  /** Fires at the moment of contact, pickup or defeat, before any server reply. */
  onFeedback?: (event: GameFeedbackEvent) => void;
  /**
   * DESIGN-027 D-02 per-device switch. `false` plays every chapter at scare
   * level 0; omitted means on, the switch's default.
   */
  scaryMoments?: boolean;
}

export interface GameHandle {
  updateSave(save: SaveView): void;
  setInput(action: GameInputAction, value: number | boolean): void;
  cancelInput(action: GameInputAction): void;
  clearInput(): void;
  setPaused(paused: boolean): void;
  performAction(action: GameplayAction): boolean;
  /** Return locally to the first missing little memory's safe approach. */
  returnToMissingMemory(): boolean;
  /** Return locally to the final memory once both little memories are held. */
  returnToMajorMemory(): boolean;
  /** Escape a one-way route while an authored chapter's boss still needs ordinary wins. */
  returnToChapterStart(): boolean;
  retryMedia(): void;
  inspect(): GameInspection;
  dispose(): void;
}

export interface AvatarProportions {
  height: number;
  colliderRadius: number;
  headRadius: number;
  torsoHeight: number;
  legLength: number;
  posture: number;
  cameraTargetHeight: number;
}
