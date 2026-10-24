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
    expect(href).toBe(`/admin/anuncios/abc?${query}`);
    expect(parse(href.split("?")[1] ?? "")).toBe(notice);
  });

  it("lets copied win when several notice params are present", () => {
    expect(parse("copiado=1&salvo=1")).toBe("copied");
  });

  it("lists every param a notice uses", () => {
    expect([...LISTING_NOTICE_PARAMS].sort()).toEqual([
      "copiado",
      "erro",
      "salvo",
    ]);
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
