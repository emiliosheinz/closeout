import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getListing, getStore } from "@/entities/listing/index.server";
import { BackToCatalog } from "@/features/catalog-filter";
import { formatPrice } from "@/shared/lib/format";
import { itemPath } from "@/shared/lib/site";
import { ListingView } from "@/widgets/listing-view";

interface PageProps {
  params: Promise<{ slug: string; item: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug, item } = await params;
  const [listing, store] = await Promise.all([
    getListing(slug, item),
    getStore(slug),
  ]);
  if (!listing || !store) return { title: "Item não encontrado" };

  const status =
    listing.availability === "sold"
      ? "Vendido. "
      : listing.availability === "reserved"
        ? "Reservado. "
        : "";
  const description =
    `${status}${formatPrice(listing.priceCents)}. ${listing.description}`
      .replace(/\s+/g, " ")
      .slice(0, 180);
  const cover = listing.images[0];
  const path = itemPath(slug, listing.slug);
  return {
    title: `${listing.title} | ${store.name}`,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      locale: "pt_BR",
      siteName: store.name,
      title: listing.title,
      description,
      url: path,
      images: cover
        ? [{ url: cover.og, width: 1200, height: 630, alt: listing.title }]
        : undefined,
    },
    twitter: {
      card: cover ? "summary_large_image" : "summary",
      title: listing.title,
      description,
    },
  };
}

export async function ListingPage({ params }: PageProps) {
  const { slug, item } = await params;
  const listing = await getListing(slug, item);
  if (!listing) notFound();

  return (
    <main className="mx-auto max-w-6xl px-4 pt-4 pb-32 sm:px-6 lg:px-8 lg:pb-20">
      <BackToCatalog storeSlug={slug} />
      <ListingView storeSlug={slug} listing={listing} />
    </main>
  );
}
