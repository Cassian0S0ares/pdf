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
