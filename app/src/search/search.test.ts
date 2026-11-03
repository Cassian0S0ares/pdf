import { describe, it, expect } from "vitest";
import { findInPage } from "./search";

describe("findInPage", () => {
  it("finds case-insensitive matches within one item", () => {
    expect(findInPage([{ str: "Olá Mundo" }, { str: "mundo novo" }], "MUNDO", 3)).toEqual([
      { pageIndex: 3, itemIndices: [0] },
      { pageIndex: 3, itemIndices: [1] },
    ]);
  });

  it("finds matches spanning items", () => {
    expect(findInPage([{ str: "Rela" }, { str: "tório" }], "relatório", 0)).toEqual([
      { pageIndex: 0, itemIndices: [0, 1] },
    ]);
  });

  it("treats end-of-line as a space", () => {
    expect(findInPage([{ str: "fim", hasEOL: true }, { str: "linha" }], "fim linha", 0)).toEqual([
      { pageIndex: 0, itemIndices: [0, 1] },
    ]);
  });

  it("empty or blank query returns nothing", () => {
    expect(findInPage([{ str: "abc" }], "  ", 0)).toEqual([]);
  });

  it("finds repeated non-overlapping matches", () => {
    expect(findInPage([{ str: "aaaa" }], "aa", 0)).toHaveLength(2);
  });
});
