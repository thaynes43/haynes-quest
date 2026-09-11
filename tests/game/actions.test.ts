import { describe, expect, it, vi } from "vitest";
import type {
  GameplayActionRequest,
  SaveView,
} from "../../src/shared/contracts";
import { ActionCoordinator } from "../../src/game/actions";
import { makeEraSave } from "./fixtures";

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function createCoordinator(
  overrides: Partial<ConstructorParameters<typeof ActionCoordinator>[0]> = {},
) {
  const initialSave = makeEraSave({ revision: 4 });
  const callbacks = {
    initialSave,
    onAction: vi.fn<(request: GameplayActionRequest) => Promise<SaveView>>(),
    onRefresh: vi.fn<() => Promise<SaveView>>(),
    onApply: vi.fn<(save: SaveView) => void>(),
    onState: vi.fn(),
    createActionId: () => "00000000-0000-4000-8000-000000000001",
    ...overrides,
  };
  return {
    coordinator: new ActionCoordinator(callbacks),
    callbacks,
    initialSave,
  };
}

describe("authoritative action coordinator", () => {
  it("retries one uncertain transport failure with the identical action id and payload", async () => {
    const response = makeEraSave({ revision: 5 });
    const onAction = vi
      .fn<(request: GameplayActionRequest) => Promise<SaveView>>()
      .mockRejectedValueOnce(new TypeError("connection reset"))
      .mockResolvedValueOnce(response);
    const { coordinator, callbacks } = createCoordinator({ onAction });

    expect(
      coordinator.perform({
        type: "guard",
        levelId: "level-1-2020",
      }),
    ).toBe(true);
    expect(
      coordinator.perform({
        type: "guard",
        levelId: "level-1-2020",
      }),
    ).toBe(false);

    await vi.waitFor(() => expect(onAction).toHaveBeenCalledTimes(2));
    expect(onAction.mock.calls[1]?.[0]).toBe(onAction.mock.calls[0]?.[0]);
    expect(onAction.mock.calls[0]?.[0]).toEqual({
      actionId: "00000000-0000-4000-8000-000000000001",
      expectedRevision: 4,
      action: { type: "guard", levelId: "level-1-2020" },
    });
    expect(callbacks.onApply).toHaveBeenCalledWith(response);
    expect(coordinator.inspect()).toEqual({
      requestState: "idle",
      requestError: null,
      requestErrorCode: null,
    });
  });

  it("refreshes a stale revision without replaying the old intent", async () => {
    const refreshed = makeEraSave({ revision: 7 });
    const onAction = vi
      .fn()
      .mockRejectedValue(new Error("SAVE_REVISION_STALE"));
    const onRefresh = vi.fn().mockResolvedValue(refreshed);
    const { coordinator, callbacks } = createCoordinator({
      onAction,
      onRefresh,
    });

    coordinator.perform({
      type: "attack",
      levelId: "level-1-2020",
      encounterId: "level-1-2020-ordinary-a",
    });

    await vi.waitFor(() => expect(onRefresh).toHaveBeenCalledOnce());
    expect(onAction).toHaveBeenCalledOnce();
    expect(callbacks.onApply).toHaveBeenCalledWith(refreshed);
    expect(coordinator.inspect()).toEqual({
      requestState: "error",
      requestError: "attack",
      requestErrorCode: "SAVE_REVISION_STALE",
    });
  });

  it("invalidates an in-flight response on authoritative update and disposal", async () => {
    const pending = deferred<SaveView>();
    const onAction = vi.fn(() => pending.promise);
    const { coordinator, callbacks } = createCoordinator({
      onAction,
    });
    coordinator.perform({ type: "guard", levelId: "level-1-2020" });
    const external = makeEraSave({ revision: 5 });
    expect(coordinator.authoritativeUpdate(external)).toBe(true);
    pending.resolve(makeEraSave({ revision: 6 }));
    await pending.promise;
    await Promise.resolve();
    expect(callbacks.onApply).toHaveBeenCalledTimes(1);
    expect(callbacks.onApply).toHaveBeenCalledWith(external);

    const afterUpdate = deferred<SaveView>();
    onAction.mockImplementationOnce(() => afterUpdate.promise);
    coordinator.perform({ type: "guard", levelId: "level-1-2020" });
    coordinator.dispose();
    const statesAtDispose = vi.mocked(callbacks.onState).mock.calls.length;
    afterUpdate.resolve(makeEraSave({ revision: 6 }));
    await afterUpdate.promise;
    await Promise.resolve();
    expect(callbacks.onApply).toHaveBeenCalledTimes(1);
    expect(callbacks.onState).toHaveBeenCalledTimes(statesAtDispose);
  });

  it("rejects wrong-save and non-newer responses without applying them", async () => {
    const { coordinator, callbacks } = createCoordinator({
      onAction: () =>
        Promise.resolve(makeEraSave({ id: "another", revision: 9 })),
    });
    coordinator.perform({ type: "guard", levelId: "level-1-2020" });
    await vi.waitFor(() => {
      expect(coordinator.inspect().requestErrorCode).toBe(
        "STALE_ACTION_RESPONSE",
      );
    });
    expect(callbacks.onApply).not.toHaveBeenCalled();
  });

  it("passes a stable server error code through without retrying a domain failure", async () => {
    const onAction = vi.fn().mockRejectedValue(new Error("ATTACK_COOLDOWN"));
    const { coordinator } = createCoordinator({ onAction });
    coordinator.perform({
      type: "attack",
      levelId: "level-1-2020",
      encounterId: "level-1-2020-ordinary-a",
    });
    await vi.waitFor(() =>
      expect(coordinator.inspect().requestState).toBe("error"),
    );
    expect(onAction).toHaveBeenCalledOnce();
    expect(coordinator.inspect()).toEqual({
      requestState: "error",
      requestError: "attack",
      requestErrorCode: "ATTACK_COOLDOWN",
    });
  });
});
