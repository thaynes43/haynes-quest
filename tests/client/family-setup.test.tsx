// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FamilyAdmin } from "../../src/client/family/FamilyAdmin";
import { MemoriesScreen } from "../../src/client/family/MemoriesScreen";
import type { DraftSlotView, DraftView } from "../../src/shared/family-api";
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
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const CHILD = "50000000-0000-4000-8000-000000000001";
const DRAFT_PATH = `/api/admin/children/${CHILD}/draft`;

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function button(label: string, scope: ParentNode = container): HTMLButtonElement {
  const found = [...scope.querySelectorAll("button")].find((entry) => entry.textContent?.trim() === label);
  if (!found) throw new Error(`No button ${label}`);
  return found as HTMLButtonElement;
}

function slot(overrides: Partial<DraftSlotView> & Pick<DraftSlotView, "slot">): DraftSlotView {
  return {
    status: "filled",
    localDate: "2024-02-29",
    ageYears: 4,
    caption: overrides.slot === "major" ? "Turning 4!" : "Spring 2022 · age 2",
    captionEdited: false,
    thumbnailToken: `ct1.token-${overrides.slot}`,
    source: "auto",
    ...overrides,
  };
}

function draft(revision: number, needsPhoto = false): DraftView {
  return {
    childId: CHILD,
    draftId: "60000000-0000-4000-8000-000000000001",
    revision,
    templateId: "rat-casino-world",
    templateVersion: "v2",
    publishable: !needsPhoto,
    chapters: [{
      chapterId: "chapter-1",
      name: "The Block Party",
      subtitle: "",
      startAge: 0,
      recoveredAge: 4,
      startDate: "2020-02-29",
      targetDate: "2024-02-29",
      slots: [
        slot({ slot: "minor-one" }),
        needsPhoto
          ? slot({ slot: "minor-two", status: "needs-photo", localDate: null, ageYears: null, caption: null, thumbnailToken: null, source: "auto" })
          : slot({ slot: "minor-two" }),
        slot({ slot: "major" }),
      ],
    }],
  };
}

