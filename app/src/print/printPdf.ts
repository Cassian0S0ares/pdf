import type { PDFDocumentProxy } from "pdfjs-dist";
import { printPage } from "../lib/ipc";

/** Renderiza todas as páginas em imagens no #print-root e abre o diálogo de impressão do sistema. */
export async function printPdf(pdf: PDFDocumentProxy, root: HTMLElement, dpi = 150): Promise<void> {
  root.querySelectorAll("img").forEach((img) => URL.revokeObjectURL(img.src));
  root.replaceChildren();
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: dpi / 72 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport }).promise;
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao preparar impressão"))), "image/png"),
    );
    const img = document.createElement("img");
    img.className = "print-page";
    img.src = URL.createObjectURL(blob);
    root.appendChild(img);
  }
  await Promise.all(Array.from(root.querySelectorAll("img")).map((img) => img.decode().catch(() => undefined)));
  await printPage();
}
