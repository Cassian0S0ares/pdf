// @vitest-environment node
import { describe, it, expect } from "vitest";
import { makePdf } from "../test/makePdf";
import { loadPdf } from "./pdfEngine";

describe("loadPdf", () => {
  it("loads page count from bytes", async () => {
    const pdf = await loadPdf(makePdf({ pages: ["a", "b", "c"] }));
    expect(pdf.numPages).toBe(3);
    await pdf.destroy();
  });

  it("does not detach the caller's buffer", async () => {
    const bytes = makePdf({ pages: ["a"] });
    const pdf = await loadPdf(bytes);
    expect(bytes.byteLength).toBeGreaterThan(0);
    await pdf.destroy();
  });
});
