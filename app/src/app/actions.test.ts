import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { DocumentInfo } from "../lib/ipc";

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("../print/printPdf", () => ({ printPdf: vi.fn() }));
vi.mock("./openFile", () => ({ openFile: vi.fn(), closeFile: vi.fn() }));

import { selectActiveTab, useDocuments } from "../store/documents";
import { goToPage } from "./actions";

const info: DocumentInfo = {
  docId: "doc-1", path: "C:/a.pdf", fileName: "a.pdf", pageCount: 5, title: null, readOnlyReason: null, sizeBytes: 1,
};
const gotoPage = () => selectActiveTab(useDocuments.getState())?.gotoPage;

describe("goToPage", () => {
  beforeEach(() => {
    useDocuments.setState({ tabs: [], activeId: null });
    useDocuments.getState().addTab(info, { numPages: 5 } as PDFDocumentProxy);
  });

  it("clamps into the page range", () => {
    goToPage(99);
    expect(gotoPage()).toBe(4);
    goToPage(-3);
    expect(gotoPage()).toBe(0);
  });

  it("truncates fractional indices", () => {
    goToPage(2.7);
    expect(gotoPage()).toBe(2);
  });

  it("ignores non-finite indices", () => {
    goToPage(NaN);
    expect(gotoPage()).toBeNull();
    goToPage(Infinity);
    expect(gotoPage()).toBeNull();
  });
});
