import Link from "next/link";
import {
  catalogHref,
  DEFAULT_FILTERS,
  withFilters,
} from "@/lib/catalog/params";
import type { ListingDetail } from "@/lib/catalog/types";
import {
  AVAILABILITY_LABELS,
  CONDITION_LABELS,
  formatPrice,
} from "@/lib/format";
import { absoluteUrl, listingPath } from "@/lib/site";
import { listingContactUrl } from "@/lib/whatsapp";
import { ContactButton } from "./contact-button";
import { Gallery } from "./gallery";
import { ListingCard } from "./listing-card";
import { PhotoPlaceholder } from "./photo-placeholder";
import { PriceSticker } from "./price-sticker";
import { ShareButton } from "./share-button";
import { StatusStamp } from "./status-stamp";

/** Item detail, shared by the public page and the admin preview. */
export function ListingView({ listing }: { listing: ListingDetail }) {
  const url = absoluteUrl(listingPath(listing.slug));
  const contactUrl = listing.canContact
    ? listingContactUrl(listing.seller.whatsappNumber, listing.title, url)
    : null;
  const sold = listing.availability === "sold";
  const badges = (
    <>
      <StatusStamp
        availability={listing.availability}
        className="pointer-events-none absolute top-4 right-4 text-xl"
      />
      <PriceSticker
        priceCents={listing.priceCents}
        size="lg"
        className="pointer-events-none absolute bottom-3 left-3 sm:bottom-4 sm:left-4"
        decorative
      />
    </>
  );

  return (
    <>
      <article className="mt-2 lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-12">
        {listing.images.length > 0 ? (
          <Gallery images={listing.images} title={listing.title} sold={sold}>
            {badges}
          </Gallery>
        ) : (
          <div className="relative aspect-[4/5] rounded-xl ring-1 ring-line sm:aspect-[5/4] lg:aspect-[4/5]">
            <div className="size-full overflow-hidden rounded-xl">
              <PhotoPlaceholder />
            </div>
            {badges}
          </div>
        )}

        <div className="mt-6 lg:sticky lg:top-8 lg:mt-0 lg:self-start">
          <Link
            href={catalogHref(
              withFilters(DEFAULT_FILTERS, { category: listing.category.slug }),
            )}
            className="text-sm font-medium text-muted underline decoration-ink/20 underline-offset-4 hover:text-ink"
          >
            {listing.category.name}
          </Link>
          <h1 className="mt-1 text-3xl leading-tight font-extrabold tracking-[-0.015em] text-balance break-words sm:text-4xl">
            {listing.title}
          </h1>
          <p className="mt-2 text-xl font-bold">
            {formatPrice(listing.priceCents)}
          </p>

          <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line text-sm">
            <div className="bg-surface px-4 py-3">
              <dt className="text-muted">Estado</dt>
              <dd className="mt-0.5 font-semibold">
                {CONDITION_LABELS[listing.condition]}
              </dd>
            </div>
            <div className="bg-surface px-4 py-3">
              <dt className="text-muted">Disponibilidade</dt>
              <dd className="mt-0.5 font-semibold">
                {AVAILABILITY_LABELS[listing.availability]}
              </dd>
            </div>
            <div className="bg-surface px-4 py-3">
              <dt className="text-muted">Quem vende</dt>
              <dd className="mt-0.5 font-semibold">{listing.seller.name}</dd>
            </div>
            {listing.attributes.map((attribute) => (
              <div
                key={`${attribute.label}-${attribute.value}`}
                className="bg-surface px-4 py-3"
              >
                <dt className="text-muted">{attribute.label}</dt>
                <dd className="mt-0.5 font-semibold">{attribute.value}</dd>
              </div>
            ))}
            {listing.attributes.length % 2 === 0 && (
              <div className="bg-surface" aria-hidden="true" />
            )}
          </dl>

          <div className="mt-6 hidden lg:block">
            <Contact listing={listing} contactUrl={contactUrl} />
          </div>

          {listing.description && (
            <div className="mt-8">
              <h2 className="text-base font-bold">Sobre o item</h2>
              <p className="mt-2 max-w-[65ch] leading-relaxed whitespace-pre-line text-ink-soft">
                {listing.description}
              </p>
            </div>
          )}

          <div className="mt-8">
            <ShareButton url={url} title={listing.title} />
          </div>
        </div>
      </article>

      {listing.related.length > 0 && (
        <section className="mt-20" aria-labelledby="related-heading">
          <h2 id="related-heading" className="text-2xl font-extrabold">
            {sold
              ? "Esse já foi, mas ainda temos estes"
              : "Outros itens à venda"}
          </h2>
          <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-12 sm:grid-cols-4 sm:gap-x-6">
            {listing.related.map((related) => (
              <li key={related.slug}>
                <ListingCard listing={related} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        <Contact listing={listing} contactUrl={contactUrl} compact />
      </div>
    </>
  );
}

function Contact({
  listing,
  contactUrl,
  compact = false,
}: {
  listing: ListingDetail;
  contactUrl: string | null;
  compact?: boolean;
}) {
  if (listing.availability === "sold") {
    return (
      <p className="rounded-lg border border-stamp/40 bg-surface px-4 py-3 text-sm font-semibold text-stamp">
        Este item já foi vendido.
      </p>
    );
  }
  if (!contactUrl) {
    return (
      <p className="rounded-lg bg-ink/5 px-4 py-3 text-sm text-ink-soft">
        Contato indisponível no momento.
      </p>
    );
  }
  return (
    <div className={compact ? "flex flex-col gap-1.5" : "flex flex-col gap-2"}>
      <ContactButton
        href={contactUrl}
        sellerName={listing.seller.name}
        className="w-full"
      />
      {listing.availability === "reserved" && (
        <p className="text-center text-xs text-muted">
          Está reservado, mas você pode entrar na fila.
        </p>
      )}
    </div>
  );
}
