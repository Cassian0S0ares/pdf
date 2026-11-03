import { useState, useEffect } from "react";
import { selectActiveTab, useDocuments } from "../store/documents";
import {
  goRelative, goToPage, pickAndOpen, printActive, rotateView, setFit, toggleViewMode, zoomBy,
} from "./actions";

export function Toolbar() {
  const tab = useDocuments(selectActiveTab);
  const toggleSidebar = useDocuments((s) => s.toggleSidebar);
  const setSearchOpen = useDocuments((s) => s.setSearchOpen);
  const [pageInput, setPageInput] = useState("");

  useEffect(() => setPageInput(tab ? String(tab.currentPage + 1) : ""), [tab?.currentPage, tab?.info.docId]);

  return (
    <div className="toolbar">
      <button onClick={() => void pickAndOpen()} title="Abrir (Ctrl+O)">Abrir</button>
      {tab && (
        <>
          <button onClick={toggleSidebar} title="Painel lateral">☰</button>
          <span className="sep" />
          <button onClick={() => goRelative(-1)} title="Página anterior">‹</button>
          <input
            className="page-input"
            aria-label="Página"
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") goToPage(Number(pageInput) - 1);
            }}
          />
          <span>/ {tab.pdf.numPages}</span>
          <button onClick={() => goRelative(1)} title="Próxima página">›</button>
          <span className="sep" />
          <button onClick={() => zoomBy(-1)} title="Diminuir zoom (Ctrl+-)">−</button>
          <span className="zoom-label">{tab.fitMode === "custom" ? `${Math.round(tab.zoom * 100)}%` : tab.fitMode === "width" ? "Largura" : "Página"}</span>
          <button onClick={() => zoomBy(1)} title="Aumentar zoom (Ctrl++)">+</button>
          <button onClick={() => setFit("width")} aria-pressed={tab.fitMode === "width"}>Ajustar largura</button>
          <button onClick={() => setFit("page")} aria-pressed={tab.fitMode === "page"}>Página inteira</button>
          <span className="sep" />
          <button onClick={() => rotateView(-1)} title="Girar à esquerda">⟲</button>
          <button onClick={() => rotateView(1)} title="Girar à direita">⟳</button>
          <button onClick={toggleViewMode}>{tab.viewMode === "continuous" ? "Página única" : "Contínuo"}</button>
          <span className="sep" />
          <button onClick={() => setSearchOpen(true)} title="Buscar (Ctrl+F)">Buscar</button>
          <button onClick={() => void printActive()} title="Imprimir (Ctrl+P)">Imprimir</button>
          {tab.info.readOnlyReason && (
            <span className="badge" title="Edição desabilitada">
              {tab.info.readOnlyReason === "encrypted" ? "Protegido — somente leitura" : "Arquivo danificado — somente leitura"}
            </span>
          )}
        </>
      )}
    </div>
  );
}
