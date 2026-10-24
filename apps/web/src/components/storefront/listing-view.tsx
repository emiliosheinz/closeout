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
  joinNames,
} from "@/lib/format";
import { absoluteUrl, itemPath } from "@/lib/site";
import { listingContactUrl } from "@/lib/whatsapp";
import { ContactAction, type SellerContact } from "./contact-action";
import { Gallery } from "./gallery";
import { ListingCard } from "./listing-card";
import { PhotoPlaceholder } from "./photo-placeholder";
import { PriceSticker } from "./price-sticker";
import { ShareButton } from "./share-button";
import { StatusStamp } from "./status-stamp";

/** Item detail of store `storeSlug`, shared by the public page and the admin preview. */
export function ListingView({
  storeSlug,
  listing,
}: {
  storeSlug: string;
  listing: ListingDetail;
}) {
  const url = absoluteUrl(itemPath(storeSlug, listing.slug));
  const contacts: SellerContact[] = listing.canContact
    ? listing.sellers.flatMap((seller) => {
        const href = listingContactUrl(
          seller.whatsappNumber,
          listing.title,
          url,
        );
        return href
          ? [{ name: seller.name, avatarUrl: seller.avatarUrl, href }]
          : [];
      })
    : [];
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
              storeSlug,
              withFilters(DEFAULT_FILTERS, { category: listing.category.slug }),
            )}
            className="text-sm font-medium text-muted underline decoration-ink/20 underline-offset-4 hover:text-ink"
          >
            {listing.category.name}
          </Link>
          <h1 className="mt-1 text-3xl leading-tight font-extrabold tracking-[-0.015em] text-balance break-words sm:text-4xl">
            {listing.title}
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-xl font-bold">
              {formatPrice(listing.priceCents)}
            </span>
            <span className="rounded-full bg-ink/5 px-3 py-1 text-sm font-semibold text-ink-soft">
              {CONDITION_LABELS[listing.condition]}
            </span>
            {listing.availability !== "available" && (
              <span
                className={
                  sold
                    ? "rounded-full bg-stamp/10 px-3 py-1 text-sm font-semibold text-stamp"
                    : "rounded-full bg-hold/10 px-3 py-1 text-sm font-semibold text-hold"
                }
              >
                {AVAILABILITY_LABELS[listing.availability]}
              </span>
            )}
          </p>

          <Sellers sellers={listing.sellers} />

          <div className="mt-6 hidden lg:block">
            <Contact listing={listing} contacts={contacts} />
          </div>

          {listing.description && (
            <div className="mt-8">
              <h2 className="text-base font-bold">Sobre o item</h2>
              <p className="mt-2 max-w-[65ch] leading-relaxed whitespace-pre-line text-ink-soft">
                {listing.description}
              </p>
            </div>
          )}

          {listing.attributes.length > 0 && (
            <div className="mt-8">
              <h2 className="text-base font-bold">Detalhes</h2>
              <dl className="mt-2 divide-y divide-line border-y border-line text-sm">
                {listing.attributes.map((attribute) => (
                  <div
                    key={`${attribute.label}-${attribute.value}`}
                    className="flex justify-between gap-6 py-3"
                  >
                    <dt className="text-muted">{attribute.label}</dt>
                    <dd className="text-right font-semibold">
                      {attribute.value}
                    </dd>
                  </div>
                ))}
              </dl>
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
                <ListingCard storeSlug={storeSlug} listing={related} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        <Contact listing={listing} contacts={contacts} compact />
      </div>
    </>
  );
}

function Sellers({ sellers }: { sellers: ListingDetail["sellers"] }) {
  return (
    <div className="mt-6 flex items-center gap-3">
      <div className="flex -space-x-2">
        {sellers.map((seller) =>
          seller.avatarUrl ? (
            // biome-ignore lint/performance/noImgElement: small pre-sized avatar variant.
            <img
              key={seller.name}
              src={seller.avatarUrl}
              alt=""
              width={40}
              height={40}
              className="size-10 rounded-full object-cover ring-2 ring-paper"
            />
          ) : (
            <span
              key={seller.name}
              aria-hidden="true"
              className="inline-flex size-10 items-center justify-center rounded-full bg-go/10 font-bold text-go ring-2 ring-paper"
            >
              {seller.name.charAt(0).toUpperCase()}
            </span>
          ),
        )}
      </div>
      <p className="text-sm text-muted">
        Vendido por{" "}
        <span className="font-semibold text-ink">
          {joinNames(sellers.map((seller) => seller.name))}
        </span>
      </p>
    </div>
  );
}

function Contact({
  listing,
  contacts,
  compact = false,
}: {
  listing: ListingDetail;
  contacts: SellerContact[];
  compact?: boolean;
}) {
  if (listing.availability === "sold") {
    return (
      <p className="rounded-lg border border-stamp/40 bg-surface px-4 py-3 text-sm font-semibold text-stamp">
        Este item já foi vendido.
      </p>
    );
  }
  if (contacts.length === 0) {
    return (
      <p className="rounded-lg bg-ink/5 px-4 py-3 text-sm text-ink-soft">
        Contato indisponível no momento.
      </p>
    );
  }
  return (
    <div className={compact ? "flex flex-col gap-1.5" : "flex flex-col gap-2"}>
      <ContactAction contacts={contacts} className="w-full" />
      {listing.availability === "reserved" && (
        <p className="text-center text-xs text-muted">
          Está reservado, mas você pode entrar na fila.
        </p>
      )}
    </div>
  );
}
