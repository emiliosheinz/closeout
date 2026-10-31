import {
  LISTING_NOTICE_PARAMS,
  listingEditHref,
  parseListingNotice,
} from "../notice";

const parse = (query: string) => parseListingNotice(new URLSearchParams(query));

describe("listing notice", () => {
  it.each([
    ["saved", "notice=saved"],
    ["published", "notice=published"],
    ["copied", "notice=copied"],
    ["upload-failed", "notice=upload-failed"],
  ] as const)("builds a href for %s that parses back", (notice, query) => {
    const href = listingEditHref("abc", notice);
    expect(href).toBe(`/admin/listings/abc?${query}`);
    const search = new URLSearchParams(href.split("?")[1]);
    expect(parseListingNotice(search)).toBe(notice);
    // Clearing the notice from the URL must reach every param it travels in.
    for (const name of LISTING_NOTICE_PARAMS) search.delete(name);
    expect(parseListingNotice(search)).toBeUndefined();
  });

  it.each([
    "",
    "notice=x",
    "notice=toString",
    "salvo=1",
    "salvo=publicado",
    "copiado=1",
    "erro=envio",
    "q=1",
  ])("reads %j as no notice", (query) => {
    expect(parse(query)).toBeUndefined();
  });
});
