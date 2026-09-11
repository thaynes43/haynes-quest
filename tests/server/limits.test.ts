import { Hono } from "hono";
import { z } from "zod";
import { describe, expect, it } from "vitest";
import { parseJson } from "../../src/server/validation";
import { RequestLimiter } from "../../src/server/security";
describe("bounded request resources", () => {
  it("cancels an oversized chunked body before consuming the stream", async () => {
    const app = new Hono();
    let cancelled = false;
    let chunks = 0;
    app.post("/", async (c) => {
      try {
        await parseJson(c, z.object({}), 16);
        return c.text("ok");
      } catch {
        return c.text("large", 413);
      }
    });
    const stream = new ReadableStream({
      pull(controller) {
        chunks++;
        controller.enqueue(new Uint8Array(10));
      },
      cancel() {
        cancelled = true;
      },
    });
    const result = await app.fetch(
      new Request("http://localhost/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: stream,
        duplex: "half",
      } as RequestInit),
    );
    expect(result.status).toBe(413);
    expect(cancelled).toBe(true);
    expect(chunks).toBeLessThanOrEqual(3);
  });
  it("bounds unique limiter keys and reclaims expired windows", () => {
    const limiter = new RequestLimiter(120, 1000);
    for (let i = 0; i < 2000; i++) limiter.take(`key-${i}`, 0);
    expect(() => limiter.take("overflow", 1)).toThrow();
    expect(() => limiter.take("new", 1001)).not.toThrow();
  });
});
