export type Ability = "move" | "interact" | "jump";
export type AppearanceStage = "infant" | "child";
export type SaveFormat = "legacy-v1" | "era-combat-v2";
export type MemoryState = "locked" | "released" | "revealed" | "consumed";
export type AdventurePhase = "exploring" | "memory-released" | "fallen" | "complete";
export type EquipmentKind = "attack-tool" | "guard-tool";
export type EncounterRole = "ordinary" | "boss";
export type EncounterKind = "ordinary-a" | "ordinary-b" | "boss";
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
export interface EncounterView {
  id: string;
  role: EncounterRole;
  kind: EncounterKind;
  maxHp: number;
  hp: number;
  attackDamage: number;
  defeated: boolean;
  available: boolean;
}
export interface ActiveLevelView {
  id: string;
  index: number;
  totalLevels: number;
  startAgeYears: number;
  targetAgeYears: number;
  startDate: string;
  eraYear: number;
  memoryIds: string[];
  pickups: EquipmentView[];
  encounters: EncounterView[];
  bossId: string;
}
export interface AdventureView {
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
  | { type: "take-hit"; levelId: string; encounterId: string }
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
export interface SessionView {
  player: { id: string; label: string };
  mode: "fixture";
  csrfHeader: "X-Quest-Request";
}
export interface ApiError {
  error: { code: string; message: string };
}
