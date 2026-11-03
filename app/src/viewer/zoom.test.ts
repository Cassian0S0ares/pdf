import { describe, it, expect } from "vitest";
import { PDF_TO_CSS, computeScale, nextZoom, referenceSize, rotate } from "./zoom";

const base = { zoom: 1.5, pageWidth: 612, pageHeight: 792, rotation: 0 as const, containerWidth: 1000, containerHeight: 800 };

describe("computeScale", () => {
  it("custom returns zoom", () => {
    expect(computeScale({ ...base, fitMode: "custom" })).toBe(1.5);
  });
  it("width fits container width minus padding", () => {
    expect(computeScale({ ...base, fitMode: "width" })).toBeCloseTo((1000 - 32) / (612 * PDF_TO_CSS));
  });
  it("page fits the smaller dimension", () => {
    expect(computeScale({ ...base, fitMode: "page" })).toBeCloseTo((800 - 32) / (792 * PDF_TO_CSS));
  });
  it("rotation 90 swaps page dimensions", () => {
    expect(computeScale({ ...base, fitMode: "width", rotation: 90 })).toBeCloseTo((1000 - 32) / (792 * PDF_TO_CSS));
  });
  it("never returns non-positive scale", () => {
    expect(computeScale({ ...base, fitMode: "width", containerWidth: 0 })).toBeGreaterThan(0);
  });
});

describe("nextZoom", () => {
  it("steps up and down through ZOOM_STEPS", () => {
    expect(nextZoom(1, 1)).toBe(1.25);
    expect(nextZoom(1, -1)).toBe(0.75);
  });
  it("snaps from in-between values", () => {
    expect(nextZoom(1.1, 1)).toBe(1.25);
    expect(nextZoom(1.1, -1)).toBe(1);
  });
  it("clamps at the ends", () => {
    expect(nextZoom(4, 1)).toBe(4);
    expect(nextZoom(0.25, -1)).toBe(0.25);
  });
});

describe("rotate", () => {
  it("wraps around", () => {
    expect(rotate(270, 1)).toBe(0);
    expect(rotate(0, -1)).toBe(270);
  });
});

describe("referenceSize", () => {
  const portrait = { width: 612, height: 792 };
  const landscape = { width: 792, height: 612 };
  const tall = { width: 300, height: 1400 };
  const sizes = [portrait, landscape, tall];
  const container = { containerWidth: 1000, containerHeight: 800 };

  it("returns undefined for no pages", () => {
    expect(referenceSize([], "width", 0, container)).toBeUndefined();
  });
  it("width fit uses the widest page, regardless of order", () => {
    expect(referenceSize(sizes, "width", 0, container)).toBe(landscape);
    expect(referenceSize([tall, landscape, portrait], "width", 0, container)).toBe(landscape);
  });
  it("width fit accounts for rotation", () => {
    expect(referenceSize(sizes, "width", 90, container)).toBe(tall);
  });
  it("page fit uses the page that limits the scale the most", () => {
    expect(referenceSize(sizes, "page", 0, container)).toBe(tall);
    expect(referenceSize([portrait, landscape], "page", 0, container)).toBe(portrait);
    // Container muito largo e baixo: a altura limita; o retrato (mais alto) manda.
    expect(referenceSize([landscape, portrait], "page", 0, { containerWidth: 3000, containerHeight: 500 })).toBe(portrait);
    // Container estreito e alto: a largura limita; a paisagem (mais larga) manda.
    expect(referenceSize([portrait, landscape], "page", 0, { containerWidth: 500, containerHeight: 3000 })).toBe(landscape);
  });
  it("custom zoom returns the first page", () => {
    expect(referenceSize(sizes, "custom", 0, container)).toBe(portrait);
  });
});