describe("family setup screens", () => {
  it("adds a child from an Immich match, confirms the birthday and starts the pick", async () => {
    const { requests } = routeFetch({
      "GET /api/admin/children": () => ({ children: [] }),
      "GET /api/admin/immich/people": () => ({ people: [{ id: "person-abc", label: "Test Child B", birthDate: "2020-02-29" }] }),
      "GET /api/admin/templates": () => ({ templates: [{ id: "rat-casino-world", version: "v2", name: "Synthetic World", chapterCount: 3 }] }),
      "POST /api/admin/children": () => [201, { id: CHILD }],
      [`PUT ${DRAFT_PATH}`]: () => [202, { draft: null, picking: true, lastPickError: null }],
      [`GET ${DRAFT_PATH}`]: () => ({ draft: null, picking: true, lastPickError: null }),
    });
    await act(async () => root.render(<FamilyAdmin onBack={vi.fn()} onPlay={vi.fn()} />));
    await flush();
    await act(async () => button("Add a child").click());
    const name = container.querySelector<HTMLInputElement>("input")!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(name, "Test Child B");
      name.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => button("Find").click());
    await flush();
    await flush();
    const inputs = container.querySelectorAll<HTMLInputElement>(".family-child-form input");
    expect(inputs[1]!.value).toBe("2020-02-29");
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(inputs[0], "Test Child B");
      inputs[0]!.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await flush();
    expect(container.querySelector("select")?.value).toBe("rat-casino-world@v2");
    await act(async () => button("Create quest and pick photos").click());
    await flush();
    await flush();
    const create = requests.find((entry) => entry.method === "POST" && entry.path === "/api/admin/children");
    expect(create?.body).toEqual({
      immichName: "Test Child B",
      personChoiceId: "person-abc",
      displayName: "Test Child B",
      birthDate: "2020-02-29",
      templateId: "rat-casino-world",
      templateVersion: "v2",
    });
    expect(requests.find((entry) => entry.method === "PUT")?.body).toEqual({ op: "auto-pick", expectedRevision: null });
    expect(container.textContent).toContain("Picking photos");
  });

  it("shows chapter cards and edits, swaps and publishes with compare-and-set", async () => {
    let current = draft(3);
    const { requests } = routeFetch({
      [`GET ${DRAFT_PATH}`]: () => ({ draft: current, picking: false, lastPickError: null }),
      [`PUT ${DRAFT_PATH}`]: (request) => {
        const next = draft(current.revision + 1);
        if ((request.body as { op: string }).op === "caption") {
          const slots = [...next.chapters[0]!.slots];
          slots[0] = slot({ slot: "minor-one", caption: "Pumpkin patch", captionEdited: true });
          current = { ...next, chapters: [{ ...next.chapters[0]!, slots }] };
        } else {
          current = next;
        }
        return { draft: current, picking: false, lastPickError: null };
      },
      [`GET ${DRAFT_PATH}/slots/chapter-1/minor-two/suggestions`]: () => ({
        suggestions: [{ token: "ct1.suggested", localDate: "2022-10-31", ageYears: 2 }],
        nextCursor: 2,
      }),
      [`POST /api/admin/children/${CHILD}/publish`]: () => [409, { error: { code: "DRAFT_CONFLICT", message: "x" } }],
    });
    await act(async () => root.render(
      <MemoriesScreen childId={CHILD} displayName="Test Child B" onBack={vi.fn()} onPlay={vi.fn()} />,
    ));
    await flush();
    const slots = container.querySelectorAll(".family-slot");
    expect(slots).toHaveLength(3);
    expect(slots[2]!.classList.contains("is-big")).toBe(true);
    expect(slots[0]!.querySelector("img")!.getAttribute("src")).toBe("/api/admin/candidates/ct1.token-minor-one/image");
    expect(slots[2]!.textContent).toContain("Turning 4!");

    await act(async () => button("Edit caption", slots[0]!).click());
    const field = container.querySelector<HTMLInputElement>('input[aria-label="Caption"]')!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(field, "Pumpkin patch");
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => button("Save", container).click());
    await flush();
    expect(requests.find((entry) => entry.method === "PUT")?.body).toEqual({
      op: "caption", expectedRevision: 3, chapterId: "chapter-1", slot: "minor-one", caption: "Pumpkin patch",
    });
    expect(container.textContent).toContain("Pumpkin patch");

    await act(async () => button("Swap photo", container.querySelectorAll(".family-slot")[1]!).click());
    await flush();
    expect(container.querySelector(".family-suggestion img")!.getAttribute("src")).toBe("/api/admin/candidates/ct1.suggested/image");
    expect(button("Show more")).toBeTruthy();
    await act(async () => (container.querySelector(".family-suggestion") as HTMLButtonElement).click());
    await flush();
    expect(requests.filter((entry) => entry.method === "PUT").at(-1)?.body).toEqual({
      op: "swap", expectedRevision: 4, chapterId: "chapter-1", slot: "minor-two", token: "ct1.suggested",
    });

    await act(async () => button("Publish").click());
    await flush();
    await act(async () => button("Publish").click());
    await flush();
    const publishes = requests.filter((entry) => entry.path.endsWith("/publish"));
    expect(publishes).toHaveLength(2);
    const [first, second] = publishes.map((entry) => entry.body as { requestId: string; expectedRevision: number });
    expect(first!.requestId).toMatch(/^[0-9a-f-]{36}$/);
    // A retried tap on the same revision reuses its request id.
    expect(second).toEqual(first);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Someone else changed these memories");
  });

  it("blocks publishing while a slot needs a photo", async () => {
    routeFetch({
      [`GET ${DRAFT_PATH}`]: () => ({ draft: draft(1, true), picking: false, lastPickError: null }),
    });
    await act(async () => root.render(
      <MemoriesScreen childId={CHILD} displayName="Test Child B" onBack={vi.fn()} onPlay={vi.fn()} />,
    ));
    await flush();
    expect(button("Publish").disabled).toBe(true);
    expect(container.textContent).toContain("Needs a photo");
    expect(button("Choose a photo")).toBeTruthy();
  });
});
