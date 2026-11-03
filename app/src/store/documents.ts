import { create } from "zustand";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { DocumentInfo } from "../lib/ipc";
import type { FitMode, Rotation } from "../viewer/zoom";

export type ViewMode = "continuous" | "single";

export interface PageMatch {
  pageIndex: number;
  itemIndices: number[];
}

export interface SearchState {
  query: string;
  matches: PageMatch[];
  active: number;
}

export interface Tab {
  info: DocumentInfo;
  pdf: PDFDocumentProxy;
  zoom: number;
  fitMode: FitMode;
  rotation: Rotation;
  viewMode: ViewMode;
  currentPage: number;
  gotoPage: number | null;
  search: SearchState;
}

export type TabPatch = Partial<Omit<Tab, "info" | "pdf">>;

interface DocumentsState {
  tabs: Tab[];
  activeId: string | null;
  sidebarOpen: boolean;
  searchOpen: boolean;
  addTab(info: DocumentInfo, pdf: PDFDocumentProxy): void;
  closeTab(docId: string): void;
  setActive(docId: string): void;
  updateTab(docId: string, patch: TabPatch): void;
  toggleSidebar(): void;
  setSearchOpen(open: boolean): void;
}

export const useDocuments = create<DocumentsState>()((set) => ({
  tabs: [],
  activeId: null,
  sidebarOpen: true,
  searchOpen: false,
  addTab: (info, pdf) =>
    set((s) => ({
      tabs: [
        ...s.tabs,
        {
          info, pdf, zoom: 1, fitMode: "width", rotation: 0, viewMode: "continuous",
          currentPage: 0, gotoPage: null, search: { query: "", matches: [], active: 0 },
        },
      ],
      activeId: info.docId,
    })),
  closeTab: (docId) =>
    set((s) => {
      const index = s.tabs.findIndex((t) => t.info.docId === docId);
      if (index < 0) return s;
      const tabs = s.tabs.filter((t) => t.info.docId !== docId);
      let activeId = s.activeId;
      if (activeId === docId) activeId = (tabs[index] ?? tabs[index - 1])?.info.docId ?? null;
      return { tabs, activeId };
    }),
  setActive: (docId) => set({ activeId: docId }),
  updateTab: (docId, patch) =>
    set((s) => ({ tabs: s.tabs.map((t) => (t.info.docId === docId ? { ...t, ...patch } : t)) })),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSearchOpen: (open) => set({ searchOpen: open }),
}));

export const selectActiveTab = (s: Pick<DocumentsState, "tabs" | "activeId">): Tab | null =>
  s.tabs.find((t) => t.info.docId === s.activeId) ?? null;
