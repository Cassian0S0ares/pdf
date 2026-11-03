import { describe, it, expect, beforeEach } from "vitest";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { DocumentInfo } from "../lib/ipc";
import { selectActiveTab, useDocuments } from "./documents";

const info = (docId: string): DocumentInfo => ({
  docId, path: `C:/${docId}.pdf`, fileName: `${docId}.pdf`, pageCount: 2, title: null, readOnlyReason: null, sizeBytes: 10,
});
const pdf = {} as PDFDocumentProxy;

describe("documents store", () => {
  beforeEach(() => useDocuments.setState({ tabs: [], activeId: null, sidebarOpen: true, searchOpen: false }));

  it("addTab activates new tab with defaults", () => {
    useDocuments.getState().addTab(info("doc-1"), pdf);
    const tab = selectActiveTab(useDocuments.getState())!;
    expect(tab.info.docId).toBe("doc-1");
    expect(tab.fitMode).toBe("width");
    expect(tab.currentPage).toBe(0);
    expect(tab.search).toEqual({ query: "", matches: [], active: 0 });
  });

  it("closeTab activates the neighbour", () => {
    const s = useDocuments.getState();
    s.addTab(info("doc-1"), pdf);
    s.addTab(info("doc-2"), pdf);
    s.addTab(info("doc-3"), pdf);
    s.setActive("doc-2");
    useDocuments.getState().closeTab("doc-2");
    expect(useDocuments.getState().activeId).toBe("doc-3");
    useDocuments.getState().closeTab("doc-3");
    expect(useDocuments.getState().activeId).toBe("doc-1");
    useDocuments.getState().closeTab("doc-1");
    expect(useDocuments.getState().activeId).toBeNull();
  });

  it("updateTab patches only the target tab", () => {
    const s = useDocuments.getState();
    s.addTab(info("doc-1"), pdf);
    s.addTab(info("doc-2"), pdf);
    useDocuments.getState().updateTab("doc-1", { zoom: 2, fitMode: "custom" });
    const [a, b] = useDocuments.getState().tabs;
    expect(a.zoom).toBe(2);
    expect(a.fitMode).toBe("custom");
    expect(b.zoom).toBe(1);
  });
});
