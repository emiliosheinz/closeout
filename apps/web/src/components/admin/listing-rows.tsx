"use client";

import { Copy, Eye, ImageOff, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/admin/client-api";
import type { AdminListingSummary } from "@/lib/admin/types";
import {
  AVAILABILITIES,
  type Availability,
  type Publication,
} from "@/lib/catalog/types";
import {
  AVAILABILITY_LABELS,
  formatPrice,
  PUBLICATION_LABELS,
} from "@/lib/format";
import { listingPath } from "@/lib/site";
import { ConfirmDialog } from "./confirm-dialog";

const PUBLICATIONS: Publication[] = ["draft", "published", "archived"];
const selectClass =
  "h-11 w-full rounded-md border border-line bg-surface px-2 text-sm font-medium text-ink";

/**
 * Listing table with inline status changes, so marking an item reserved or
 * sold never requires opening the full form.
 */
export function ListingRows({
  storeId,
  listings,
}: {
  storeId: string;
  listings: AdminListingSummary[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);
  const base = `/stores/${storeId}/listings`;

  async function run(action: () => Promise<unknown>, success: string) {
    setMessage(null);
    try {
      await action();
      setMessage({ text: success, error: false });
      router.refresh();
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : "Algo deu errado.",
        error: true,
      });
    }
  }

  async function duplicate(listing: AdminListingSummary) {
    try {
      const copy = await api<{ id: string }>(
        "POST",
        `${base}/${listing.id}/duplicate`,
      );
      router.push(`/admin/anuncios/${copy.id}?copiado=1`);
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : "Algo deu errado.",
        error: true,
      });
    }
  }

  return (
    <div>
      <p
        role="status"
        aria-live="polite"
        className={
          message?.error
            ? "mb-3 text-sm font-medium text-stamp"
            : "mb-3 text-sm font-medium text-go"
        }
      >
        {message?.text}
      </p>
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {listings.map((listing) => (
          <li
            key={listing.id}
            className="grid grid-cols-[4rem_1fr] gap-x-4 gap-y-3 p-4 md:grid-cols-[4rem_1fr_auto_auto] md:items-center"
            data-testid="admin-listing-row"
          >
            <div className="row-span-2 size-16 overflow-hidden rounded-md bg-paper md:row-span-1">
              {listing.coverUrl ? (
                // biome-ignore lint/performance/noImgElement: small pre-sized variant.
                <img
                  src={listing.coverUrl}
                  alt=""
                  width={64}
                  height={64}
                  className="size-full object-cover"
                />
              ) : (
                <span
                  className="flex size-full items-center justify-center text-muted"
                  title="Sem fotos"
                >
                  <ImageOff className="size-5" aria-hidden="true" />
                </span>
              )}
            </div>
            <div className="min-w-0">
              <Link
                href={`/admin/anuncios/${listing.id}`}
                className="font-semibold hover:underline"
              >
                {listing.title}
              </Link>
              <p className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-muted">
                <span className="font-semibold text-ink-soft">
                  {formatPrice(listing.priceCents)}
                </span>
                <span>
                  {listing.category.name}, por {listing.seller.displayName}
                </span>
              </p>
            </div>
            <div className="col-span-2 grid grid-cols-2 gap-3 md:col-span-1 md:flex">
              <label className="flex min-w-0 flex-col gap-1 text-xs text-muted md:w-36">
                Publicação
                <select
                  className={selectClass}
                  value={listing.publication}
                  onChange={(event) =>
                    run(
                      () =>
                        api("PATCH", `${base}/${listing.id}/status`, {
                          publication: event.target.value,
                        }),
                      `"${listing.title}" agora está ${PUBLICATION_LABELS[event.target.value as Publication].toLowerCase()}.`,
                    )
                  }
                >
                  {PUBLICATIONS.map((p) => (
                    <option key={p} value={p}>
                      {PUBLICATION_LABELS[p]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-w-0 flex-col gap-1 text-xs text-muted md:w-36">
                Disponibilidade
                <select
                  className={selectClass}
                  value={listing.availability}
                  onChange={(event) =>
                    run(
                      () =>
                        api("PATCH", `${base}/${listing.id}/status`, {
                          availability: event.target.value,
                        }),
                      `"${listing.title}" marcado como ${AVAILABILITY_LABELS[event.target.value as Availability].toLowerCase()}.`,
                    )
                  }
                >
                  {AVAILABILITIES.map((a) => (
                    <option key={a} value={a}>
                      {AVAILABILITY_LABELS[a]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="col-span-2 flex flex-wrap gap-1 md:col-span-1 md:justify-end">
              <Link
                href={`/admin/anuncios/${listing.id}`}
                className="inline-flex size-10 items-center justify-center rounded-full hover:bg-ink/5"
                aria-label={`Editar ${listing.title}`}
              >
                <Pencil className="size-4" aria-hidden="true" />
              </Link>
              <a
                href={
                  listing.publication === "published"
                    ? listingPath(listing.slug)
                    : `/admin/anuncios/${listing.id}/previa`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex size-10 items-center justify-center rounded-full hover:bg-ink/5"
                aria-label={
                  listing.publication === "published"
                    ? `Ver ${listing.title} na loja`
                    : `Pré-visualizar ${listing.title}`
                }
              >
                <Eye className="size-4" aria-hidden="true" />
              </a>
              <button
                type="button"
                onClick={() => duplicate(listing)}
                className="inline-flex size-10 items-center justify-center rounded-full hover:bg-ink/5"
                aria-label={`Duplicar ${listing.title}`}
              >
                <Copy className="size-4" aria-hidden="true" />
              </button>
              <ConfirmDialog
                title={`Excluir "${listing.title}"?`}
                description="O anúncio e as fotos são apagados de vez, e o link compartilhado deixa de funcionar. Para só tirar da loja, mude a publicação para Arquivado."
                confirmLabel="Excluir anúncio"
                onConfirm={async () => {
                  await api("DELETE", `${base}/${listing.id}`);
                  setMessage({
                    text: `"${listing.title}" foi excluído.`,
                    error: false,
                  });
                  router.refresh();
                }}
                trigger={(open) => (
                  <button
                    type="button"
                    onClick={open}
                    className="inline-flex size-10 items-center justify-center rounded-full text-stamp hover:bg-stamp/10"
                    aria-label={`Excluir ${listing.title}`}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                )}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
