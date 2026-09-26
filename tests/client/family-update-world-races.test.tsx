// @vitest-environment jsdom
/**
 * DESIGN-024 D-11 on the Memories screen against the real family routes and
 * service (in-memory stores, fake Immich): two administrators share one job
 * status per child, so the screen must read an update's outcome from the draft
 * itself, and **Start fresh** must wait until the draft on screen is published.
 * Everything here is synthetic.
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoriesScreen } from "../../src/client/family/MemoriesScreen";
import type { FamilyPlayResponse } from "../../src/shared/family-api";
import { TEST_CHILD_B } from "../server/family/fake-immich.js";
import { familyHarness, type FamilyHarness } from "../server/family/harness.js";
import { upgradeRegistry } from "../server/family/template-variants.js";

const UPDATE_READY = "A new version of this world is ready.";
const UPDATE_DONE = "World updated. Publish to make it playable.";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  // Only the screen's poll timer is faked; the fake Immich never sleeps for real.
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  vi.stubGlobal("confirm", () => true);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** The screen's requests go to the real routes as the administrator. */
function bridge(harness: FamilyHarness) {
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "https://quest.test");
    return harness.request(`${url.pathname}${url.search}`, {
      as: "admin",
      method: init?.method ?? "GET",
      ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}),
    });
  });
}

async function childOnV1(harness: FamilyHarness) {
  const [person] = await harness.service.lookupPeople(TEST_CHILD_B.name);
  const child = await harness.service.createChild({
    immichName: TEST_CHILD_B.name,
    personChoiceId: person!.id,
    displayName: "Test Child B",
    birthDate: TEST_CHILD_B.birthDate,
    templateId: "family-world-b",
    templateVersion: "v1",
  }, null);
  const draft = await harness.service.autoPick(child.id, null);
  return { childId: child.id, draft };
}

async function settle(ms = 0) {
  for (let round = 0; round < 5; round += 1) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(round === 0 ? ms : 0);
    });
  }
}

function button(label: string): HTMLButtonElement | null {
  return ([...container.querySelectorAll("button")].find((entry) => entry.textContent?.trim() === label) ??
    null) as HTMLButtonElement | null;
}

async function press(label: string) {
  const found = button(label);
  if (!found) throw new Error(`No button ${label}`);
  await act(async () => found.click());
  await settle();
}

async function render(childId: string, onPlay = vi.fn()) {
  await act(async () => root.render(
    <MemoriesScreen childId={childId} displayName="Test Child B" onBack={vi.fn()} onPlay={onPlay} />,
  ));
  await settle();
  return onPlay;
}

/** Another administrator's "Pick all again", from the draft revision their screen shows. */
async function otherAdminPicks(harness: FamilyHarness, childId: string, expectedRevision: number) {
  const response = await harness.request(`/api/admin/children/${childId}/draft`, {
    method: "PUT",
    body: { op: "auto-pick", expectedRevision, reseed: true },
  });
  expect(response.status).toBe(202);
  await harness.jobs.settled(childId);
}

describe("Update world with two administrators (DESIGN-024 D-11)", () => {
  it("does not report a failed update as done when another admin's pick clears its error", async () => {
    const harness = familyHarness({ templates: upgradeRegistry() });
    const { childId } = await childOnV1(harness);
    bridge(harness);
    await render(childId);
    expect(container.textContent).toContain(UPDATE_READY);

    // Immich is briefly down, so rebuilding the changed chapters fails and nothing is written.
    harness.immich.unavailable = true;
    await press("Update world");
    await harness.jobs.settled(childId);
    expect(harness.jobs.status(childId).lastError).toBe("IMMICH_UNAVAILABLE");
    harness.immich.unavailable = false;
    // Before this screen polls, another admin picks again on v1; that clears the failure.
    await otherAdminPicks(harness, childId, (await harness.familyStore.getDraft(childId))!.revision);
    expect(harness.jobs.status(childId)).toEqual({ picking: false, lastError: null });

    await settle(2_000);
    expect(container.textContent).not.toContain("Picking photos");
    expect(container.textContent).not.toContain(UPDATE_DONE);
    // The world is still the old one, and the screen still offers the update.
    expect(await harness.familyStore.getChild(childId)).toMatchObject({ templateVersion: "v1" });
    expect(container.textContent).toContain(UPDATE_READY);
    expect(button("Update world")).not.toBeNull();
  });

  it("reports a landed update as done even when another admin's stale pick then fails", async () => {
    const harness = familyHarness({ templates: upgradeRegistry() });
    const { childId, draft } = await childOnV1(harness);
    bridge(harness);
    await render(childId);

    await press("Update world");
    await harness.jobs.settled(childId);
    expect(await harness.familyStore.getChild(childId)).toMatchObject({ templateVersion: "v5" });
    // Another admin's screen still shows the v1 draft: their pick fails on the revision.
    await otherAdminPicks(harness, childId, draft.revision);
    expect(harness.jobs.status(childId).lastError).toBe("DRAFT_CONFLICT");

    await settle(2_000);
    expect(container.querySelector('[role="status"]')?.textContent).toBe(UPDATE_DONE);
    expect(container.textContent).not.toContain("Photo picking stopped");
    expect(container.textContent).not.toContain(UPDATE_READY);
    // Publishing now freezes the new version.
    await press("Publish");
    expect((await harness.familyStore.latestPublication(childId))!.plan.template)
      .toMatchObject({ id: "family-world-b", version: "v5" });
  });
});

describe("Start fresh with these photos", () => {
  it("waits until the draft on screen is published, then plays it", async () => {
    const harness = familyHarness({ templates: upgradeRegistry() });
    const { childId } = await childOnV1(harness);
    bridge(harness);
    const onPlay = await render(childId);
    // Nothing is published yet, so there is nothing to start fresh on.
    expect(button("Start fresh with these photos")).toBeNull();

    await press("Publish");
    expect(container.textContent).toContain("Published (version 1)");
    expect(button("Start fresh with these photos")).not.toBeNull();
    const started = await harness.request(`/api/children/${childId}/play`, { as: "member", body: {} });
    expect(((await started.json()) as FamilyPlayResponse).world.templateVersion).toBe("v1");

    // After Update world the draft is newer than the publication: publish first.
    await press("Update world");
    await harness.jobs.settled(childId);
    await settle(2_000);
    expect(container.textContent).toContain(UPDATE_DONE);
    expect(button("Start fresh with these photos")).toBeNull();

    await press("Publish");
    expect(container.textContent).toContain("Published (version 2)");
    expect(button("Start fresh with these photos")).not.toBeNull();

    // A caption edit makes the draft newer than the publication again.
    await press("Edit caption");
    const field = container.querySelector<HTMLInputElement>('input[aria-label="Caption"]')!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(field, "Pumpkin patch");
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await press("Save");
    expect(container.textContent).toContain("Pumpkin patch");
    expect(button("Start fresh with these photos")).toBeNull();

    await press("Publish");
    expect(container.textContent).toContain("Published (version 3)");
    await press("Start fresh with these photos");
    expect(onPlay).toHaveBeenCalledTimes(1);
    const fresh = onPlay.mock.calls[0]![0] as FamilyPlayResponse;
    expect(fresh).toMatchObject({ created: true, world: { templateVersion: "v5" } });
    expect(fresh.save.memories.map((memory) => memory.label)).toContain("Pumpkin patch");
  });
});
