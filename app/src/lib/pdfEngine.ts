import { getDocument, PasswordResponses, type PDFDocumentProxy } from "pdfjs-dist";

/** Caminho (relativo à raiz do app) onde o Vite publica os recursos do PDF.js; ver vite.config.ts. */
export const PDFJS_RESOURCE_DIR = "pdfjs/";

export interface PdfResourceUrls {
  cMapUrl: string;
  standardFontDataUrl: string;
  wasmUrl: string;
  iccUrl: string;
}

/**
 * URLs absolutas dos recursos do PDF.js servidos localmente pelo app (nada de rede).
 * Precisam ser absolutas: o worker resolve URLs relativas a partir do próprio script.
 */
export function pdfResourceUrls(baseUri: string): PdfResourceUrls {
  const at = (dir: string) => new URL(`${PDFJS_RESOURCE_DIR}${dir}/`, baseUri).href;
  return {
    cMapUrl: at("cmaps"),
    standardFontDataUrl: at("standard_fonts"),
    wasmUrl: at("wasm"),
    iccUrl: at("iccs"),
  };
}

// Em testes (Node) os recursos não são servidos; o PDF.js segue sem eles.
const resources: Partial<PdfResourceUrls> =
  import.meta.env.MODE !== "test" && typeof document !== "undefined" ? pdfResourceUrls(document.baseURI) : {};

export class PasswordRequiredError extends Error {
  constructor(public readonly incorrect: boolean) {
    super(incorrect ? "Senha incorreta" : "Este documento exige senha");
    this.name = "PasswordRequiredError";
  }
}

export async function loadPdf(bytes: Uint8Array, password?: string): Promise<PDFDocumentProxy> {
  try {
    // PDF.js transfere o buffer para o worker; passamos uma cópia.
    return await getDocument({ data: bytes.slice(), password, cMapPacked: true, ...resources }).promise;
  } catch (e) {
    if (typeof e === "object" && e !== null && (e as { name?: string }).name === "PasswordException") {
      const code = (e as { code?: number }).code;
      throw new PasswordRequiredError(code === PasswordResponses.INCORRECT_PASSWORD);
    }
    throw e;
  }
}
