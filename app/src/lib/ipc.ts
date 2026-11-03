import { invoke } from "@tauri-apps/api/core";

export type ReadOnlyReason = "encrypted" | "unparseable";

export interface DocumentInfo {
  docId: string;
  path: string | null;
  fileName: string;
  pageCount: number | null;
  title: string | null;
  readOnlyReason: ReadOnlyReason | null;
  sizeBytes: number;
}

export interface AppError {
  code: string;
  message: string;
  details: string | null;
}

export function isAppError(e: unknown): e is AppError {
  return typeof e === "object" && e !== null && "code" in e && "message" in e && !(e instanceof Error);
}

export const openDocument = (path: string) => invoke<DocumentInfo>("open_document", { path });

export async function getDocumentBytes(docId: string): Promise<Uint8Array> {
  const buf = await invoke<ArrayBuffer>("get_document_bytes", { docId });
  return new Uint8Array(buf);
}

export const closeDocument = (docId: string) => invoke<void>("close_document", { docId });

export const initialFiles = () => invoke<string[]>("initial_files");

export const printPage = () => invoke<void>("print_page");
