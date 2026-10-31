import {
  LISTING_NOTICE_PARAMS,
  listingEditHref,
  parseListingNotice,
} from "../notice";

const parse = (query: string) => parseListingNotice(new URLSearchParams(query));

describe("listing notice", () => {
  it.each([
    ["saved", "salvo=1"],
    ["published", "salvo=publicado"],
    ["copied", "copiado=1"],
    ["upload-failed", "erro=envio"],
  ] as const)("builds a href for %s that parses back", (notice, query) => {
    const href = listingEditHref("abc", notice);
    expect(href).toBe(`/admin/listings/abc?${query}`);
    const search = new URLSearchParams(href.split("?")[1]);
    expect(parseListingNotice(search)).toBe(notice);
    // Clearing the notice from the URL must reach every param it travels in.
    for (const name of LISTING_NOTICE_PARAMS) search.delete(name);
    expect(parseListingNotice(search)).toBeUndefined();
  });

  it("lets copied win when several notice params are present", () => {
    expect(parse("copiado=1&salvo=1")).toBe("copied");
  });

  it.each([
    "",
    "salvo=0",
    "salvo=x",
    "erro=outro",
    "q=1",
  ])("reads %j as no notice", (query) => {
    expect(parse(query)).toBeUndefined();
  });
});
