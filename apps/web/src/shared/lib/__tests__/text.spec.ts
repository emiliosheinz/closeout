import { compareText, matchesSearch } from "../text";

describe("search", () => {
  it("matches ignoring case and accents", () => {
    expect(matchesSearch("Café da manhã", "cafe")).toBe(true);
    expect(matchesSearch("José", "JOSE")).toBe(true);
    expect(matchesSearch("cafe", "Café")).toBe(true);
  });

  it("matches inside the text and rejects other text", () => {
    expect(matchesSearch("ana@loja.com", "ana@")).toBe(true);
    expect(matchesSearch("Mesa", "cadeira")).toBe(false);
    expect(matchesSearch("Mesa de jantar", "jantar")).toBe(true);
  });
});

describe("collation", () => {
  it("sorts accented letters with their base letter", () => {
    expect(["Banco", "Árvore", "Zebra"].sort(compareText)).toEqual([
      "Árvore",
      "Banco",
      "Zebra",
    ]);
  });
});
