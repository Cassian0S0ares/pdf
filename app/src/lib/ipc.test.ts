import { describe, it, expect, vi, beforeEach } from "vitest";

const invoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...a: unknown[]) => invoke(...a) }));

import { closeDocument, getDocumentBytes, isAppError, openDocument } from "./ipc";

describe("ipc", () => {
  beforeEach(() => invoke.mockReset());

  it("openDocument passes path", async () => {
    invoke.mockResolvedValue({ docId: "doc-1" });
    await openDocument("C:/a.pdf");
    expect(invoke).toHaveBeenCalledWith("open_document", { path: "C:/a.pdf" });
  });

  it("getDocumentBytes wraps ArrayBuffer in Uint8Array", async () => {
    invoke.mockResolvedValue(new Uint8Array([1, 2, 3]).buffer);
    const bytes = await getDocumentBytes("doc-1");
    expect(invoke).toHaveBeenCalledWith("get_document_bytes", { docId: "doc-1" });
    expect(Array.from(bytes)).toEqual([1, 2, 3]);
  });

  it("closeDocument passes docId", async () => {
    invoke.mockResolvedValue(null);
    await closeDocument("doc-9");
    expect(invoke).toHaveBeenCalledWith("close_document", { docId: "doc-9" });
  });

  it("isAppError recognizes core errors", () => {
    expect(isAppError({ code: "IO", message: "x", details: null })).toBe(true);
    expect(isAppError(new Error("x"))).toBe(false);
    expect(isAppError("x")).toBe(false);
  });
});
