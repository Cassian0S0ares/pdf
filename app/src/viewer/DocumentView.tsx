import { useEffect, useMemo, useRef, useState } from "react";
import { useDocuments, type Tab } from "../store/documents";
import { PageView } from "./PageView";
import { usePageSizes } from "./pageSizes";
import { useElementSize } from "./useElementSize";
import { computeScale } from "./zoom";

const FALLBACK_SIZE = { width: 612, height: 792 };

export function DocumentView({ tab }: { tab: Tab }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const sizes = usePageSizes(tab.pdf);
  const container = useElementSize(containerRef);
  const updateTab = useDocuments((s) => s.updateTab);
  const [visible, setVisible] = useState<Set<number>>(new Set());
  const docId = tab.info.docId;

  const reference = sizes[tab.currentPage] ?? sizes[0] ?? FALLBACK_SIZE;
  const scale = computeScale({
    fitMode: tab.fitMode,
    zoom: tab.zoom,
    pageWidth: reference.width,
    pageHeight: reference.height,
    rotation: tab.rotation,
    containerWidth: container.width,
    containerHeight: container.height,
  });

  const pageIndices = useMemo(
    () => (tab.viewMode === "single" ? [tab.currentPage] : sizes.map((_, i) => i)),
    [tab.viewMode, tab.currentPage, sizes],
  );

  // Visibilidade e página atual na rolagem contínua.
  useEffect(() => {
    if (tab.viewMode !== "continuous" || !containerRef.current) return;
    const ratios = new Map<number, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const index = Number((e.target as HTMLElement).dataset.index);
          if (e.isIntersecting) ratios.set(index, e.intersectionRatio);
          else ratios.delete(index);
        }
        setVisible(new Set(ratios.keys()));
        let best = -1;
        let bestRatio = -1;
        ratios.forEach((r, i) => {
          if (r > bestRatio) {
            best = i;
            bestRatio = r;
          }
        });
        if (best >= 0 && best !== useDocuments.getState().tabs.find((t) => t.info.docId === docId)?.currentPage) {
          updateTab(docId, { currentPage: best });
        }
      },
      { root: containerRef.current, rootMargin: "100% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    pageRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [tab.viewMode, sizes, docId, updateTab]);

  // Navegação solicitada (miniatura, bookmark, busca, toolbar).
  useEffect(() => {
    if (tab.gotoPage === null) return;
    const target = tab.gotoPage;
    if (tab.viewMode === "continuous") pageRefs.current[target]?.scrollIntoView({ block: "start" });
    updateTab(docId, { gotoPage: null, currentPage: target });
  }, [tab.gotoPage, tab.viewMode, docId, updateTab]);

  const active = tab.search.matches[tab.search.active];

  return (
    <div className="document-view" ref={containerRef}>
      {pageIndices.map((i) => (
        <div
          key={i}
          data-index={i}
          className="page-slot"
          ref={(el) => {
            pageRefs.current[i] = el;
          }}
        >
          <PageView
            pdf={tab.pdf}
            pageIndex={i}
            size={sizes[i] ?? FALLBACK_SIZE}
            scale={scale}
            rotation={tab.rotation}
            visible={tab.viewMode === "single" || visible.has(i)}
            highlights={tab.search.matches.filter((m) => m.pageIndex === i).flatMap((m) => m.itemIndices)}
            activeHighlights={active?.pageIndex === i ? active.itemIndices : []}
          />
        </div>
      ))}
    </div>
  );
}
