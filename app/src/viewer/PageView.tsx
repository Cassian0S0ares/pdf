import { useEffect, useRef, useState } from "react";
import { TextLayer, type PDFDocumentProxy, type RenderTask } from "pdfjs-dist";
import type { PageSize } from "./pageSizes";
import { PDF_TO_CSS, type Rotation } from "./zoom";

interface Props {
  pdf: PDFDocumentProxy;
  pageIndex: number;
  size: PageSize;
  scale: number;
  rotation: Rotation;
  visible: boolean;
  textLayer?: boolean;
  highlights?: number[];
  activeHighlights?: number[];
}

export function PageView({
  pdf, pageIndex, size, scale, rotation, visible, textLayer = true, highlights = [], activeHighlights = [],
}: Props) {
  const pageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [textDivs, setTextDivs] = useState<HTMLElement[]>([]);

  const sideways = rotation % 180 !== 0;
  const cssWidth = (sideways ? size.height : size.width) * scale * PDF_TO_CSS;
  const cssHeight = (sideways ? size.width : size.height) * scale * PDF_TO_CSS;

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let renderTask: RenderTask | null = null;
    let layer: TextLayer | null = null;

    (async () => {
      const page = await pdf.getPage(pageIndex + 1);
      if (cancelled) return;
      const viewport = page.getViewport({ scale: scale * PDF_TO_CSS, rotation: (page.rotate + rotation) % 360 });
      // --total-scale-factor (TextLayer) = --scale-factor * --user-unit (ver styles.css).
      pageRef.current?.style.setProperty("--user-unit", String(viewport.userUnit));
      const canvas = canvasRef.current!;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      renderTask = page.render({
        canvas,
        canvasContext: canvas.getContext("2d")!,
        viewport,
        transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined,
      });
      try {
        await renderTask.promise;
      } catch {
        return; // cancelado
      }
      if (cancelled || !textLayer || !textRef.current) return;
      const container = textRef.current;
      container.replaceChildren();
      layer = new TextLayer({ textContentSource: page.streamTextContent(), container, viewport });
      try {
        await layer.render();
      } catch {
        return; // cancelado
      }
      if (!cancelled) setTextDivs(layer.textDivs);
    })().catch(() => undefined);

    return () => {
      cancelled = true;
      renderTask?.cancel();
      layer?.cancel();
    };
  }, [pdf, pageIndex, scale, rotation, visible, textLayer]);

  useEffect(() => {
    textDivs.forEach((div, i) => {
      div.classList.toggle("search-hit", highlights.includes(i));
      div.classList.toggle("search-hit-active", activeHighlights.includes(i));
    });
    if (activeHighlights.length > 0) textDivs[activeHighlights[0]]?.scrollIntoView({ block: "center" });
  }, [textDivs, highlights, activeHighlights]);

  return (
    <div
      ref={pageRef}
      className="page"
      data-page-index={pageIndex}
      style={{ width: cssWidth, height: cssHeight, ["--scale-factor" as string]: scale * PDF_TO_CSS }}
    >
      {visible && <canvas ref={canvasRef} />}
      {visible && textLayer && <div ref={textRef} className="textLayer" />}
    </div>
  );
}
