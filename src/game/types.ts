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
}

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
}

export interface GameStatus {
  jumpSequence?: number;
  interactionSequence?: number;
  nearFriendlyId?: string | null;
  bestiesPhase?: import("./besties").BestiesPhase;
  bossEngaged?: boolean;
  nearPickupId: string | null;
  nearEncounterId: string | null;
  nearMemoryId: string | null;
  nearFinish: boolean;
  canConsume: boolean;
  position: PositionSnapshot;
  ageYears: number;
  appearanceStage: AppearanceStage;
  abilities: Ability[];
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
}

export interface GameHandle {
  updateSave(save: SaveView): void;
  setInput(action: GameInputAction, value: number | boolean): void;
  cancelInput(action: GameInputAction): void;
  clearInput(): void;
  setPaused(paused: boolean): void;
  performAction(action: GameplayAction): boolean;
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
