// @vitest-environment jsdom
/**
 * DESIGN-027 D-02: the per-device Scary moments switch. It defaults to on,
 * survives a reload on this device, never breaks when storage is blocked, and
 * appears in the family home for administrators and family members alike.
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FamilyHome } from "../../src/client/family/FamilyHome";
import { ScaryMomentsToggle } from "../../src/client/ScaryMomentsToggle";
import {
  SCARY_MOMENTS_DESCRIPTION,
  SCARY_MOMENTS_LABEL,
  SCARY_MOMENTS_STORAGE_KEY,
  readScaryMoments,
  writeScaryMoments,
} from "../../src/client/scary-moments";
import type { FamilySessionView } from "../../src/shared/contracts";
import { routeFetch } from "./family-fetch";

function memoryStorage(): Pick<Storage, "getItem" | "setItem"> & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
  };
}

const blocked: Pick<Storage, "getItem" | "setItem"> = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
};

describe("the Scary moments preference", () => {
  it("defaults to on and remembers an explicit choice", () => {
    const storage = memoryStorage();
    expect(readScaryMoments(storage)).toBe(true);
    writeScaryMoments(false, storage);
    expect(storage.values.get(SCARY_MOMENTS_STORAGE_KEY)).toBe("off");
    expect(readScaryMoments(storage)).toBe(false);
    writeScaryMoments(true, storage);
    expect(readScaryMoments(storage)).toBe(true);
  });

  it("reads unknown values as on", () => {
    const storage = memoryStorage();
    storage.values.set(SCARY_MOMENTS_STORAGE_KEY, "maybe");
    expect(readScaryMoments(storage)).toBe(true);
  });

  it("treats blocked or missing storage as the default and never throws", () => {
    expect(readScaryMoments(blocked)).toBe(true);
    expect(() => writeScaryMoments(false, blocked)).not.toThrow();
    expect(readScaryMoments(null)).toBe(true);
    expect(() => writeScaryMoments(false, null)).not.toThrow();
  });

  it("uses this device's local storage by default", () => {
    localStorage.clear();
    expect(readScaryMoments()).toBe(true);
    writeScaryMoments(false);
    expect(localStorage.getItem(SCARY_MOMENTS_STORAGE_KEY)).toBe("off");
    expect(readScaryMoments()).toBe(false);
    localStorage.clear();
  });
});

describe("the Scary moments switch", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  const toggle = () => container.querySelector<HTMLInputElement>('input[role="switch"]')!;

  it("shows its label and description, starts on and turns scary moments off for this device", async () => {
    await act(async () => root.render(<ScaryMomentsToggle />));
    expect(container.textContent).toContain(SCARY_MOMENTS_LABEL);
    expect(container.textContent).toContain(SCARY_MOMENTS_DESCRIPTION);
    expect(SCARY_MOMENTS_LABEL).toBe("Scary moments");
    expect(SCARY_MOMENTS_DESCRIPTION).toBe(
      "Blackouts, jump scares and creepy sounds in spooky chapters.",
    );
    const input = toggle();
    expect(input.checked).toBe(true);
    expect(input.getAttribute("aria-describedby")).toBe(
      container.querySelector("small")!.id,
    );
    await act(async () => input.click());
    expect(input.checked).toBe(false);
    expect(localStorage.getItem(SCARY_MOMENTS_STORAGE_KEY)).toBe("off");
    await act(async () => input.click());
    expect(localStorage.getItem(SCARY_MOMENTS_STORAGE_KEY)).toBe("on");
  });

  it("shows a remembered off", async () => {
    localStorage.setItem(SCARY_MOMENTS_STORAGE_KEY, "off");
    await act(async () => root.render(<ScaryMomentsToggle />));
    expect(toggle().checked).toBe(false);
  });

  it("still switches when storage is blocked", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    await act(async () => root.render(<ScaryMomentsToggle />));
    expect(toggle().checked).toBe(true);
    await act(async () => toggle().click());
    expect(toggle().checked).toBe(false);
  });

  it.each(["player", "admin"] as const)("appears in the family home for a %s", async (role) => {
    routeFetch({
      "GET /api/children": () => ({ journeys: [] }),
      "GET /api/admin/children": () => ({ children: [] }),
    });
    const session: FamilySessionView = {
      mode: "family",
      role,
      player: { id: "40000000-0000-4000-8000-000000000001", label: "Synthetic Member" },
      endSessionAvailable: false,
      csrfHeader: "X-Quest-Request",
    };
    await act(async () => root.render(<FamilyHome session={session} onPlay={vi.fn()} />));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.textContent).toContain("Scary moments");
    await act(async () => toggle().click());
    expect(localStorage.getItem(SCARY_MOMENTS_STORAGE_KEY)).toBe("off");
  });
});
