import { closeDocument, getDocumentBytes, openDocument } from "../lib/ipc";
import { loadPdf, PasswordRequiredError } from "../lib/pdfEngine";
import { useDocuments } from "../store/documents";

export type AskPassword = (fileName: string, incorrect: boolean) => Promise<string | null>;

export async function openFile(path: string, askPassword: AskPassword): Promise<"opened" | "already-open" | "cancelled"> {
  const existing = useDocuments.getState().tabs.find((t) => t.info.path === path);
  if (existing) {
    useDocuments.getState().setActive(existing.info.docId);
    return "already-open";
  }

  const info = await openDocument(path);
  try {
    const bytes = await getDocumentBytes(info.docId);
    let password: string | undefined;
    for (;;) {
      try {
        const pdf = await loadPdf(bytes, password);
        useDocuments.getState().addTab(info, pdf);
        return "opened";
      } catch (e) {
        if (!(e instanceof PasswordRequiredError)) throw e;
        const answer = await askPassword(info.fileName, e.incorrect);
        if (answer === null) {
          await closeDocument(info.docId).catch(() => undefined);
          return "cancelled";
        }
        password = answer;
      }
    }
  } catch (e) {
    await closeDocument(info.docId).catch(() => undefined);
    throw e;
  }
}

export async function closeFile(docId: string): Promise<void> {
  const tab = useDocuments.getState().tabs.find((t) => t.info.docId === docId);
  if (!tab) return;
  useDocuments.getState().closeTab(docId);
  try {
    await tab.pdf.destroy();
  } finally {
    await closeDocument(docId);
  }
}
