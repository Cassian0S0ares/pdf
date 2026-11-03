import { getDocument, PasswordResponses, type PDFDocumentProxy } from "pdfjs-dist";

export class PasswordRequiredError extends Error {
  constructor(public readonly incorrect: boolean) {
    super(incorrect ? "Senha incorreta" : "Este documento exige senha");
    this.name = "PasswordRequiredError";
  }
}

export async function loadPdf(bytes: Uint8Array, password?: string): Promise<PDFDocumentProxy> {
  try {
    // PDF.js transfere o buffer para o worker; passamos uma cópia.
    return await getDocument({ data: bytes.slice(), password }).promise;
  } catch (e) {
    if (typeof e === "object" && e !== null && (e as { name?: string }).name === "PasswordException") {
      const code = (e as { code?: number }).code;
      throw new PasswordRequiredError(code === PasswordResponses.INCORRECT_PASSWORD);
    }
    throw e;
  }
}
