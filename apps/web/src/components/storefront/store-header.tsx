import { MessageCircle } from "lucide-react";
import Link from "next/link";
import type { StoreInfo } from "@/lib/catalog/types";
import { pluralize } from "@/shared/lib/format";
import { storePath } from "@/shared/lib/site";
import { sellerContactUrl } from "@/shared/lib/whatsapp";

/**
 * Full introduction on the plain catalog; a one-line header once the visitor
 * is searching, filtering or paging, so results start near the top.
 */
export function StoreHeader({
  store,
  compact = false,
}: {
  store: StoreInfo;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <header className="mx-auto max-w-6xl px-4 pt-5 pb-1 sm:px-6 sm:pt-8 lg:px-8">
        <h1 className="text-lg font-extrabold tracking-[-0.01em]">
          <Link href={storePath(store.slug)} className="hover:underline">
            {store.name}
          </Link>
        </h1>
      </header>
    );
  }
  const { available, reserved } = store.counts;
  const sellers = store.sellers.flatMap((seller) => {
    const href = sellerContactUrl(seller.whatsappNumber, store.name);
    return href ? [{ ...seller, href }] : [];
  });

  return (
    <header className="mx-auto max-w-6xl px-4 pt-8 pb-6 sm:px-6 sm:pt-14 lg:px-8">
      <p className="text-base font-semibold text-ink-soft">{store.name}</p>
      <h1 className="mt-3 max-w-[18ch] text-[2.35rem] leading-[1.02] font-extrabold tracking-[-0.02em] text-balance break-words sm:text-6xl">
        {store.headline || store.name}
      </h1>
      {store.intro && (
        <p className="mt-5 max-w-[62ch] text-[1.05rem] leading-relaxed text-ink-soft">
          {store.intro}
        </p>
      )}
      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted" data-testid="store-counts">
          <strong className="font-semibold text-ink">
            {pluralize(available, "item disponível", "itens disponíveis")}
          </strong>
          {reserved > 0 &&
            ` e ${pluralize(reserved, "reservado", "reservados")}`}
        </p>
        {sellers.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Fale com a gente">
            {sellers.map((seller) => (
              <li key={seller.whatsappNumber}>
                <a
                  href={seller.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-line bg-surface pr-4 pl-1.5 text-sm font-medium hover:border-go/50"
                >
                  {seller.avatarUrl ? (
                    // biome-ignore lint/performance/noImgElement: small pre-sized avatar variant.
                    <img
                      src={seller.avatarUrl}
                      alt=""
                      width={28}
                      height={28}
                      className="size-7 rounded-full object-cover"
                    />
                  ) : (
                    <span className="inline-flex size-7 items-center justify-center rounded-full bg-go/10 text-go">
                      <MessageCircle className="size-4" aria-hidden="true" />
                    </span>
                  )}
                  Falar com {seller.name}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </header>
  );
}
