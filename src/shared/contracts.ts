import type { ParodyPeriodId } from './parody-catalog.js';

export type Ability = "move" | "interact" | "jump";
export type AppearanceStage = "infant" | "child";
export type SaveFormat = "legacy-v1" | "era-combat-v2";
export type MemoryState = "locked" | "released" | "revealed" | "consumed";
export type MemoryRole = "minor" | "major";
export type AdventurePhase = "exploring" | "memory-released" | "fallen" | "complete";
export type EquipmentKind = "attack-tool" | "guard-tool";
export type EncounterRole = "ordinary" | "boss";
export type EncounterKind = "ordinary-a" | "ordinary-b" | "boss";
export type BossGate = "independent" | "after-ordinaries";
export interface SubjectOption {
  id: string;
  label: string;
}
export interface MemoryPreview {
  id: string;
  date: string;
  ageYears: number;
  label: string;
  mediaUrl?: string;
}
export interface MemoryView extends MemoryPreview {
  state: MemoryState;
  /** Present for route-memory plans; absent for archived plans. */
  role?: MemoryRole;
  mediaUrl?: string;
}
export interface Appearance {
  contractVersion: string;
  subjectAppearanceId: string;
  stage: AppearanceStage;
}
export interface RuleVersions {
  journey: string;
  age: string;
  progression: string;
  appearance: string;
  catalog?: string;
  combat?: string;
}
export interface EquipmentView {
  id: string;
  pickupId: string;
  kind: EquipmentKind;
  tier: number;
  damage: number;
  guardReduction: number;
  collected: boolean;
}
export interface FrozenEncounterContent {
  catalogEntryId: string;
  catalogEntryVersion: string;
  assetId: string;
  assetVersion: string;
  /** Frozen author-facing identity for a project-local candidate. */
  displayName?: string;
  /** A candidate remains neutral placeholder art until its exact asset is reviewed. */
  placeholder?: "neutral-candidate-v1";
}
export interface EncounterView {
  id: string;
  role: EncounterRole;
  kind: EncounterKind;
  content?: FrozenEncounterContent;
  maxHp: number;
  hp: number;
  attackDamage: number;
  defeated: boolean;
  available: boolean;
}
export interface FriendlyView {
  id: string;
  assetId: string;
  assetVersion: string;
  maxHp: number;
  hp: number;
  defeated: boolean;
  boonClaimed: boolean;
  penaltyActive: boolean;
}
export interface ActiveLevelView {
  id: string;
  index: number;
  totalLevels: number;
  startAgeYears: number;
  targetAgeYears: number;
  startDate: string;
  eraYear: number;
  periodId?: ParodyPeriodId;
  /** Published route ID or a validated project-local editor route ID. */
  routeId?: string;
  /** Explicit only when a frozen plan overrides the published route policy. */
  bossGate?: BossGate;
  memoryIds: string[];
  /** Present for route-memory plans; `memoryIds` remains the ordered combined view. */
  minorMemoryIds?: [string, string];
  /** Present for route-memory plans and always follows the two minor memories. */
  majorMemoryId?: string;
  /** Present only for an authored v2 plan; IDs name optional ordinary encounters. */
  optionalEncounterIds?: string[];
  pickups: EquipmentView[];
  encounters: EncounterView[];
  /** Added after the initial combat contract; absent in older serialized fixtures. */
  friendlies?: FriendlyView[];
  bossId: string;
}
export interface AdventureView {
  planVersion?: string;
  catalogVersion?: string;
  phase: AdventurePhase;
  activeLevelIndex: number;
  currentLevelId: string | null;
  activeLevel: ActiveLevelView | null;
  completedLevelIds: string[];
  consumedMemoryIds: string[];
  inventory: EquipmentView[];
  equippedId: string | null;
  playerHp: number;
  maxPlayerHp: number;
  attackCooldownRemainingMs: number;
  /** Present for route-memory plans, whose guard tool acts as an offhand attack. */
  secondaryCooldownRemainingMs?: number;
  guardActiveRemainingMs: number;
  guardCooldownRemainingMs: number;
}
export interface SaveView {
  id: string;
  title: string;
  subject: SubjectOption;
  memories: MemoryView[];
  recoveredIds: string[];
  ageYears: number;
  abilities: Ability[];
  appearance: Appearance;
  completed: boolean;
  format: SaveFormat;
  adventure: AdventureView | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
  versions: RuleVersions;
}
export type GameplayAction =
  | { type: "collect-equipment"; levelId: string; pickupId: string }
  | { type: "attack"; levelId: string; encounterId: string }
  | { type: "secondary-attack"; levelId: string; encounterId: string }
  | { type: "take-hit"; levelId: string; encounterId: string }
  | { type: "interact-friendly"; levelId: string; friendlyId: string }
  | { type: "attack-friendly"; levelId: string; friendlyId: string }
  | { type: "guard"; levelId: string }
  | { type: "recover-memory"; levelId: string; memoryId: string }
  | { type: "consume-memory-bundle"; levelId: string }
  | { type: "retry-level"; levelId: string };
export interface GameplayActionRequest {
  actionId: string;
  expectedRevision: number;
  action: GameplayAction;
}
export interface SaveSummary {
  id: string;
  title: string;
  subject: SubjectOption;
  ageYears: number;
  recoveredCount: number;
  memoryCount: number;
  completed: boolean;
  format: SaveFormat;
  createdAt: string;
  updatedAt: string;
}
export interface PreviewRequest {
  name: string;
  birthDate: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  subjectId?: string;
}
export interface PreviewResponse {
  previewId: string;
  subjects: SubjectOption[];
  candidates: MemoryPreview[];
  coverage: {
    fromDate: string | null;
    toDate: string | null;
    incomplete: boolean;
    scanned: number;
  };
  selectedIds: string[];
}
export type PlayerRole = "admin" | "player";

/** Fictional playtest / fixture sessions. Never issued by the family release. */
export interface FixtureSessionView {
  player: { id: string; label: string };
  mode: "fixture";
  progressMode?: "ephemeral" | "persistent";
  csrfHeader: "X-Quest-Request";
}

/** An admitted Authentik household member (ADR-005). `role` is re-derived at every sign-in. */
export interface FamilySessionView {
  player: { id: string; label: string };
  mode: "family";
  role: PlayerRole;
  /** True when the server can also end the Authentik session on sign-out. */
  endSessionAvailable: boolean;
  csrfHeader: "X-Quest-Request";
}

export type SessionView = FixtureSessionView | FamilySessionView;

export interface SignOutRequest {
  /** Also sign out of Authentik ("Haynes Network") on a shared device. */
  endSession?: boolean;
}

export interface SignOutResponse {
  signedOut: true;
  /** Where to send the browser to end the Authentik session, when requested and configured. */
  endSessionUrl: string | null;
}
export interface ApiError {
  error: { code: string; message: string };
}
