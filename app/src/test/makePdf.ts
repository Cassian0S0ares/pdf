export interface FixtureOptions {
  pages: string[];
  outline?: { title: string; page: number }[];
  title?: string;
}

const esc = (s: string) => s.replace(/[\\()]/g, (m) => "\\" + m);

/** Gera um PDF mínimo e válido (somente ASCII) para testes. */
export function makePdf({ pages, outline = [], title }: FixtureOptions): Uint8Array {
  const objs: string[] = [];
  const add = (body: string) => objs.push(body);
  const reserve = () => objs.push("");

  const catalog = reserve();
  const pagesId = reserve();
  const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const pageIds = pages.map((text) => {
    const content = `BT /F1 24 Tf 72 720 Td (${esc(text)}) Tj ET`;
    const c = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    return add(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] ` +
        `/Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${c} 0 R >>`,
    );
  });
  objs[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((i) => `${i} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let outlinesRef = "";
  if (outline.length > 0) {
    const root = reserve();
    const items = outline.map(() => reserve());
    items.forEach((id, i) => {
      const parts = [
        `/Title (${esc(outline[i].title)})`,
        `/Parent ${root} 0 R`,
        `/Dest [${pageIds[outline[i].page]} 0 R /Fit]`,
      ];
      if (i > 0) parts.push(`/Prev ${items[i - 1]} 0 R`);
      if (i < items.length - 1) parts.push(`/Next ${items[i + 1]} 0 R`);
      objs[id - 1] = `<< ${parts.join(" ")} >>`;
    });
    objs[root - 1] = `<< /Type /Outlines /First ${items[0]} 0 R /Last ${items[items.length - 1]} 0 R /Count ${items.length} >>`;
    outlinesRef = ` /Outlines ${root} 0 R`;
  }
  objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R${outlinesRef} >>`;
  const info = title ? add(`<< /Title (${esc(title)}) >>`) : null;

  let out = "%PDF-1.7\n";
  const offsets: number[] = [];
  objs.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R${info ? ` /Info ${info} 0 R` : ""} >>\n`;
  out += `startxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}
