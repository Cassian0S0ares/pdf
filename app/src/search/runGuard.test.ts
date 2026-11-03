import { describe, it, expect } from "vitest";
import { createRunGuard } from "./runGuard";

describe("createRunGuard", () => {
  it("only the latest started run is current", () => {
    const guard = createRunGuard();
    const first = guard.start();
    expect(first()).toBe(true);
    const second = guard.start();
    expect(first()).toBe(false);
    expect(second()).toBe(true);
  });

  it("guards are independent", () => {
    const a = createRunGuard();
    const b = createRunGuard();
    const runA = a.start();
    b.start();
    expect(runA()).toBe(true);
  });
});
