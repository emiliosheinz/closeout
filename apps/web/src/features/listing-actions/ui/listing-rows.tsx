"use client";

import {
  AVAILABILITIES,
  type Availability,
  PUBLICATIONS,
  type Publication,
} from "@closeout/contracts/enums";
import { useMutation } from "@tanstack/react-query";
import { Copy, Eye, Pencil, Trash2, UserPlus, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { buyerKeys } from "@/entities/buyer";
import {
  type AdminListingSummary,
  LISTING_NOTICES,
  listingEditHref,
  listingKeys,
} from "@/entities/listing";
import { api, apiParsed, withId } from "@/shared/api";
import {
  AVAILABILITY_LABELS,
  formatPrice,
  PAYMENT_LABELS,
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
import { Tooltip } from "@/shared/ui/tooltip";
import type { StatusChange } from "../model/status-change";
import {
  useIsListingChanging,
  useListingChange,
} from "../model/use-listing-change";
import { BuyerDialog } from "./buyer-dialog";

const selectTriggerClass =
  "h-11 border-line bg-surface px-2 text-sm font-medium text-ink shadow-none";

const listingsPath = (storeId: string) => `/stores/${storeId}/listings`;

/**
 * Inline publication and availability selects, so marking an item reserved
 * or sold never requires opening the full form. Reserving or selling asks
 * for the buyer first; releasing an item that has one asks to confirm.
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
  const change = useListingChange(storeId);
  const changing = useIsListingChanging(storeId, listing.id);
  const availabilityRef = useRef<HTMLButtonElement>(null);
  const [selling, setSelling] = useState<"reserved" | "sold" | null>(null);
  const sale = listing.sale;

  function setStatus(patch: StatusChange["patch"], body = patch) {
    if (changing) return Promise.resolve();
    onStatusChange?.(listing.id);
    return change.mutateAsync({
      id: listing.id,
      title: listing.title,
      patch,
      body,
    });
  }

  async function release() {
    await setStatus(
      { availability: "available", sale: null },
      { availability: "available" },
    );
  }

  function chooseAvailability(next: Availability, confirmRelease: () => void) {
    if (changing) return;
    if (next !== "available") {
      onStatusChange?.(listing.id);
      setSelling(next);
      return;
    }
    if (sale) {
      confirmRelease();
      return;
    }
    setStatus({ availability: next, sale: null }, { availability: next }).catch(
      () => {},
    );
  }

  function togglePaid(paid: boolean) {
    if (!sale || changing) return;
    change.mutate({
      id: listing.id,
      title: listing.title,
      patch: { sale: { ...sale, paid } },
      body: { paid },
      route: "sale",
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-2 gap-3 lg:flex">
        <div className="flex min-w-0 flex-col gap-1 text-xs text-muted lg:w-36">
          <span aria-hidden="true">Publicação</span>
          <Select
            value={listing.publication}
            onValueChange={(next) =>
              setStatus({ publication: next as Publication }).catch(() => {})
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
        <ConfirmDialog
          title={`Voltar "${listing.title}" para disponível?`}
          description={
            sale
              ? `${sale.buyer.name} deixa de ser o comprador e o valor combinado, o pagamento e as observações são apagados.`
              : ""
          }
          confirmLabel="Voltar para disponível"
          pendingLabel="Salvando..."
          onConfirm={release}
          trigger={(open) => (
            <div className="flex min-w-0 flex-col gap-1 text-xs text-muted lg:w-36">
              <span aria-hidden="true">Disponibilidade</span>
              <Select
                value={listing.availability}
                onValueChange={(next) =>
                  chooseAvailability(next as Availability, open)
                }
              >
                <SelectTrigger
                  ref={availabilityRef}
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
          )}
        />
      </div>
      {sale && listing.availability !== "available" && (
        <label className="flex min-h-11 w-fit cursor-pointer items-center gap-2 text-sm font-medium text-ink-soft">
          <input
            type="checkbox"
            checked={sale.paid}
            onChange={(event) => togglePaid(event.target.checked)}
            aria-label={`Pago — ${listing.title}`}
            className="size-5 accent-ink"
          />
          {PAYMENT_LABELS.paid}
        </label>
      )}
      {selling && (
        <BuyerDialog
          storeId={storeId}
          listing={listing}
          availability={selling}
          returnFocusTo={availabilityRef}
          onClose={() => setSelling(null)}
        />
      )}
    </div>
  );
}

/**
 * The buyer of a reserved or sold listing, or a note that none was recorded.
 * Meant for the title cell; renders nothing for an available listing.
 */
export function ListingBuyerLine({
  listing,
}: {
  listing: AdminListingSummary;
}) {
  if (listing.availability === "available") return null;
  if (!listing.sale) {
    return <p className="mt-1 text-sm text-muted">Sem comprador</p>;
  }
  const { name } = listing.sale.buyer;
  return (
    <p className="mt-1 flex min-w-0 items-center gap-1.5 text-sm text-ink-soft">
      <UserRound className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
      <span className="min-w-0 max-w-56 truncate" title={name}>
        {name}
      </span>
      {!listing.sale.paid && (
        <span className="shrink-0 rounded-full bg-stamp/10 px-2 py-0.5 text-xs font-semibold text-stamp">
          {PAYMENT_LABELS.unpaid}
        </span>
      )}
    </p>
  );
}

/** What deleting costs when the buyer has not paid: the debt stops counting. */
function unpaidDebtNote({ sale }: AdminListingSummary): string {
  if (!sale || sale.paid) return "";
  const owed =
    sale.agreedPriceCents === null
      ? ""
      : ` (${formatPrice(sale.agreedPriceCents)})`;
  return ` ${sale.buyer.name} ainda não pagou${owed}, e esse valor deixa de contar como dívida.`;
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
  const [editingBuyer, setEditingBuyer] = useState(false);
  const buyerButtonRef = useRef<HTMLButtonElement>(null);
  const changing = useIsListingChanging(storeId, listing.id);
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
      invalidates: [listingKeys.all(storeId), buyerKeys.all(storeId)],
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
      {listing.availability !== "available" && (
        <>
          <Tooltip label={listing.sale ? "Comprador" : "Adicionar comprador"}>
            <button
              ref={buyerButtonRef}
              type="button"
              onClick={() => !changing && setEditingBuyer(true)}
              className="inline-flex size-11 items-center justify-center rounded-full hover:bg-ink/5"
              aria-label={
                listing.sale
                  ? `Comprador de ${listing.title}`
                  : `Adicionar comprador a ${listing.title}`
              }
            >
              {listing.sale ? (
                <UserRound className="size-4" aria-hidden="true" />
              ) : (
                <UserPlus className="size-4" aria-hidden="true" />
              )}
            </button>
          </Tooltip>
          {editingBuyer && (
            <BuyerDialog
              storeId={storeId}
              listing={listing}
              returnFocusTo={buyerButtonRef}
              onClose={() => setEditingBuyer(false)}
            />
          )}
        </>
      )}
      <Tooltip label="Editar">
        <Link
          href={`/admin/listings/${listing.id}`}
          className="inline-flex size-11 items-center justify-center rounded-full hover:bg-ink/5"
          aria-label={`Editar ${listing.title}`}
        >
          <Pencil className="size-4" aria-hidden="true" />
        </Link>
      </Tooltip>
      <Tooltip
        label={
          listing.publication === "published" ? "Ver na loja" : "Pré-visualizar"
        }
      >
        <a
          href={
            listing.publication === "published"
              ? itemPath(storeSlug, listing.slug)
              : `/admin/listings/${listing.id}/preview`
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
      </Tooltip>
      <ConfirmDialog
        title={`Duplicar "${listing.title}"?`}
        description="A cópia vira um rascunho com o mesmo texto, preço e vendedores. As fotos não são copiadas."
        confirmLabel="Duplicar anúncio"
        pendingLabel="Duplicando..."
        destructive={false}
        onConfirm={copy}
        trigger={(open) => (
          <Tooltip label="Duplicar">
            <button
              type="button"
              onClick={open}
              disabled={duplicate.isPending}
              className="inline-flex size-11 items-center justify-center rounded-full hover:bg-ink/5"
              aria-label={`Duplicar ${listing.title}`}
            >
              <Copy className="size-4" aria-hidden="true" />
            </button>
          </Tooltip>
        )}
      />
      <ConfirmDialog
        title={`Excluir "${listing.title}"?`}
        description={`O anúncio e as fotos são apagados de vez, e o link compartilhado deixa de funcionar. Para só tirar da loja, mude a publicação para Arquivado.${unpaidDebtNote(listing)}`}
        confirmLabel="Excluir anúncio"
        pendingLabel="Excluindo..."
        onSuccess={() => document.getElementById("listings-heading")?.focus()}
        onConfirm={() => remove.mutateAsync()}
        trigger={(open) => (
          <Tooltip label="Excluir">
            <button
              type="button"
              onClick={open}
              className="inline-flex size-11 items-center justify-center rounded-full text-stamp hover:bg-stamp/10"
              aria-label={`Excluir ${listing.title}`}
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          </Tooltip>
        )}
      />
    </div>
  );
}
