import { DEFAULT_FILTERS } from "@/entities/listing";
import {
  catalogEntries,
  catalogHref,
  parseCatalogParams,
  withFilters,
} from "../params";
import golden from "./fixtures/golden.json";

const CHIP_CATEGORIES = ["cozinha", "moveis", "sala-de-estar"];

describe("storefront URL behavior", () => {
  it.each(
    golden.map((row) => [JSON.stringify(row.params), row]),
  )("reproduces the recorded result for %s", (_, row) => {
    const filters = parseCatalogParams(row.params);
    expect(filters).toEqual(row.filters);
    expect(catalogEntries(filters)).toEqual(row.entries);
    expect(catalogHref("nosso-desapego", filters)).toBe(row.href);
    expect(catalogEntries(filters, ["q", "pagina"])).toEqual(row.searchHidden);
    expect(
      catalogEntries(filters, [
        "estado",
        "disponibilidade",
        "min",
        "max",
        "ordem",
        "pagina",
      ]),
    ).toEqual(row.filterHidden);
    expect(
      catalogHref("nosso-desapego", withFilters(filters, { category: null })),
    ).toBe(row.allChipHref);
    expect(
      CHIP_CATEGORIES.map((category) =>
        catalogHref("nosso-desapego", withFilters(filters, { category })),
      ),
    ).toEqual(row.chipHrefs);
    expect(
      catalogHref(
        "nosso-desapego",
        withFilters(DEFAULT_FILTERS, { category: "cozinha" }),
      ),
    ).toBe(row.listingCategoryHref);
  });
});
