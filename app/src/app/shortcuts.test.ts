import { describe, it, expect } from "vitest";
import { shortcutFor, shouldHandleShortcut } from "./shortcuts";

const k = (key: string, mod = true) => ({ key, ctrlKey: mod, metaKey: false });

describe("shortcutFor", () => {
  it.each([
    ["o", "open"], ["O", "open"], ["w", "close"], ["f", "find"], ["p", "print"],
    ["=", "zoomIn"], ["+", "zoomIn"], ["-", "zoomOut"], ["0", "zoomReset"],
  ])("Ctrl+%s → %s", (key, action) => {
    expect(shortcutFor(k(key))).toBe(action);
  });

  it("meta works like ctrl (macOS)", () => {
    expect(shortcutFor({ key: "o", ctrlKey: false, metaKey: true })).toBe("open");
  });

  it("page keys without modifier", () => {
    expect(shortcutFor(k("PageDown", false))).toBe("nextPage");
    expect(shortcutFor(k("PageUp", false))).toBe("prevPage");
  });

  it("ignores plain letters", () => {
    expect(shortcutFor(k("o", false))).toBeNull();
  });
});

describe("shouldHandleShortcut", () => {
  const withTarget = (key: string, mod: boolean, target: EventTarget) => ({
    key, ctrlKey: mod, metaKey: false, target,
  });

  it("ignores everything while the password prompt is open", () => {
    expect(shouldHandleShortcut(withTarget("o", true, document.body), true)).toBe(false);
    expect(shouldHandleShortcut(withTarget("PageDown", false, document.body), true)).toBe(false);
  });

  it("ignores PageDown when typing in an input", () => {
    const input = document.createElement("input");
    expect(shouldHandleShortcut(withTarget("PageDown", false, input), false)).toBe(false);
  });

  it("still handles Ctrl+F while focused on an input", () => {
    const input = document.createElement("input");
    expect(shouldHandleShortcut(withTarget("f", true, input), false)).toBe(true);
  });

  it("handles PageDown on the body", () => {
    expect(shouldHandleShortcut(withTarget("PageDown", false, document.body), false)).toBe(true);
  });
});
