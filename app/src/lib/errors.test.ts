import { describe, it, expect } from "vitest";
import { errorMessage } from "./errors";

describe("errorMessage", () => {
  it("uses AppError message", () => {
    expect(errorMessage({ code: "IO", message: "Falhou", details: null })).toBe("Falhou");
  });
  it("uses Error message", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
  });
  it("stringifies anything else", () => {
    expect(errorMessage("texto")).toBe("texto");
  });
});
