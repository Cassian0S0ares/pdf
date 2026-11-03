export type ShortcutAction =
  | "open" | "close" | "find" | "print" | "zoomIn" | "zoomOut" | "zoomReset" | "nextPage" | "prevPage";

export function shortcutFor(e: { key: string; ctrlKey: boolean; metaKey: boolean }): ShortcutAction | null {
  if (e.ctrlKey || e.metaKey) {
    switch (e.key.toLowerCase()) {
      case "o": return "open";
      case "w": return "close";
      case "f": return "find";
      case "p": return "print";
      case "=":
      case "+": return "zoomIn";
      case "-": return "zoomOut";
      case "0": return "zoomReset";
      default: return null;
    }
  }
  if (e.key === "PageDown") return "nextPage";
  if (e.key === "PageUp") return "prevPage";
  return null;
}
