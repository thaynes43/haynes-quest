import type {
  GameplayAction,
  GameplayActionRequest,
  SaveView,
} from "../shared/contracts";
import type { RequestError, RequestState } from "./types";

export interface ActionRequestState {
  requestState: RequestState;
  requestError: RequestError;
  requestErrorCode: string | null;
}

export interface ActionCoordinatorCallbacks {
  initialSave: SaveView;
  onAction: (request: GameplayActionRequest) => Promise<SaveView>;
  onRefresh: () => Promise<SaveView>;
  onApply: (save: SaveView) => void;
  onState: (state: ActionRequestState) => void;
  createActionId?: () => string;
}

const transportErrorCodes = new Set([
  "NETWORK_ERROR",
  "REQUEST_FAILED",
  "UNAVAILABLE",
]);

function secureRandomUnavailable(): Error & { code: string } {
  return Object.assign(new Error("Secure random values are unavailable"), {
    code: "SECURE_RANDOM_UNAVAILABLE",
  });
}

function createUuid(): string {
  const cryptoSource = globalThis.crypto;
  if (typeof cryptoSource?.randomUUID === "function") {
    try {
      return cryptoSource.randomUUID();
    } catch {
      // getRandomValues remains available in insecure browser contexts where
      // randomUUID may be missing or blocked.
    }
  }
  if (typeof cryptoSource?.getRandomValues !== "function") {
    throw secureRandomUnavailable();
  }
  const bytes = new Uint8Array(16);
  try {
    cryptoSource.getRandomValues(bytes);
  } catch {
    throw secureRandomUnavailable();
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

export function actionErrorCode(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const record = error as {
      code?: unknown;
      error?: { code?: unknown };
    };
    const code = record.error?.code ?? record.code;
    if (typeof code === "string" && code.trim())
      return code.trim().toUpperCase();
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim().toUpperCase();
  }
  return "UNAVAILABLE";
}

function isTransportFailure(error: unknown, code: string): boolean {
  return error instanceof TypeError || transportErrorCodes.has(code);
}

/**
 * Serializes server-owned gameplay commands and rejects responses that belong to
 * an obsolete save generation. One uncertain transport failure is retried with
 * the exact same request so the server's action idempotency remains effective.
 */
export class ActionCoordinator {
  private alive = true;
  private generation = 0;
  private saveId: string;
  private revision: number;
  private state: ActionRequestState = {
    requestState: "idle",
    requestError: null,
    requestErrorCode: null,
  };

  constructor(private readonly callbacks: ActionCoordinatorCallbacks) {
    this.saveId = callbacks.initialSave.id;
    this.revision = callbacks.initialSave.revision;
  }

  inspect(): ActionRequestState {
    return { ...this.state };
  }

  perform(action: GameplayAction): boolean {
    if (!this.alive || this.state.requestState === "acting") return false;
    let actionId: string;
    try {
      actionId = (this.callbacks.createActionId ?? createUuid)();
    } catch (error) {
      this.setState("error", action.type, actionErrorCode(error));
      return false;
    }
    const request: GameplayActionRequest = {
      actionId,
      expectedRevision: this.revision,
      action,
    };
    const requestGeneration = this.generation;
    this.setState("acting", null, null);
    void this.send(request, requestGeneration);
    return true;
  }

  authoritativeUpdate(save: SaveView): boolean {
    if (!this.alive) return false;
    if (save.id !== this.saveId || save.revision <= this.revision) return false;
    this.generation += 1;
    this.revision = save.revision;
    this.setState("idle", null, null);
    this.callbacks.onApply(save);
    return true;
  }

  dispose(): void {
    this.alive = false;
    this.generation += 1;
  }

  private async send(
    request: GameplayActionRequest,
    requestGeneration: number,
  ): Promise<void> {
    let response: SaveView;
    try {
      response = await this.callbacks.onAction(request);
    } catch (firstError) {
      if (!this.isCurrent(requestGeneration)) return;
      const firstCode = actionErrorCode(firstError);
      if (firstCode === "SAVE_REVISION_STALE") {
        await this.refreshAfterStale(request.action.type, requestGeneration);
        return;
      }
      if (!isTransportFailure(firstError, firstCode)) {
        this.setState("error", request.action.type, firstCode);
        return;
      }
      try {
        response = await this.callbacks.onAction(request);
      } catch (retryError) {
        if (!this.isCurrent(requestGeneration)) return;
        const retryCode = actionErrorCode(retryError);
        if (retryCode === "SAVE_REVISION_STALE") {
          await this.refreshAfterStale(request.action.type, requestGeneration);
          return;
        }
        this.setState("error", request.action.type, retryCode);
        return;
      }
    }

    if (!this.isCurrent(requestGeneration)) return;
    if (response.id !== this.saveId || response.revision <= this.revision) {
      this.setState("error", request.action.type, "STALE_ACTION_RESPONSE");
      return;
    }
    this.revision = response.revision;
    this.setState("idle", null, null);
    this.callbacks.onApply(response);
  }

  private async refreshAfterStale(
    action: GameplayAction["type"],
    requestGeneration: number,
  ): Promise<void> {
    try {
      const refreshed = await this.callbacks.onRefresh();
      if (!this.isCurrent(requestGeneration)) return;
      if (refreshed.id === this.saveId && refreshed.revision > this.revision) {
        this.revision = refreshed.revision;
        this.callbacks.onApply(refreshed);
      }
      this.setState("error", action, "SAVE_REVISION_STALE");
    } catch (refreshError) {
      if (!this.isCurrent(requestGeneration)) return;
      this.setState("error", action, actionErrorCode(refreshError));
    }
  }

  private isCurrent(generation: number): boolean {
    return this.alive && generation === this.generation;
  }

  private setState(
    requestState: RequestState,
    requestError: RequestError,
    requestErrorCode: string | null,
  ): void {
    this.state = { requestState, requestError, requestErrorCode };
    if (this.alive) this.callbacks.onState(this.inspect());
  }
}
