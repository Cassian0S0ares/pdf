// @vitest-environment node
import { describe, it, expect } from "vitest";
import { makePdf } from "../test/makePdf";
import { loadPdf, pdfResourceUrls } from "./pdfEngine";

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

describe("pdfResourceUrls", () => {
  it("builds absolute, slash-terminated URLs under pdfjs/", () => {
    expect(pdfResourceUrls("http://tauri.localhost/index.html")).toEqual({
      cMapUrl: "http://tauri.localhost/pdfjs/cmaps/",
      standardFontDataUrl: "http://tauri.localhost/pdfjs/standard_fonts/",
      wasmUrl: "http://tauri.localhost/pdfjs/wasm/",
      iccUrl: "http://tauri.localhost/pdfjs/iccs/",
    });
  });

  it("works with the macOS/Linux custom scheme", () => {
    expect(pdfResourceUrls("tauri://localhost/").wasmUrl).toBe("tauri://localhost/pdfjs/wasm/");
  });
});
