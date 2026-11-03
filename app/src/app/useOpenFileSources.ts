import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { initialFiles } from "../lib/ipc";
import { usePasswordPrompt } from "../store/passwordPrompt";
import { openFiles, runShortcut } from "./actions";
import { shortcutFor, shouldHandleShortcut } from "./shortcuts";

let initialHandled = false;
const isPdf = (p: string) => p.toLowerCase().endsWith(".pdf");

/** Liga as fontes de arquivos: argv inicial, segunda instância, arrastar-e-soltar e atalhos. */
export function useOpenFileSources(): void {
  useEffect(() => {
    if (!initialHandled) {
      initialHandled = true;
      void initialFiles().then(openFiles);
    }
    const unlistenOpen = listen<string[]>("open-files", (e) => void openFiles(e.payload));
    const unlistenDrop = getCurrentWebview().onDragDropEvent((e) => {
      if (e.payload.type === "drop") void openFiles(e.payload.paths.filter(isPdf));
    });
    const onKey = (e: KeyboardEvent) => {
      const action = shortcutFor(e);
      if (!action) return;
      if (!shouldHandleShortcut(e, usePasswordPrompt.getState().open)) return;
      e.preventDefault();
      runShortcut(action);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      void unlistenOpen.then((f) => f());
      void unlistenDrop.then((f) => f());
      window.removeEventListener("keydown", onKey);
    };
  }, []);
}
