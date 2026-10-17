import { dashboardHref, findStatusFilter } from "../status-filter";
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
    expect(ids("rascunhos")).toEqual(["draft-available", "draft-sold"]);
    expect(ids("arquivados")).toEqual(["archived-sold"]);
    expect(ids("publicados")).toEqual([
      "published-available",
      "published-reserved",
      "published-sold",
    ]);
  });

  it("filters availability among published listings only", () => {
    expect(ids("disponiveis")).toEqual(["published-available"]);
    expect(ids("reservados")).toEqual(["published-reserved"]);
    expect(ids("vendidos")).toEqual(["published-sold"]);
  });

  it("treats an unknown status as no filter", () => {
    expect(findStatusFilter("qualquer")).toBeNull();
    expect(findStatusFilter(undefined)).toBeNull();
  });

  it("keeps search and status together in links", () => {
    expect(dashboardHref("vendidos", "mesa")).toBe(
      "/admin?status=vendidos&q=mesa",
    );
    expect(dashboardHref(null, "")).toBe("/admin");
  });
});
