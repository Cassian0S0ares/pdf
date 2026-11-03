// @vitest-environment node
import { describe, it, expect } from "vitest";
import { makePdf } from "../test/makePdf";
import { loadPdf } from "../lib/pdfEngine";
import { loadPageSizes } from "./pageSizes";

describe("loadPageSizes", () => {
  it("returns size in points for every page", async () => {
    const pdf = await loadPdf(makePdf({ pages: ["a", "b"] }));
    expect(await loadPageSizes(pdf)).toEqual([
      { width: 612, height: 792 },
      { width: 612, height: 792 },
    ]);
    await pdf.destroy();
  });
});
