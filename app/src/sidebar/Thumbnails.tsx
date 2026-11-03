import { useRef } from "react";
import { goToPage } from "../app/actions";
import type { Tab } from "../store/documents";
import { PageView } from "../viewer/PageView";
import { usePageSizes, type PageSize } from "../viewer/pageSizes";
import { useInView } from "../viewer/useInView";
import { PDF_TO_CSS } from "../viewer/zoom";

const THUMB_WIDTH = 120;

export function Thumbnails({ tab }: { tab: Tab }) {
  const sizes = usePageSizes(tab.pdf);
  return (
    <div className="thumbnails">
      {sizes.map((size, i) => (
        <Thumbnail key={i} tab={tab} index={i} size={size} />
      ))}
    </div>
  );
}

function Thumbnail({ tab, index, size }: { tab: Tab; index: number; size: PageSize }) {
  const ref = useRef<HTMLButtonElement>(null);
  const inView = useInView(ref);
  const isCurrent = tab.currentPage === index;
  return (
    <button ref={ref} className={isCurrent ? "thumb current" : "thumb"} onClick={() => goToPage(index)} aria-label={`Página ${index + 1}`}>
      <PageView
        pdf={tab.pdf}
        pageIndex={index}
        size={size}
        scale={THUMB_WIDTH / (size.width * PDF_TO_CSS)}
        rotation={0}
        visible={inView}
        textLayer={false}
      />
      <span>{index + 1}</span>
    </button>
  );
}
