"use client";

import {
  AVAILABILITIES,
  type Availability,
  PUBLICATIONS,
  type Publication,
} from "@closeout/contracts/enums";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Eye, ImageOff, Pencil, PhoneOff, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type AdminListingSummary,
  LISTING_NOTICES,
  listingEditHref,
  listingKeys,
} from "@/entities/listing";
import { api, apiParsed, successFor, withId } from "@/shared/api";
import {
  AVAILABILITY_LABELS,
  formatPrice,
  joinNames,
  PUBLICATION_LABELS,
} from "@/shared/lib/format";
import { itemPath } from "@/shared/lib/site";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { notify } from "@/shared/ui/sonner";
import {
  applyChange,
  type StatusChange,
  statusMessage,
  statusMutationKey,
} from "../model/status-change";

const selectTriggerClass =
  "h-11 border-line bg-surface px-2 text-sm font-medium text-ink shadow-none";

/**
 * Listing table with inline status changes, so marking an item reserved or
 * sold never requires opening the full form.
 */
export function ListingRows({
  storeId,
  storeSlug,
  listings,
  unreachableSellerIds = [],
  onStatusChange,
}: {
  storeId: string;
  storeSlug: string;
  listings: AdminListingSummary[];
  /** Sellers without a WhatsApp number; an item none of whose sellers has one shows no contact button. */
  unreachableSellerIds?: string[];
  /** Called when a row's status is changed, so the caller can keep the row in view. */
  onStatusChange?: (id: string) => void;
}) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
      {listings.map((listing) => (
        <ListingRow
          key={listing.id}
          storeId={storeId}
          storeSlug={storeSlug}
          listing={listing}
          unreachable={listing.sellers.every((seller) =>
            unreachableSellerIds.includes(seller.id),
          )}
          onStatusChange={onStatusChange}
        />
      ))}
    </ul>
  );
}

function ListingRow({
  storeId,
  storeSlug,
  listing,
  unreachable,
  onStatusChange,
}: {
  storeId: string;
  storeSlug: string;
  listing: AdminListingSummary;
  unreachable: boolean;
  onStatusChange?: (id: string) => void;
}) {
  const router = useRouter();
  const client = useQueryClient();
  const base = `/stores/${storeId}/listings`;
  const change = useMutation({
    mutationKey: statusMutationKey(storeId),
    mutationFn: ({ id, patch }: StatusChange) =>
      api("PATCH", `${base}/${id}/status`, patch),
    onMutate: () =>
      client.cancelQueries({ queryKey: listingKeys.list(storeId) }),
    onSuccess: async (_data, applied) => {
      await client.cancelQueries({ queryKey: listingKeys.list(storeId) });
      client.setQueryData(
        listingKeys.list(storeId),
        (old: { items: AdminListingSummary[] } | undefined) =>
          old && { ...old, items: applyChange(old.items, applied) },
      );
    },
    onSettled: () => {
      // The mutation settling now still counts as running.
      if (client.isMutating({ mutationKey: statusMutationKey(storeId) }) > 1) {
        return;
      }
      client.invalidateQueries({ queryKey: listingKeys.all(storeId) });
    },
    meta: { success: successFor<StatusChange>(statusMessage) },
  });
  const duplicate = useMutation({
    mutationFn: () =>
      apiParsed("POST", `${base}/${listing.id}/duplicate`, undefined, withId),
    meta: { invalidates: [listingKeys.list(storeId)] },
  });
  const remove = useMutation({
    mutationFn: () => api("DELETE", `${base}/${listing.id}`),
    meta: {
      success: `"${listing.title}" foi excluído.`,
      invalidates: [listingKeys.all(storeId)],
    },
  });

  function setStatus(patch: StatusChange["patch"]) {
    if (change.isPending) return;
    onStatusChange?.(listing.id);
    change.mutate({ id: listing.id, title: listing.title, patch });
  }

  function copy() {
    duplicate.mutate(undefined, {
      onSuccess: (result) => {
        if (result.parsed) {
          router.push(listingEditHref(result.data.id, "copied"));
          return;
        }
        notify.success(LISTING_NOTICES.copied.message);
      },
    });
  }

  return (
    <li
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
            {listing.category.name}, por{" "}
            {joinNames(listing.sellers.map((seller) => seller.displayName))}
          </span>
        </p>
        {listing.publication === "published" &&
          listing.availability !== "sold" &&
          unreachable && (
            <Link
              href="/admin/equipe"
              className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-stamp/10 px-2.5 py-1 text-xs font-semibold text-stamp hover:bg-stamp/15"
              title="Este item aparece na loja sem botão de contato."
            >
              <PhoneOff className="size-3.5" aria-hidden="true" />
              Vendedor sem WhatsApp
            </Link>
          )}
      </div>
      <div className="col-span-2 grid grid-cols-2 gap-3 md:col-span-1 md:flex">
        <div className="flex min-w-0 flex-col gap-1 text-xs text-muted md:w-36">
          <span aria-hidden="true">Publicação</span>
          <Select
            value={listing.publication}
            onValueChange={(next) =>
              setStatus({ publication: next as Publication })
            }
          >
            <SelectTrigger
              aria-label={`Publicação de ${listing.title}`}
              className={selectTriggerClass}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PUBLICATIONS.map((p) => (
                <SelectItem key={p} value={p}>
                  {PUBLICATION_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex min-w-0 flex-col gap-1 text-xs text-muted md:w-36">
          <span aria-hidden="true">Disponibilidade</span>
          <Select
            value={listing.availability}
            onValueChange={(next) =>
              setStatus({ availability: next as Availability })
            }
          >
            <SelectTrigger
              aria-label={`Disponibilidade de ${listing.title}`}
              className={selectTriggerClass}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AVAILABILITIES.map((a) => (
                <SelectItem key={a} value={a}>
                  {AVAILABILITY_LABELS[a]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="col-span-2 flex flex-wrap gap-1 md:col-span-1 md:justify-end">
        <Link
          href={`/admin/anuncios/${listing.id}`}
          className="inline-flex size-11 items-center justify-center rounded-full hover:bg-ink/5"
          aria-label={`Editar ${listing.title}`}
        >
          <Pencil className="size-4" aria-hidden="true" />
        </Link>
        <a
          href={
            listing.publication === "published"
              ? itemPath(storeSlug, listing.slug)
              : `/admin/anuncios/${listing.id}/previa`
          }
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex size-11 items-center justify-center rounded-full hover:bg-ink/5"
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
          onClick={copy}
          disabled={duplicate.isPending}
          className="inline-flex size-11 items-center justify-center rounded-full hover:bg-ink/5"
          aria-label={`Duplicar ${listing.title}`}
        >
          <Copy className="size-4" aria-hidden="true" />
        </button>
        <ConfirmDialog
          title={`Excluir "${listing.title}"?`}
          description="O anúncio e as fotos são apagados de vez, e o link compartilhado deixa de funcionar. Para só tirar da loja, mude a publicação para Arquivado."
          confirmLabel="Excluir anúncio"
          pendingLabel="Excluindo..."
          onSuccess={() => document.getElementById("listings-heading")?.focus()}
          onConfirm={() => remove.mutateAsync()}
          trigger={(open) => (
            <button
              type="button"
              onClick={open}
              className="inline-flex size-11 items-center justify-center rounded-full text-stamp hover:bg-stamp/10"
              aria-label={`Excluir ${listing.title}`}
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          )}
        />
      </div>
    </li>
  );
}
