import {
  CONDITION_LABELS,
  formatDate,
  formatPrice,
  formatShortDate,
  formatStickerPrice,
  pluralize,
} from "../format";

describe("formatPrice", () => {
  it("formats cents as Brazilian reais", () => {
    expect(formatPrice(123450)).toBe("R$ 1.234,50");
    expect(formatPrice(990)).toBe("R$ 9,90");
  });

  it("never shows R$ 0 for a missing price", () => {
    expect(formatPrice(null)).toBe("Preço a combinar");
    expect(formatPrice(0)).toBe("Grátis");
  });
});

describe("formatStickerPrice", () => {
  it("drops cents for whole amounts and keeps them otherwise", () => {
    expect(formatStickerPrice(120000)).toBe("R$ 1.200");
    expect(formatStickerPrice(1990)).toBe("R$ 19,90");
    expect(formatStickerPrice(null)).toBe("A combinar");
  });
});

describe("labels", () => {
  it("names conditions in natural Portuguese", () => {
    expect(CONDITION_LABELS).toEqual({
      new: "Novo",
      like_new: "Como novo",
      good: "Bom estado",
      fair: "Com marcas de uso",
      for_parts: "Para conserto ou peças",
    });
  });

  it("pluralizes counts with Brazilian digit grouping", () => {
    expect(pluralize(0, "item", "itens")).toBe("0 itens");
    expect(pluralize(1, "item", "itens")).toBe("1 item");
    expect(pluralize(1500, "item", "itens")).toBe("1.500 itens");
  });
});

describe("formatDate", () => {
  it("writes the Brazilian calendar day in full", () => {
    expect(formatDate("2026-10-30T15:00:00.000Z")).toBe(
      "30 de outubro de 2026",
    );
  });

  it("uses the Brazilian day even when UTC already turned the page", () => {
    expect(formatDate("2026-10-31T01:00:00.000Z")).toBe(
      "30 de outubro de 2026",
    );
  });
});

describe("formatShortDate", () => {
  it("writes the Brazilian calendar day as day/month/year", () => {
    expect(formatShortDate("2026-10-30T15:00:00.000Z")).toBe("30/10/2026");
  });

  it("uses the Brazilian day even when UTC already turned the page", () => {
    expect(formatShortDate("2026-10-31T01:00:00.000Z")).toBe("30/10/2026");
  });
});
