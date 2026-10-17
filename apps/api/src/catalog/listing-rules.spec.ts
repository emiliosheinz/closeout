import {
  canContact,
  canPublish,
  isListedByDefault,
  isPubliclyVisible,
} from "./listing-rules";

describe("listing rules", () => {
  it("exposes only published listings publicly", () => {
    expect(isPubliclyVisible({ publication: "published" })).toBe(true);
    expect(isPubliclyVisible({ publication: "draft" })).toBe(false);
    expect(isPubliclyVisible({ publication: "archived" })).toBe(false);
  });

  it("keeps sold listings out of the default catalog view", () => {
    expect(
      isListedByDefault({ publication: "published", availability: "reserved" }),
    ).toBe(true);
    expect(
      isListedByDefault({ publication: "published", availability: "sold" }),
    ).toBe(false);
    expect(
      isListedByDefault({ publication: "draft", availability: "available" }),
    ).toBe(false);
  });

  it("allows contact for available and reserved items with a reachable seller", () => {
    const seller = { whatsappNumber: "5511999998888" };
    expect(canContact({ availability: "available" }, seller)).toBe(true);
    expect(canContact({ availability: "reserved" }, seller)).toBe(true);
    expect(canContact({ availability: "sold" }, seller)).toBe(false);
    expect(
      canContact({ availability: "available" }, { whatsappNumber: null }),
    ).toBe(false);
  });

  it("requires at least one photo to publish", () => {
    expect(canPublish(0)).toBe(false);
    expect(canPublish(1)).toBe(true);
  });
});
