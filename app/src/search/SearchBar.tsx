import { useEffect, useRef, useState } from "react";
import { goToPage } from "../app/actions";
import { useDocuments, type Tab } from "../store/documents";
import { searchDocument } from "./search";

export function SearchBar({ tab }: { tab: Tab }) {
  const updateTab = useDocuments((s) => s.updateTab);
  const setSearchOpen = useDocuments((s) => s.setSearchOpen);
  const [query, setQuery] = useState(tab.search.query);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { matches, active } = tab.search;
  const docId = tab.info.docId;

  useEffect(() => inputRef.current?.focus(), []);

  const select = (index: number) => {
    if (matches.length === 0) return;
    const next = (index + matches.length) % matches.length;
    updateTab(docId, { search: { ...tab.search, active: next } });
    goToPage(matches[next].pageIndex);
  };

  const run = async () => {
    if (query === tab.search.query && matches.length > 0) return select(active + 1);
    setBusy(true);
    try {
      const found = await searchDocument(tab.pdf, query);
      updateTab(docId, { search: { query, matches: found, active: 0 } });
      if (found.length > 0) goToPage(found[0].pageIndex);
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    updateTab(docId, { search: { query: "", matches: [], active: 0 } });
    setSearchOpen(false);
  };

  return (
    <div className="search-bar">
      <input
        ref={inputRef}
        aria-label="Buscar no documento"
        placeholder="Buscar…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void (e.shiftKey ? select(active - 1) : run());
          if (e.key === "Escape") close();
        }}
      />
      <span className="search-count">
        {busy ? "Buscando…" : tab.search.query ? (matches.length ? `${active + 1} de ${matches.length}` : "Nenhum resultado") : ""}
      </span>
      <button onClick={() => select(active - 1)} disabled={!matches.length} aria-label="Anterior">↑</button>
      <button onClick={() => select(active + 1)} disabled={!matches.length} aria-label="Próximo">↓</button>
      <button onClick={close} aria-label="Fechar busca">×</button>
    </div>
  );
}
