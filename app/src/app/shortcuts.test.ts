import { describe, it, expect } from "vitest";
import { shortcutFor } from "./shortcuts";

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
