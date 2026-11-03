import { describe, it, expect } from "vitest";
import { usePasswordPrompt } from "./passwordPrompt";

describe("password prompt", () => {
  it("ask resolves with the answer and closes", async () => {
    const p = usePasswordPrompt.getState().ask("a.pdf", false);
    expect(usePasswordPrompt.getState().open).toBe(true);
    expect(usePasswordPrompt.getState().fileName).toBe("a.pdf");
    usePasswordPrompt.getState().answer("segredo");
    await expect(p).resolves.toBe("segredo");
    expect(usePasswordPrompt.getState().open).toBe(false);
  });

  it("cancel resolves null", async () => {
    const p = usePasswordPrompt.getState().ask("a.pdf", true);
    expect(usePasswordPrompt.getState().incorrect).toBe(true);
    usePasswordPrompt.getState().answer(null);
    await expect(p).resolves.toBeNull();
  });
});

describe("password prompt queue", () => {
  it("serializes concurrent asks: each resolves with its own answer, in order", async () => {
    const { ask, answer } = usePasswordPrompt.getState();
    const first = ask("a.pdf", false);
    const second = ask("b.pdf", true);
    expect(usePasswordPrompt.getState().fileName).toBe("a.pdf");
    expect(usePasswordPrompt.getState().incorrect).toBe(false);

    answer("um");
    await expect(first).resolves.toBe("um");
    expect(usePasswordPrompt.getState().open).toBe(true);
    expect(usePasswordPrompt.getState().fileName).toBe("b.pdf");
    expect(usePasswordPrompt.getState().incorrect).toBe(true);

    usePasswordPrompt.getState().answer("dois");
    await expect(second).resolves.toBe("dois");
    expect(usePasswordPrompt.getState().open).toBe(false);
  });

  it("answer with nothing pending is a no-op", () => {
    usePasswordPrompt.getState().answer("x");
    expect(usePasswordPrompt.getState().open).toBe(false);
  });
});
