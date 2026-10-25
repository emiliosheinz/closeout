/** @vitest-environment node */
import type { ListingDetail } from "@/entities/listing";
import { getListing, getStore } from "@/entities/listing/index.server";
import { generateMetadata } from "../store-item-page";

vi.mock("@/entities/listing/index.server", () => ({
  getListing: vi.fn(),
  getStore: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("not-found");
  },
}));

const listing: ListingDetail = {
  slug: "mesa-abc123",
  title: "Mesa de jantar",
  priceCents: 50000,
  condition: "good",
  availability: "available",
  category: { slug: "moveis", name: "Móveis" },
  cover: null,
  description: "Mesa de madeira.",
  attributes: [],
  images: [
    {
      sm: "/media/img-1-sm.webp",
      lg: "/media/img-1-lg.webp",
      og: "/media/img-1-og.jpg",
      width: 1600,
      height: 1200,
    },
  ],
  sellers: [],
  canContact: true,
  publishedAt: null,
  updatedAt: "2026-10-17T12:00:00.000Z",
  related: [],
};

const store = {
  slug: "loja",
  name: "Loja",
  headline: "",
  intro: "",
  locale: "pt-BR",
  currency: "BRL",
  counts: { available: 0, reserved: 0, sold: 0 },
  categories: [],
  sellers: [],
};

describe("item page link preview", () => {
  beforeEach(() => {
    vi.mocked(getListing).mockResolvedValue(listing);
    vi.mocked(getStore).mockResolvedValue(store);
  });

  it("titles the preview with the listing and shows its first photo", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "loja", item: "mesa-abc123" }),
    });

    expect(metadata.openGraph?.title).toBe("Mesa de jantar");
    expect(metadata.openGraph?.images).toEqual([
      {
        url: "/media/img-1-og.jpg",
        width: 1200,
        height: 630,
        alt: "Mesa de jantar",
      },
    ]);
  });

  it("points the canonical and preview URL at the item under its store", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "loja", item: "mesa-abc123" }),
    });

    expect(metadata.alternates?.canonical).toBe(
      "/store/loja/items/mesa-abc123",
    );
    expect(metadata.openGraph?.url).toBe("/store/loja/items/mesa-abc123");
  });
});
