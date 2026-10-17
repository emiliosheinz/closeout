import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ListingView } from "@/components/storefront/listing-view";
import { getListing, getStore } from "@/lib/catalog/api";
import { formatPrice } from "@/lib/format";
import { listingPath } from "@/lib/site";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const [listing, store] = await Promise.all([getListing(slug), getStore()]);
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
  const path = listingPath(listing.slug);
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

export default async function ListingPage({ params }: PageProps) {
  const { slug } = await params;
  const listing = await getListing(slug);
  if (!listing) notFound();

  return (
    <main className="mx-auto max-w-6xl px-4 pt-4 pb-32 sm:px-6 lg:px-8 lg:pb-20">
      <Link
        href="/"
        className="inline-flex h-11 items-center gap-2 text-sm font-semibold text-ink-soft hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Voltar ao catálogo
      </Link>
      <ListingView listing={listing} />
    </main>
  );
}
