import { listingSlug } from "./slug";

describe("listingSlug", () => {
  it("transliterates the title and appends a 6 character suffix", () => {
    expect(listingSlug("Sofá retrátil 3 lugares!")).toMatch(
      /^sofa-retratil-3-lugares-[a-z0-9]{6}$/,
    );
  });

  it("produces distinct slugs for the same title", () => {
    expect(listingSlug("Mesa")).not.toBe(listingSlug("Mesa"));
  });

  it("falls back to a generic base when the title has no usable characters", () => {
    expect(listingSlug("???")).toMatch(/^item-[a-z0-9]{6}$/);
  });
});
