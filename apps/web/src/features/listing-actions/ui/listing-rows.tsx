"use client";

import {
  AVAILABILITIES,
  type Availability,
  PUBLICATIONS,
  type Publication,
} from "@closeout/contracts/enums";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Eye, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type AdminListingSummary,
  LISTING_NOTICES,
  listingEditHref,
  listingKeys,
} from "@/entities/listing";
import { api, apiParsed, successFor, withId } from "@/shared/api";
import { AVAILABILITY_LABELS, PUBLICATION_LABELS } from "@/shared/lib/format";
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

const listingsPath = (storeId: string) => `/stores/${storeId}/listings`;

/**
 * Inline publication and availability selects, so marking an item reserved
 * or sold never requires opening the full form.
 */
export function ListingStatusControls({
  storeId,
  listing,
  onStatusChange,
}: {
  storeId: string;
  listing: AdminListingSummary;
  /** Called when the status is changed, so the caller can keep the row in view. */
  onStatusChange?: (id: string) => void;
}) {
  const client = useQueryClient();
  const change = useMutation({
    mutationKey: statusMutationKey(storeId),
    mutationFn: ({ id, patch }: StatusChange) =>
      api("PATCH", `${listingsPath(storeId)}/${id}/status`, patch),
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

  function setStatus(patch: StatusChange["patch"]) {
    if (change.isPending) return;
    onStatusChange?.(listing.id);
    change.mutate({ id: listing.id, title: listing.title, patch });
  }

  return (
    <div className="grid grid-cols-2 gap-3 lg:flex">
      <div className="flex min-w-0 flex-col gap-1 text-xs text-muted lg:w-36">
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
      <div className="flex min-w-0 flex-col gap-1 text-xs text-muted lg:w-36">
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
  );
}

/** Edit, view or preview, duplicate and delete buttons for one listing. */
export function ListingRowActions({
  storeId,
  storeSlug,
  listing,
}: {
  storeId: string;
  storeSlug: string;
  listing: AdminListingSummary;
}) {
  const router = useRouter();
  const base = listingsPath(storeId);
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

  async function copy() {
    const result = await duplicate.mutateAsync();
    if (result.parsed) {
      router.push(listingEditHref(result.data.id, "copied"));
      return;
    }
    notify.success(LISTING_NOTICES.copied.message);
  }

  return (
    <div className="flex flex-wrap gap-1 lg:flex-nowrap lg:justify-end">
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
      <ConfirmDialog
        title={`Duplicar "${listing.title}"?`}
        description="A cópia vira um rascunho com o mesmo texto, preço e vendedores. As fotos não são copiadas."
        confirmLabel="Duplicar anúncio"
        pendingLabel="Duplicando..."
        destructive={false}
        onConfirm={copy}
        trigger={(open) => (
          <button
            type="button"
            onClick={open}
            disabled={duplicate.isPending}
            className="inline-flex size-11 items-center justify-center rounded-full hover:bg-ink/5"
            aria-label={`Duplicar ${listing.title}`}
          >
            <Copy className="size-4" aria-hidden="true" />
          </button>
        )}
      />
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
  );
}
