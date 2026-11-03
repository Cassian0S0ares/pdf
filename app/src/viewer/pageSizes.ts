import { useEffect, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

export interface PageSize {
  width: number;
  height: number;
}

export async function loadPageSizes(pdf: PDFDocumentProxy): Promise<PageSize[]> {
  const sizes: PageSize[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const viewport = (await pdf.getPage(i)).getViewport({ scale: 1 });
    sizes.push({ width: viewport.width, height: viewport.height });
  }
  return sizes;
}

const cache = new WeakMap<PDFDocumentProxy, Promise<PageSize[]>>();

/** Tamanhos das páginas, carregados uma vez por documento e compartilhados (viewer, miniaturas). */
export function getPageSizes(pdf: PDFDocumentProxy): Promise<PageSize[]> {
  let sizes = cache.get(pdf);
  if (!sizes) {
    sizes = loadPageSizes(pdf);
    cache.set(pdf, sizes);
    // Falhas (ex.: documento fechado durante o carregamento) não ficam em cache.
    sizes.catch(() => cache.delete(pdf));
  }
  return sizes;
}

export function usePageSizes(pdf: PDFDocumentProxy): PageSize[] {
  const [sizes, setSizes] = useState<PageSize[]>([]);
  useEffect(() => {
    let cancelled = false;
    getPageSizes(pdf)
      .then((s) => !cancelled && setSizes(s))
      .catch(() => undefined); // documento fechado/destruído: nada a mostrar
    return () => {
      cancelled = true;
    };
  }, [pdf]);
  return sizes;
}
