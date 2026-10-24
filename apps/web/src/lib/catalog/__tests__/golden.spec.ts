import { catalogEntries, catalogHref, parseCatalogParams } from "../params";
import golden from "./fixtures/golden.json";

describe("storefront URL behavior", () => {
  it.each(
    golden.map((row) => [JSON.stringify(row.params), row]),
  )("reproduces the recorded result for %s", (_, row) => {
    const filters = parseCatalogParams(row.params);
    expect(filters).toEqual(row.filters);
    expect(catalogEntries(filters)).toEqual(row.entries);
    expect(catalogHref("nosso-desapego", filters)).toBe(row.href);
  });
});
