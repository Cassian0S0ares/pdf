import type { PDFDocumentProxy } from "pdfjs-dist";

export interface OutlineNode {
  title: string;
  pageIndex: number | null;
  children: OutlineNode[];
}

type RawItem = Awaited<ReturnType<PDFDocumentProxy["getOutline"]>>[number];

export async function loadOutline(pdf: PDFDocumentProxy): Promise<OutlineNode[]> {
  const raw = await pdf.getOutline();
  if (!raw) return [];
  return Promise.all(raw.map((item) => convert(pdf, item)));
}

async function convert(pdf: PDFDocumentProxy, item: RawItem): Promise<OutlineNode> {
  return {
    title: item.title,
    pageIndex: await resolvePageIndex(pdf, item.dest),
    children: await Promise.all((item.items ?? []).map((child: RawItem) => convert(pdf, child))),
  };
}

async function resolvePageIndex(pdf: PDFDocumentProxy, dest: RawItem["dest"]): Promise<number | null> {
  if (!dest) return null;
  const explicit = typeof dest === "string" ? await pdf.getDestination(dest) : dest;
  if (!explicit || explicit.length === 0) return null;
  const ref = explicit[0];
  if (typeof ref === "number") return ref;
  try {
    return await pdf.getPageIndex(ref as Parameters<PDFDocumentProxy["getPageIndex"]>[0]);
  } catch {
    return null;
  }
}
