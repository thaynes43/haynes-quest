import { vi } from "vitest";

export interface RecordedRequest {
  method: string;
  path: string;
  body: unknown;
}

/** A tiny fetch router for family screen tests; every route is synthetic. */
export function routeFetch(routes: Record<string, (request: RecordedRequest) => unknown>) {
  const requests: RecordedRequest[] = [];
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://quest.test");
    const method = init?.method ?? "GET";
    const request = {
      method,
      path: `${url.pathname}${url.search}`,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    };
    requests.push(request);
    const handler = routes[`${method} ${url.pathname}`];
    if (!handler) {
      return new Response(JSON.stringify({ error: { code: "NOT_FOUND", message: "Not found" } }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }
    const result = handler(request);
    const [status, body] = Array.isArray(result) && typeof result[0] === "number" ? result : [200, result];
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  });
  vi.stubGlobal("fetch", fetch);
  return { fetch, requests };
}
