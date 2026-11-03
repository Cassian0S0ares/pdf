import { open } from "@tauri-apps/plugin-dialog";
import { errorMessage } from "../lib/errors";
import { selectActiveTab, useDocuments, type TabPatch } from "../store/documents";
import { useNotices } from "../store/notices";
import { usePasswordPrompt } from "../store/passwordPrompt";
import { nextZoom, rotate, type FitMode } from "../viewer/zoom";
import { printPdf } from "../print/printPdf";
import { closeFile, openFile } from "./openFile";
import type { ShortcutAction } from "./shortcuts";

const active = () => selectActiveTab(useDocuments.getState());

function patchActive(patch: TabPatch) {
  const tab = active();
  if (tab) useDocuments.getState().updateTab(tab.info.docId, patch);
}

export async function openFiles(paths: string[]): Promise<void> {
  for (const path of paths) {
    try {
      await openFile(path, usePasswordPrompt.getState().ask);
    } catch (e) {
      const name = path.split(/[\\/]/).pop() ?? path;
      useNotices.getState().push("error", `${name}: ${errorMessage(e)}`);
    }
  }
}

export async function pickAndOpen(): Promise<void> {
  const selected = await open({ multiple: true, filters: [{ name: "PDF", extensions: ["pdf"] }] });
  if (selected === null) return;
  await openFiles(Array.isArray(selected) ? selected : [selected]);
}

export async function closeActive(): Promise<void> {
  const tab = active();
  if (tab) await closeFile(tab.info.docId);
}

export function zoomBy(dir: 1 | -1): void {
  const tab = active();
  if (tab) patchActive({ zoom: nextZoom(tab.zoom, dir), fitMode: "custom" });
}

export const zoomReset = () => patchActive({ zoom: 1, fitMode: "custom" });
export const setFit = (mode: FitMode) => patchActive({ fitMode: mode });

export function rotateView(dir: 1 | -1): void {
  const tab = active();
  if (tab) patchActive({ rotation: rotate(tab.rotation, dir) });
}

export function goToPage(index: number): void {
  const tab = active();
  if (!tab) return;
  patchActive({ gotoPage: Math.min(Math.max(index, 0), tab.pdf.numPages - 1) });
}

export function goRelative(delta: number): void {
  const tab = active();
  if (tab) goToPage(tab.currentPage + delta);
}

export function toggleViewMode(): void {
  const tab = active();
  if (tab) patchActive({ viewMode: tab.viewMode === "continuous" ? "single" : "continuous", gotoPage: tab.currentPage });
}

export async function printActive(): Promise<void> {
  const tab = active();
  const root = document.getElementById("print-root");
  if (!tab || !root) return;
  try {
    useNotices.getState().push("info", "Preparando impressão…");
    await printPdf(tab.pdf, root);
  } catch (e) {
    useNotices.getState().push("error", `Impressão: ${errorMessage(e)}`);
  }
}

export function runShortcut(action: ShortcutAction): void {
  switch (action) {
    case "open": void pickAndOpen(); break;
    case "close": void closeActive(); break;
    case "find": useDocuments.getState().setSearchOpen(true); break;
    case "print": void printActive(); break;
    case "zoomIn": zoomBy(1); break;
    case "zoomOut": zoomBy(-1); break;
    case "zoomReset": zoomReset(); break;
    case "nextPage": goRelative(1); break;
    case "prevPage": goRelative(-1); break;
  }
}
