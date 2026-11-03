// @vitest-environment node
import { describe, it, expect } from "vitest";
import { makePdf } from "../test/makePdf";
import { loadPdf } from "../lib/pdfEngine";
import { searchDocument } from "./search";

describe("searchDocument", () => {
  it("returns matches across pages", async () => {
    const pdf = await loadPdf(makePdf({ pages: ["contrato social", "sem nada", "Contrato final"] }));
    const matches = await searchDocument(pdf, "contrato");
    expect(matches.map((m) => m.pageIndex)).toEqual([0, 2]);
    await pdf.destroy();
  });
});
