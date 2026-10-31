import {
  canContact,
  canEditSale,
  canPublish,
  canRemovePhoto,
  canSetSellers,
  isPubliclyVisible,
  saleAfterFullUpdate,
  saleTransition,
  sellersForNewListing,
} from "./listing-rules";

describe("listing rules", () => {
  it("exposes only published listings publicly", () => {
    expect(isPubliclyVisible({ publication: "published" })).toBe(true);
    expect(isPubliclyVisible({ publication: "draft" })).toBe(false);
    expect(isPubliclyVisible({ publication: "archived" })).toBe(false);
  });

  it("allows contact for published available and reserved items with a reachable seller", () => {
    const sellers = [{ whatsappNumber: "5511999998888" }];
    const published = { publication: "published" } as const;
    expect(
      canContact({ ...published, availability: "available" }, sellers),
    ).toBe(true);
    expect(
      canContact({ ...published, availability: "reserved" }, sellers),
    ).toBe(true);
    expect(canContact({ ...published, availability: "sold" }, sellers)).toBe(
      false,
    );
    expect(
      canContact({ ...published, availability: "available" }, [
        { whatsappNumber: null },
      ]),
    ).toBe(false);
    expect(
      canContact({ publication: "draft", availability: "available" }, sellers),
    ).toBe(false);
  });

  it("allows contact when any one of several sellers is reachable", () => {
    const listing = {
      publication: "published",
      availability: "available",
    } as const;
    expect(
      canContact(listing, [
        { whatsappNumber: null },
        { whatsappNumber: "5521977771234" },
      ]),
    ).toBe(true);
    expect(
      canContact(listing, [{ whatsappNumber: null }, { whatsappNumber: null }]),
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

describe("listing assignment", () => {
  const actor = (role: "owner" | "admin" | "seller") => ({
    role,
    sellerId: "own",
  });

  it.each([
    ["owner", ["a", "b"], ["a", "b"]],
    ["admin", ["a"], ["a"]],
    ["owner", [], null],
    ["admin", undefined, null],
    ["seller", ["a", "b"], ["own"]],
    ["seller", [], ["own"]],
    ["seller", undefined, ["own"]],
  ] as const)("an %s submitting %j creates a listing sold by %j", (role, submitted, expected) => {
    expect(
      sellersForNewListing(actor(role), submitted && [...submitted]),
    ).toEqual(expected);
  });

  it.each([
    ["owner", ["own"], ["a", "b"], true],
    ["admin", ["own"], ["a"], true],
    ["seller", ["own", "a"], undefined, true],
    ["seller", ["own", "a"], ["own", "a"], true],
    ["seller", ["own", "a"], ["a", "own"], true],
    ["seller", ["own", "a"], ["own"], false],
    ["seller", ["own"], ["own", "a"], false],
    ["seller", ["own"], ["a"], false],
    ["seller", ["own", "a"], ["own", "b"], false],
  ] as const)("an %s editing sellers %j to %j is allowed: %s", (role, current, submitted, allowed) => {
    expect(
      canSetSellers(actor(role), [...current], submitted && [...submitted]),
    ).toBe(allowed);
  });
});

describe("sale transition", () => {
  it("enters a held state with the buyer's sale, unpaid by default", () => {
    expect(
      saleTransition("available", { availability: "reserved", hasBuyer: true }),
    ).toEqual({
      outcome: "enter",
      sale: { agreedPriceCents: null, paid: false, notes: null },
    });
  });

  it("enters a held state without a buyer and records no sale", () => {
    expect(
      saleTransition("available", {
        availability: "reserved",
        hasBuyer: false,
      }),
    ).toEqual({ outcome: "enter", sale: null });
  });

  it("keeps the given values when a sold listing goes back to reserved", () => {
    expect(
      saleTransition("sold", {
        availability: "reserved",
        hasBuyer: true,
        agreedPriceCents: 7000,
        paid: true,
        notes: "x",
      }),
    ).toEqual({
      outcome: "enter",
      sale: { agreedPriceCents: 7000, paid: true, notes: "x" },
    });
  });

  it("releases a held listing back to available", () => {
    expect(
      saleTransition("reserved", {
        availability: "available",
        hasBuyer: false,
      }),
    ).toEqual({ outcome: "release" });
  });

  it("keeps the sale when the availability is repeated or not sent", () => {
    expect(
      saleTransition("reserved", { availability: "reserved", hasBuyer: false }),
    ).toEqual({ outcome: "keep" });
    expect(saleTransition("sold", { hasBuyer: false })).toEqual({
      outcome: "keep",
    });
    expect(
      saleTransition("available", {
        availability: "available",
        hasBuyer: false,
      }),
    ).toEqual({ outcome: "keep" });
  });

  it("reports a stale request when a buyer is sent for the state already held", () => {
    expect(
      saleTransition("reserved", { availability: "reserved", hasBuyer: true }),
    ).toEqual({ outcome: "stale" });
  });

  it("refuses sale fields on a return to available", () => {
    expect(
      saleTransition("reserved", {
        availability: "available",
        hasBuyer: true,
        paid: true,
      }),
    ).toEqual({ outcome: "refuse" });
    expect(
      saleTransition("available", {
        availability: "available",
        hasBuyer: true,
      }),
    ).toEqual({ outcome: "refuse" });
  });

  it("refuses sale fields without a buyer", () => {
    expect(
      saleTransition("available", {
        availability: "reserved",
        hasBuyer: false,
        agreedPriceCents: 1000,
      }),
    ).toEqual({ outcome: "refuse" });
    expect(saleTransition("reserved", { hasBuyer: false, notes: "x" })).toEqual(
      { outcome: "refuse" },
    );
  });
});

describe("sale edit", () => {
  it("reports an available listing as changed", () => {
    expect(canEditSale("available", false, true)).toBe("stale");
  });

  it("refuses an edit that leaves a held listing without a buyer", () => {
    expect(canEditSale("sold", false, false)).toBe("refuse");
  });

  it("allows an edit on a held listing with a buyer, current or new", () => {
    expect(canEditSale("reserved", true, false)).toBe("ok");
    expect(canEditSale("sold", false, true)).toBe("ok");
  });
});

describe("sale after a full update", () => {
  it("clears the sale when the listing goes back to available", () => {
    expect(saleAfterFullUpdate("reserved", "available")).toBe("release");
  });

  it("leaves the sale alone otherwise", () => {
    expect(saleAfterFullUpdate("reserved", undefined)).toBe("keep");
    expect(saleAfterFullUpdate("available", "available")).toBe("keep");
    expect(saleAfterFullUpdate("available", "reserved")).toBe("keep");
    expect(saleAfterFullUpdate("reserved", "sold")).toBe("keep");
  });
});
