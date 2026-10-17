import {
  canContact,
  canPublish,
  canRemovePhoto,
  isPubliclyVisible,
} from "./listing-rules";

describe("listing rules", () => {
  it("exposes only published listings publicly", () => {
    expect(isPubliclyVisible({ publication: "published" })).toBe(true);
    expect(isPubliclyVisible({ publication: "draft" })).toBe(false);
    expect(isPubliclyVisible({ publication: "archived" })).toBe(false);
  });

  it("allows contact for published available and reserved items with a reachable seller", () => {
    const seller = { whatsappNumber: "5511999998888" };
    const published = { publication: "published" } as const;
    expect(
      canContact({ ...published, availability: "available" }, seller),
    ).toBe(true);
    expect(canContact({ ...published, availability: "reserved" }, seller)).toBe(
      true,
    );
    expect(canContact({ ...published, availability: "sold" }, seller)).toBe(
      false,
    );
    expect(
      canContact(
        { ...published, availability: "available" },
        { whatsappNumber: null },
      ),
    ).toBe(false);
    expect(
      canContact({ publication: "draft", availability: "available" }, seller),
    ).toBe(false);
  });

  it("requires at least one photo to publish", () => {
    expect(canPublish(0)).toBe(false);
    expect(canPublish(1)).toBe(true);
  });

  it("keeps the last photo of a published listing", () => {
    expect(canRemovePhoto({ publication: "published" }, 1)).toBe(false);
    expect(canRemovePhoto({ publication: "published" }, 2)).toBe(true);
    expect(canRemovePhoto({ publication: "draft" }, 1)).toBe(true);
  });
});
