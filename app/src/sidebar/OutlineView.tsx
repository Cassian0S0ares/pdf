import { useEffect, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { goToPage } from "../app/actions";
import { loadOutline, type OutlineNode } from "./outline";

export function Outline({ pdf }: { pdf: PDFDocumentProxy }) {
  const [nodes, setNodes] = useState<OutlineNode[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadOutline(pdf).then((n) => !cancelled && setNodes(n)).catch(() => !cancelled && setNodes([]));
    return () => {
      cancelled = true;
    };
  }, [pdf]);
  if (nodes === null) return <p className="muted">Carregando…</p>;
  if (nodes.length === 0) return <p className="muted">Sem marcadores</p>;
  return <OutlineList nodes={nodes} />;
}

function OutlineList({ nodes }: { nodes: OutlineNode[] }) {
  return (
    <ul className="outline">
      {nodes.map((n, i) => (
        <li key={i}>
          <button disabled={n.pageIndex === null} onClick={() => n.pageIndex !== null && goToPage(n.pageIndex)}>
            {n.title}
          </button>
          {n.children.length > 0 && <OutlineList nodes={n.children} />}
        </li>
      ))}
    </ul>
  );
}
