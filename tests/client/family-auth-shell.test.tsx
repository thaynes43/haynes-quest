// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FamilyShell, SignedOutScreen } from "../../src/client/auth/FamilyShell";
import { readSignInProblem, signOut, startSignIn } from "../../src/client/auth/session";
import type { FamilySessionView } from "../../src/shared/contracts";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const session: FamilySessionView = {
  mode: "family",
  role: "player",
  player: { id: "11111111-1111-4111-8111-111111111111", label: "Synthetic Member" },
  endSessionAvailable: false,
  csrfHeader: "X-Quest-Request",
};

describe("family sign-in helpers", () => {
  it("reads the refused-sign-in reason from the return path", () => {
    expect(readSignInProblem("")).toBeNull();
    expect(readSignInProblem("?error=not_admitted&error_description=not_admitted")).toBe("not-admitted");
    expect(readSignInProblem("?error=state_mismatch")).toBe("failed");
  });

  it("starts sign-in through the guarded API and follows the provider URL", async () => {
    const fetch = vi.fn(async () => jsonResponse({ url: "https://idp.example.test/authorize?x=1", redirect: false }));
    vi.stubGlobal("fetch", fetch);
    const navigate = vi.fn();
    await startSignIn(navigate);
    expect(fetch).toHaveBeenCalledWith(
      "/api/auth/sign-in/social",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "X-Quest-Request": "1" }),
      }),
    );
    expect(navigate).toHaveBeenCalledWith("https://idp.example.test/authorize?x=1");
  });

  it("asks for Authentik end-session only when requested", async () => {
    const fetch = vi.fn(async () => jsonResponse({ signedOut: true, endSessionUrl: null }));
    vi.stubGlobal("fetch", fetch);
    await signOut();
    await signOut(true);
    const bodies = fetch.mock.calls.map((call) => (call as unknown[])[1] as RequestInit).map((init) => init.body);
    expect(bodies).toEqual(["{}", JSON.stringify({ endSession: true })]);
  });
});

describe("family sign-in shell", () => {
  it("shows a single sign-in button and explains a refused account", async () => {
    await act(async () => root.render(<SignedOutScreen brand={<span>Brand</span>} problem="not-admitted" />));
    const buttons = [...container.querySelectorAll("button")];
    expect(buttons.map((button) => button.textContent)).toEqual(["Sign in"]);
    expect(container.querySelector('[role="alert"]')?.textContent).toBeTruthy();
  });

  it("shows the role and signs out locally", async () => {
    const fetch = vi.fn(async () => jsonResponse({ signedOut: true, endSessionUrl: null }));
    vi.stubGlobal("fetch", fetch);
    const onSignedOut = vi.fn();
    await act(async () =>
      root.render(<FamilyShell brand={<span>Brand</span>} session={session} onSignedOut={onSignedOut} />),
    );
    expect(container.querySelector('[data-role="player"]')).not.toBeNull();
    const labels = [...container.querySelectorAll("button")].map((button) => button.textContent);
    expect(labels).toEqual(["Sign out"]);
    await act(async () => container.querySelector("button")!.click());
    expect(fetch).toHaveBeenCalledWith("/api/sign-out", expect.objectContaining({ method: "POST" }));
    expect(onSignedOut).toHaveBeenCalledTimes(1);
  });

  it("offers Authentik sign-out when the server supports it", async () => {
    await act(async () =>
      root.render(
        <FamilyShell
          brand={<span>Brand</span>}
          session={{ ...session, role: "admin", endSessionAvailable: true }}
          onSignedOut={() => undefined}
        />,
      ),
    );
    expect(container.querySelector('[data-role="admin"]')).not.toBeNull();
    expect(container.querySelectorAll("button")).toHaveLength(2);
  });
});
