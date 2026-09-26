// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FamilyHome } from "../../src/client/family/FamilyHome";
import type { FamilySessionView } from "../../src/shared/contracts";
import type { FamilyJourneyCard } from "../../src/shared/family-api";
import { routeFetch } from "./family-fetch";

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

const CHILD = "50000000-0000-4000-8000-000000000001";

function session(role: "admin" | "player"): FamilySessionView {
  return {
    mode: "family",
    role,
    player: { id: "40000000-0000-4000-8000-000000000001", label: "Synthetic Member" },
    endSessionAvailable: false,
    csrfHeader: "X-Quest-Request",
  };
}

const card: FamilyJourneyCard = {
  childId: CHILD,
  displayName: "Test Child B",
  publicationRevision: 2,
  chapterCount: 3,
  run: { saveId: "s1", publicationRevision: 1, ageYears: 4, chapterIndex: 1, chapterName: "Besties Obby", completed: false },
  newerPublication: true,
};

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("family home", () => {
  it("shows a member one card per journey and no setup controls", async () => {
    const play = { save: { id: "s1" }, world: { saveId: "s1", templateId: "t", templateVersion: "v1", chapters: [] }, created: false };
    const { requests } = routeFetch({
      "GET /api/children": () => ({ journeys: [card] }),
      [`POST /api/children/${CHILD}/play`]: () => play,
    });
    const onPlay = vi.fn();
    await act(async () => root.render(<FamilyHome session={session("player")} onPlay={onPlay} />));
    await flush();
    const button = container.querySelector<HTMLButtonElement>(".family-journey-card")!;
    expect(button.textContent).toContain("Test Child B");
    expect(button.textContent).toContain("Besties Obby · Age 4");
    expect(container.textContent).not.toContain("Set up your family");
    expect(container.textContent).not.toContain("Newer photos");
    await act(async () => button.click());
    await flush();
    expect(requests.at(-1)).toMatchObject({ method: "POST", path: `/api/children/${CHILD}/play`, body: {} });
    expect(onPlay).toHaveBeenCalledWith(play);
  });

  it("offers setup and the newer-photos hint to an administrator", async () => {
    routeFetch({
      "GET /api/children": () => ({ journeys: [card] }),
      "GET /api/admin/children": () => ({ children: [] }),
    });
    await act(async () => root.render(<FamilyHome session={session("admin")} onPlay={vi.fn()} />));
    await flush();
    expect(container.textContent).toContain("Newer photos are published");
    const setup = [...container.querySelectorAll("button")].find((entry) => entry.textContent === "Set up your family")!;
    await act(async () => setup.click());
    await flush();
    expect(container.querySelector("h1")?.textContent).toBe("Set up your family");
    expect(container.textContent).toContain("Add a child");
  });

  it("explains an empty household and surfaces errors", async () => {
    routeFetch({ "GET /api/children": () => [503, { error: { code: "FAMILY_SETUP_UNAVAILABLE", message: "x" } }] });
    await act(async () => root.render(<FamilyHome session={session("player")} onPlay={vi.fn()} />));
    await flush();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("Photo setup isn't connected right now.");
  });
});
