// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { makePdf } from "../test/makePdf";
import { loadPdf } from "../lib/pdfEngine";
import { getPageSizes, loadPageSizes } from "./pageSizes";

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

describe("getPageSizes (cache)", () => {
  const fakePdf = (fail = false) =>
    ({
      numPages: 2,
      getPage: vi.fn(async () => {
        if (fail) throw new Error("destroyed");
        return { getViewport: () => ({ width: 100, height: 200 }) };
      }),
    }) as unknown as PDFDocumentProxy & { getPage: ReturnType<typeof vi.fn> };

  it("loads sizes once per document and shares the promise", async () => {
    const pdf = fakePdf();
    const a = getPageSizes(pdf);
    const b = getPageSizes(pdf);
    expect(a).toBe(b);
    expect(await a).toEqual([{ width: 100, height: 200 }, { width: 100, height: 200 }]);
    expect(pdf.getPage).toHaveBeenCalledTimes(2);
  });

  it("separate documents get separate entries", () => {
    expect(getPageSizes(fakePdf())).not.toBe(getPageSizes(fakePdf()));
  });

  it("evicts failures so a later call retries", async () => {
    const pdf = fakePdf(true);
    await expect(getPageSizes(pdf)).rejects.toThrow("destroyed");
    await expect(getPageSizes(pdf)).rejects.toThrow("destroyed");
    expect(pdf.getPage).toHaveBeenCalledTimes(2);
  });
});
