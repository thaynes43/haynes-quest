import { afterEach, describe, expect, it, vi } from "vitest";
import { API_REQUEST_TIMEOUT_MS, api } from "../../src/client/api";

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

describe("API request deadlines", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("aborts and settles a stalled fetch after eight seconds", async () => {
    vi.useFakeTimers();
    let requestSignal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        requestSignal = init?.signal ?? undefined;
        return new Promise<Response>((_resolve, reject) => {
          requestSignal?.addEventListener(
            "abort",
            () =>
              reject(
                new DOMException("The operation was aborted", "AbortError"),
              ),
            { once: true },
          );
        });
      }),
    );

    const result = api<{ ok: true }>("/stalled");
    const rejection = expect(result).rejects.toMatchObject({
      message: "REQUEST_TIMEOUT",
      code: "REQUEST_TIMEOUT",
    });

    await vi.advanceTimersByTimeAsync(API_REQUEST_TIMEOUT_MS - 1);
    expect(requestSignal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    await rejection;
    expect(requestSignal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("settles a stalled response body and ignores its late completion", async () => {
    vi.useFakeTimers();
    const body = deferred<{ ok: true }>();
    let requestSignal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        requestSignal = init?.signal ?? undefined;
        return Promise.resolve({
          ok: true,
          json: () => body.promise,
        } as Response);
      }),
    );

    const result = api<{ ok: true }>("/stalled-body");
    const rejection = expect(result).rejects.toMatchObject({
      message: "REQUEST_TIMEOUT",
      code: "REQUEST_TIMEOUT",
    });
    await vi.advanceTimersByTimeAsync(API_REQUEST_TIMEOUT_MS);

    await rejection;
    expect(requestSignal?.aborted).toBe(true);
    body.resolve({ ok: true });
    await Promise.resolve();
    await expect(result).rejects.toMatchObject({ message: "REQUEST_TIMEOUT" });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears the deadline after a successful response", async () => {
    vi.useFakeTimers();
    let requestSignal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        requestSignal = init?.signal ?? undefined;
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }),
    );

    await expect(api<{ ok: true }>("/success")).resolves.toEqual({ ok: true });
    expect(requestSignal?.aborted).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears the deadline while preserving a server error code", async () => {
    vi.useFakeTimers();
    let requestSignal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        requestSignal = init?.signal ?? undefined;
        return Promise.resolve(
          new Response(JSON.stringify({ error: { code: "RATE_LIMITED" } }), {
            status: 429,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }),
    );

    await expect(api("/failure")).rejects.toThrow("RATE_LIMITED");
    expect(requestSignal?.aborted).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
