// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryImage } from "../../src/client/MemoryImage";
import type { MemoryPreview } from "../../src/shared/contracts";

const memory: MemoryPreview = {
  id: "fixture-picture",
  date: "2024-01-01",
  ageYears: 4,
  label: "A fictional memory",
  mediaUrl: "/api/saves/fixture/media/fixture-picture",
};
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("memory picture delivery", () => {
  it("shows an already decoded picture even without a new load event", async () => {
    vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(
      true,
    );
    vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(
      960,
    );
    await act(async () =>
      root.render(React.createElement(MemoryImage, { memory })),
    );
    expect(
      container
        .querySelector(".memory-image.is-loaded img")
        ?.getAttribute("src"),
    ).toBe(memory.mediaUrl);
    expect(container.textContent).not.toContain("Opening this memory");
  });

  it("does not carry a previous picture's loaded state into a new URL", async () => {
    const complete = vi
      .spyOn(HTMLImageElement.prototype, "complete", "get")
      .mockReturnValue(true);
    const width = vi
      .spyOn(HTMLImageElement.prototype, "naturalWidth", "get")
      .mockReturnValue(960);
    await act(async () =>
      root.render(React.createElement(MemoryImage, { memory })),
    );
    complete.mockReturnValue(false);
    width.mockReturnValue(0);
    const next = { ...memory, mediaUrl: `${memory.mediaUrl}-replacement` };
    await act(async () =>
      root.render(React.createElement(MemoryImage, { memory: next })),
    );
    expect(container.querySelector(".is-loaded")).toBeNull();
    expect(container.textContent).toContain("Opening this memory");
    complete.mockReturnValue(true);
    width.mockReturnValue(640);
    await act(async () =>
      container.querySelector("img")?.dispatchEvent(new Event("load")),
    );
    expect(container.querySelector(".is-loaded img")?.getAttribute("src")).toBe(
      next.mediaUrl,
    );
  });

  it("offers a manual retry for an already failed cached picture", async () => {
    vi.useFakeTimers();
    vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(
      true,
    );
    const width = vi
      .spyOn(HTMLImageElement.prototype, "naturalWidth", "get")
      .mockReturnValue(0);
    await act(async () =>
      root.render(React.createElement(MemoryImage, { memory })),
    );
    await act(async () => vi.advanceTimersByTimeAsync(1500));
    await act(async () => vi.advanceTimersByTimeAsync(3000));
    expect(container.textContent).toContain("This picture couldn’t load.");
    const retry = container.querySelector("button");
    expect(retry?.textContent).toBe("Try the picture again");
    width.mockReturnValue(640);
    await act(async () => retry?.click());
    expect(container.querySelector(".is-loaded img")).not.toBeNull();
    expect(container.textContent).not.toContain("Opening this memory");
  });
});
