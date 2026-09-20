// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  NumberField,
  TextField,
} from "../../src/client/editor/EditorFields";

let container: HTMLDivElement;
let root: Root;

function change(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("level editor fields", () => {
  it("cancels unfinished numeric input on Escape without committing", async () => {
    const commit = vi.fn();
    await act(async () =>
      root.render(<NumberField label="X" value={5} onCommit={commit} />),
    );
    const input = container.querySelector("input")!;
    await act(async () => {
      input.focus();
      change(input, "12");
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    expect(commit).not.toHaveBeenCalled();
    expect(input.value).toBe("5");
  });

  it("reverts a blank number instead of converting it to zero", async () => {
    const commit = vi.fn();
    await act(async () =>
      root.render(<NumberField label="Y" value={4} onCommit={commit} />),
    );
    const input = container.querySelector("input")!;
    await act(async () => {
      input.focus();
      change(input, "");
      input.blur();
    });
    expect(commit).not.toHaveBeenCalled();
    expect(input.value).toBe("4");
  });

  it("cancels unfinished text input on Escape without committing", async () => {
    const commit = vi.fn();
    await act(async () =>
      root.render(<TextField label="ID" value="platform" onCommit={commit} />),
    );
    const input = container.querySelector("input")!;
    await act(async () => {
      input.focus();
      change(input, "changed");
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    expect(commit).not.toHaveBeenCalled();
    expect(input.value).toBe("platform");
  });

  it("commits one deliberate numeric edit on Enter", async () => {
    const commit = vi.fn();
    await act(async () =>
      root.render(<NumberField label="Z" value={1} onCommit={commit} />),
    );
    const input = container.querySelector("input")!;
    await act(async () => {
      input.focus();
      change(input, "2.5");
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
    });
    expect(commit).toHaveBeenCalledOnce();
    expect(commit).toHaveBeenCalledWith(2.5);
  });
});
