import { findStatusFilter, tabCounts } from "../status-filter";
import type { AdminListingSummary } from "../types";

const listing = (
  publication: AdminListingSummary["publication"],
  availability: AdminListingSummary["availability"],
): AdminListingSummary => ({
  id: `${publication}-${availability}`,
  slug: "x",
  title: "x",
  priceCents: null,
  condition: "good",
  availability,
  publication,
  category: { id: "c", name: "Móveis" },
  sellers: [{ id: "s", displayName: "Ana" }],
  coverUrl: null,
  imageCount: 0,
  updatedAt: "2026-10-17T12:00:00.000Z",
});

const all = [
  listing("draft", "available"),
  listing("draft", "sold"),
  listing("published", "available"),
  listing("published", "reserved"),
  listing("published", "sold"),
  listing("archived", "sold"),
];

const ids = (slug: string) => {
  const filter = findStatusFilter(slug);
  return filter ? all.filter(filter.matches).map((l) => l.id) : null;
};

describe("dashboard status filters", () => {
  it("filters drafts and archived listings by publication", () => {
    expect(ids("draft")).toEqual(["draft-available", "draft-sold"]);
    expect(ids("archived")).toEqual(["archived-sold"]);
    expect(ids("published")).toEqual([
      "published-available",
      "published-reserved",
      "published-sold",
    ]);
  });

  it("filters availability among published listings only", () => {
    expect(ids("available")).toEqual(["published-available"]);
    expect(ids("reserved")).toEqual(["published-reserved"]);
    expect(ids("sold")).toEqual(["published-sold"]);
  });

  it("treats an unknown status as no filter", () => {
    expect(findStatusFilter("qualquer")).toBeNull();
    expect(findStatusFilter(undefined)).toBeNull();
  });
});

describe("tab counts", () => {
  it("counts the listings each tab shows", () => {
    expect(tabCounts(all)).toEqual({
      published: 3,
      available: 1,
      reserved: 1,
      sold: 1,
      draft: 2,
      archived: 1,
    });
  });

  it("is all zeros without listings", () => {
    expect(Object.values(tabCounts([]))).toEqual([0, 0, 0, 0, 0, 0]);
  });
});
