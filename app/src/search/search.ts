import type { PDFDocumentProxy } from "pdfjs-dist";
import type { PageMatch } from "../store/documents";

export interface TextItemLike {
  str: string;
  hasEOL?: boolean;
}

export function findInPage(items: TextItemLike[], query: string, pageIndex: number): PageMatch[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [];
  let text = "";
  const starts: number[] = [];
  for (const item of items) {
    starts.push(text.length);
    text += item.str;
    if (item.hasEOL) text += " ";
  }
  const haystack = text.toLocaleLowerCase();
  const matches: PageMatch[] = [];
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at < 0) break;
    const end = at + needle.length;
    const itemIndices: number[] = [];
    items.forEach((item, i) => {
      const s = starts[i];
      if (s + item.str.length > at && s < end) itemIndices.push(i);
    });
    matches.push({ pageIndex, itemIndices });
    from = end;
  }
  return matches;
}

export async function searchDocument(pdf: PDFDocumentProxy, query: string): Promise<PageMatch[]> {
  const all: PageMatch[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const content = await (await pdf.getPage(i)).getTextContent();
    // Itens de marked-content não têm `str` e não geram textDivs no TextLayer.
    const items = content.items.filter((it) => "str" in it) as TextItemLike[];
    all.push(...findInPage(items, query, i - 1));
  }
  return all;
}
