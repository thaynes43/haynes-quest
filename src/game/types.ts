import type { Ability, AppearanceStage, SaveView } from "../shared/contracts";

export type GameInputAction =
  "moveX" | "moveY" | "lookX" | "lookY" | "jump" | "interact";

export interface GameInputSnapshot {
  moveX: number;
  moveY: number;
  lookX: number;
  lookY: number;
  jump: boolean;
  interact: boolean;
}

export interface PositionSnapshot {
  x: number;
  y: number;
  z: number;
}

export type RequestState = "idle" | "recovering" | "finishing" | "error";
export type RequestError = "recover" | "finish" | null;

export interface GameStatus {
  nearMemoryId: string | null;
  nearFinish: boolean;
  position: PositionSnapshot;
  ageYears: number;
  appearanceStage: AppearanceStage;
  abilities: Ability[];
  grounded: boolean;
  recovering: boolean;
  requestState: RequestState;
  requestError: RequestError;
}

export interface LevelInspection {
  memoryIds: string[];
  memoryPositions: Array<PositionSnapshot & { id: string }>;
  finishPosition: PositionSnapshot;
  step: null | { z: number; height: number; unlockMemoryId: string };
}

export interface GameInspection {
  status: GameStatus;
  input: GameInputSnapshot;
  checkpoint: PositionSnapshot;
  level: LevelInspection;
  disposed: boolean;
}

export interface CreateGameOptions {
  container: HTMLElement;
  save: SaveView;
  onRecover: (memoryId: string) => Promise<SaveView>;
  onFinish: () => Promise<SaveView>;
  onStatus?: (status: GameStatus) => void;
}

export interface GameHandle {
  updateSave(save: SaveView): void;
  setInput(action: GameInputAction, value: number | boolean): void;
  clearInput(): void;
  setPaused(paused: boolean): void;
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
