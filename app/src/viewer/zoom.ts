/** PDF.js usa 1 unidade = 1px CSS; 100% deve corresponder ao tamanho impresso (96dpi / 72pt). */
export const PDF_TO_CSS = 96 / 72;

export type FitMode = "custom" | "width" | "page";
export type Rotation = 0 | 90 | 180 | 270;

export const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
const PADDING = 32;
const MIN_SCALE = 0.1;

export interface ScaleParams {
  fitMode: FitMode;
  zoom: number;
  pageWidth: number;
  pageHeight: number;
  rotation: Rotation;
  containerWidth: number;
  containerHeight: number;
}

export function computeScale(p: ScaleParams): number {
  const sideways = p.rotation % 180 !== 0;
  const w = (sideways ? p.pageHeight : p.pageWidth) * PDF_TO_CSS;
  const h = (sideways ? p.pageWidth : p.pageHeight) * PDF_TO_CSS;
  const byWidth = (p.containerWidth - PADDING) / w;
  const byHeight = (p.containerHeight - PADDING) / h;
  const scale = p.fitMode === "width" ? byWidth : p.fitMode === "page" ? Math.min(byWidth, byHeight) : p.zoom;
  return Math.max(MIN_SCALE, scale);
}

export interface PageDims {
  width: number;
  height: number;
}

/**
 * Página de referência estável para os modos de ajuste (não depende da página atual, para não
 * re-escalar o documento ao rolar entre páginas de tamanhos diferentes):
 * - largura: a página mais larga (já considerando a rotação);
 * - página: a que mais limita a escala, i.e. a de maior max(w / larguraÚtil, h / alturaÚtil).
 */
export function referenceSize<T extends PageDims>(
  sizes: readonly T[],
  fitMode: FitMode,
  rotation: Rotation,
  container: { containerWidth: number; containerHeight: number },
): T | undefined {
  if (sizes.length === 0) return undefined;
  if (fitMode === "custom") return sizes[0];
  const sideways = rotation % 180 !== 0;
  const availW = Math.max(1, container.containerWidth - PADDING);
  const availH = Math.max(1, container.containerHeight - PADDING);
  const weight = (s: T) => {
    const w = sideways ? s.height : s.width;
    const h = sideways ? s.width : s.height;
    return fitMode === "width" ? w : Math.max(w / availW, h / availH);
  };
  let best = sizes[0];
  for (const s of sizes) if (weight(s) > weight(best)) best = s;
  return best;
}

export function nextZoom(current: number, dir: 1 | -1): number {
  if (dir === 1) return ZOOM_STEPS.find((s) => s > current + 1e-6) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1];
  return [...ZOOM_STEPS].reverse().find((s) => s < current - 1e-6) ?? ZOOM_STEPS[0];
}

export function rotate(r: Rotation, dir: 1 | -1): Rotation {
  return ((((r + dir * 90) % 360) + 360) % 360) as Rotation;
}
