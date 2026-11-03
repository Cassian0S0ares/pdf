// @vitest-environment node
import { describe, it, expect } from "vitest";
import { makePdf } from "../test/makePdf";
import { loadPdf } from "../lib/pdfEngine";
import { loadOutline } from "./outline";

describe("loadOutline", () => {
  it("resolves bookmark destinations to page indices", async () => {
    const pdf = await loadPdf(
      makePdf({ pages: ["a", "b", "c"], outline: [{ title: "Intro", page: 0 }, { title: "Fim", page: 2 }] }),
    );
    expect(await loadOutline(pdf)).toEqual([
      { title: "Intro", pageIndex: 0, children: [] },
      { title: "Fim", pageIndex: 2, children: [] },
    ]);
    await pdf.destroy();
  });

  it("returns empty list without outline", async () => {
    const pdf = await loadPdf(makePdf({ pages: ["a"] }));
    expect(await loadOutline(pdf)).toEqual([]);
    await pdf.destroy();
  });
});
