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

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
}

/**
 * Decides whether a shortcut resolved by `shortcutFor` should actually run.
 * While the password prompt is open, the document being unlocked isn't the
 * active tab yet, so global shortcuts (Ctrl+W, Ctrl+O, ...) must be
 * suppressed entirely — the dialog handles its own Enter/Escape. Outside the
 * prompt, non-modifier shortcuts (PageUp/PageDown) are suppressed while the
 * user is typing in an editable element, so they don't hijack normal typing;
 * Ctrl/Meta shortcuts keep working from inputs.
 */
export function shouldHandleShortcut(
  e: { ctrlKey: boolean; metaKey: boolean; target: EventTarget | null },
  promptOpen: boolean,
): boolean {
  if (promptOpen) return false;
  if (e.ctrlKey || e.metaKey) return true;
  return !isEditableTarget(e.target);
}
