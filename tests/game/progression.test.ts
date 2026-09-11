import { describe, expect, it, vi } from 'vitest';
import type { SaveView } from '../../src/shared/contracts';
import { AuthoritativeProgression } from '../../src/game/progression';
import { makeSave } from './fixtures';

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (reason?: unknown) => void } {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('authoritative progression', () => {
  it('does not apply recovery until the callback returns the authoritative save', async () => {
    const response = deferred<SaveView>();
    const onApply = vi.fn();
    const onRecover = vi.fn(() => response.promise);
    const coordinator = new AuthoritativeProgression({
      onRecover,
      onFinish: vi.fn(),
      onApply,
      onState: vi.fn(),
    });

    coordinator.recover('memory-1');
    coordinator.recover('memory-1');
    await Promise.resolve();
    expect(onRecover).toHaveBeenCalledOnce();
    expect(onApply).not.toHaveBeenCalled();
    expect(coordinator.inspect()).toEqual({ requestState: 'recovering', requestError: null });

    const authoritative = makeSave([0, 4, 7], { recoveredCount: 1 });
    response.resolve(authoritative);
    await response.promise;
    await vi.waitFor(() => {
      expect(onApply).toHaveBeenCalledWith(authoritative);
    });
    expect(coordinator.inspect()).toEqual({ requestState: 'idle', requestError: null });
  });

  it('reports a structured error without client-side progress and can accept a later server update', async () => {
    const onApply = vi.fn();
    const coordinator = new AuthoritativeProgression({
      onRecover: () => Promise.reject(new Error('fixture failure')),
      onFinish: vi.fn(),
      onApply,
      onState: vi.fn(),
    });
    coordinator.recover('memory-1');
    await vi.waitFor(() => {
      expect(coordinator.inspect()).toEqual({ requestState: 'error', requestError: 'recover' });
    });
    expect(onApply).not.toHaveBeenCalled();

    const authoritative = makeSave([0, 4, 7], { recoveredCount: 1 });
    coordinator.authoritativeUpdate(authoritative);
    expect(onApply).toHaveBeenCalledWith(authoritative);
    expect(coordinator.inspect()).toEqual({ requestState: 'idle', requestError: null });
  });

  it('invalidates pending callbacks during disposal', async () => {
    const response = deferred<SaveView>();
    const onApply = vi.fn();
    const onState = vi.fn();
    const coordinator = new AuthoritativeProgression({
      onRecover: () => response.promise,
      onFinish: vi.fn(),
      onApply,
      onState,
    });
    coordinator.recover('memory-1');
    coordinator.dispose();
    const statusCallsAtDispose = onState.mock.calls.length;
    response.resolve(makeSave([0, 4, 7], { recoveredCount: 1 }));
    await response.promise;
    await Promise.resolve();
    expect(onApply).not.toHaveBeenCalled();
    expect(onState).toHaveBeenCalledTimes(statusCallsAtDispose);
  });
});
