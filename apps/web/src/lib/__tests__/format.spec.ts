import { formatPrice, formatStickerPrice } from "../format";

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
