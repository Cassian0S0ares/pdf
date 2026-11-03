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

export function nextZoom(current: number, dir: 1 | -1): number {
  if (dir === 1) return ZOOM_STEPS.find((s) => s > current + 1e-6) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1];
  return [...ZOOM_STEPS].reverse().find((s) => s < current - 1e-6) ?? ZOOM_STEPS[0];
}

export function rotate(r: Rotation, dir: 1 | -1): Rotation {
  return ((((r + dir * 90) % 360) + 360) % 360) as Rotation;
}
