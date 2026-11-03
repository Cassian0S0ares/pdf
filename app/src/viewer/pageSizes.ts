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

export function usePageSizes(pdf: PDFDocumentProxy): PageSize[] {
  const [sizes, setSizes] = useState<PageSize[]>([]);
  useEffect(() => {
    let cancelled = false;
    loadPageSizes(pdf).then((s) => !cancelled && setSizes(s));
    return () => {
      cancelled = true;
    };
  }, [pdf]);
  return sizes;
}
