import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DocumentInfo } from "../lib/ipc";

const ipc = vi.hoisted(() => ({
  openDocument: vi.fn(),
  getDocumentBytes: vi.fn(),
  closeDocument: vi.fn(),
}));
const engine = vi.hoisted(() => ({ loadPdf: vi.fn() }));
vi.mock("../lib/ipc", () => ipc);
vi.mock("../lib/pdfEngine", async () => {
  class PasswordRequiredError extends Error {
    constructor(public readonly incorrect: boolean) { super("pw"); }
  }
  return { loadPdf: engine.loadPdf, PasswordRequiredError };
});

import { PasswordRequiredError } from "../lib/pdfEngine";
import { useDocuments } from "../store/documents";
import { closeFile, openFile } from "./openFile";

const info: DocumentInfo = {
  docId: "doc-1", path: "C:/a.pdf", fileName: "a.pdf", pageCount: 1, title: null, readOnlyReason: null, sizeBytes: 1,
};
const fakePdf = { destroy: vi.fn().mockResolvedValue(undefined) };

describe("openFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDocuments.setState({ tabs: [], activeId: null });
    ipc.openDocument.mockResolvedValue(info);
    ipc.getDocumentBytes.mockResolvedValue(new Uint8Array([1]));
    ipc.closeDocument.mockResolvedValue(undefined);
  });

  it("opens and adds a tab", async () => {
    engine.loadPdf.mockResolvedValue(fakePdf);
    await expect(openFile("C:/a.pdf", vi.fn())).resolves.toBe("opened");
    expect(useDocuments.getState().tabs).toHaveLength(1);
  });

  it("activates existing tab for same path without reopening", async () => {
    engine.loadPdf.mockResolvedValue(fakePdf);
    await openFile("C:/a.pdf", vi.fn());
    await expect(openFile("C:/a.pdf", vi.fn())).resolves.toBe("already-open");
    expect(ipc.openDocument).toHaveBeenCalledTimes(1);
  });

  it("asks for password and retries", async () => {
    engine.loadPdf
      .mockRejectedValueOnce(new PasswordRequiredError(false))
      .mockRejectedValueOnce(new PasswordRequiredError(true))
      .mockResolvedValueOnce(fakePdf);
    const ask = vi.fn().mockResolvedValueOnce("errada").mockResolvedValueOnce("certa");
    await expect(openFile("C:/a.pdf", ask)).resolves.toBe("opened");
    expect(ask).toHaveBeenNthCalledWith(1, "a.pdf", false);
    expect(ask).toHaveBeenNthCalledWith(2, "a.pdf", true);
    expect(engine.loadPdf).toHaveBeenLastCalledWith(expect.any(Uint8Array), "certa");
  });

  it("cancelled password closes the core session", async () => {
    engine.loadPdf.mockRejectedValue(new PasswordRequiredError(false));
    await expect(openFile("C:/a.pdf", vi.fn().mockResolvedValue(null))).resolves.toBe("cancelled");
    expect(ipc.closeDocument).toHaveBeenCalledWith("doc-1");
    expect(useDocuments.getState().tabs).toHaveLength(0);
  });

  it("cancelled password tolerates a failing closeDocument", async () => {
    engine.loadPdf.mockRejectedValue(new PasswordRequiredError(false));
    ipc.closeDocument.mockRejectedValue(new Error("ipc"));
    await expect(openFile("C:/a.pdf", vi.fn().mockResolvedValue(null))).resolves.toBe("cancelled");
    expect(ipc.closeDocument).toHaveBeenCalledTimes(1);
  });

  it("render failure closes the core session and rethrows", async () => {
    engine.loadPdf.mockRejectedValue(new Error("corrompido"));
    await expect(openFile("C:/a.pdf", vi.fn())).rejects.toThrow("corrompido");
    expect(ipc.closeDocument).toHaveBeenCalledWith("doc-1");
  });
});

describe("closeFile", () => {
  it("destroys pdf, closes session and removes tab", async () => {
    engine.loadPdf.mockResolvedValue(fakePdf);
    await openFile("C:/a.pdf", vi.fn());
    await closeFile("doc-1");
    expect(fakePdf.destroy).toHaveBeenCalled();
    expect(ipc.closeDocument).toHaveBeenCalledWith("doc-1");
    expect(useDocuments.getState().tabs).toHaveLength(0);
  });

  it("closes the core session even if pdf.destroy fails", async () => {
    vi.clearAllMocks();
    useDocuments.setState({ tabs: [], activeId: null });
    ipc.openDocument.mockResolvedValue(info);
    ipc.getDocumentBytes.mockResolvedValue(new Uint8Array([1]));
    ipc.closeDocument.mockResolvedValue(undefined);
    const failing = { destroy: vi.fn().mockRejectedValue(new Error("destroy")) };
    engine.loadPdf.mockResolvedValue(failing);
    await openFile("C:/a.pdf", vi.fn());
    await expect(closeFile("doc-1")).rejects.toThrow("destroy");
    expect(ipc.closeDocument).toHaveBeenCalledWith("doc-1");
    expect(useDocuments.getState().tabs).toHaveLength(0);
  });
});
