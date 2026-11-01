"use client";

import {
  AVAILABILITIES,
  type Availability,
  PUBLICATIONS,
  type Publication,
} from "@closeout/contracts/enums";
import { useMutation } from "@tanstack/react-query";
import {
  Banknote,
  Copy,
  Eye,
  Globe,
  Pencil,
  Trash2,
  UserPlus,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { buyerKeys } from "@/entities/buyer";
import {
  type AdminListingSummary,
  LISTING_NOTICES,
  listingEditHref,
  listingKeys,
  StatusDot,
} from "@/entities/listing";
import { api, apiParsed, withId } from "@/shared/api";
import {
  AVAILABILITY_LABELS,
  formatMoney,
  PAYMENT_LABELS,
  PUBLICATION_LABELS,
} from "@/shared/lib/format";
import { itemPath } from "@/shared/lib/site";
import { useMediaQuery } from "@/shared/lib/use-media-query";
import {
  ActionsMenu,
  ActionsMenuCheckboxItem,
  ActionsMenuItem,
  ActionsMenuLabel,
  ActionsMenuRadioGroup,
  ActionsMenuRadioItem,
  ActionsMenuSeparator,
  ActionsMenuSub,
  ActionsMenuSubContent,
  ActionsMenuSubTrigger,
} from "@/shared/ui/actions-menu";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { notify } from "@/shared/ui/sonner";
import type { StatusChange } from "../model/status-change";
import {
  useIsListingChanging,
  useListingChange,
} from "../model/use-listing-change";
import { BuyerDialog } from "./buyer-dialog";

const listingsPath = (storeId: string) => `/stores/${storeId}/listings`;

/** A status dot in the box of a menu icon, so labels line up with the rest. */
function MenuDot({ status }: { status: Publication | Availability }) {
  return (
    <span className="flex size-4 shrink-0 items-center justify-center">
      <StatusDot status={status} />
    </span>
  );
}

/** One status's choices in the actions menu, as a labelled radio group. */
function StatusChoices<Status extends Publication | Availability>({
  label,
  value,
  options,
  labels,
  disabled,
  onChoose,
}: {
  label: string;
  value: Status;
  options: readonly Status[];
  labels: Record<Status, string>;
  disabled: boolean;
  onChoose: (status: Status) => void;
}) {
  return (
    <ActionsMenuRadioGroup value={value} aria-label={label}>
      {options.map((option) => (
        <ActionsMenuRadioItem
          key={option}
          value={option}
          disabled={disabled}
          onSelect={() => option !== value && onChoose(option)}
        >
          <MenuDot status={option} />
          {labels[option]}
        </ActionsMenuRadioItem>
      ))}
    </ActionsMenuRadioGroup>
  );
}

/**
 * With a mouse and room beside the menu, it stays short: groups are only
 * separated and the rarely changed publication waits in a submenu. On touch
 * screens a submenu is awkward, so groups get headings and publication's
 * choices are listed in place.
 */
const COMPACT_MENU =
  "(min-width: 640px) and (hover: hover) and (pointer: fine)";

function PublicationChoices({
  compact,
  ...props
}: {
  compact: boolean;
  value: Publication;
  disabled: boolean;
  onChoose: (publication: Publication) => void;
}) {
  const choices = (
    <StatusChoices
      label="Publicação"
      options={PUBLICATIONS}
      labels={PUBLICATION_LABELS}
      {...props}
    />
  );
  if (!compact) {
    return (
      <>
        <ActionsMenuSeparator />
        <ActionsMenuLabel className={menuHeading}>Publicação</ActionsMenuLabel>
        {choices}
      </>
    );
  }
  return (
    <ActionsMenuSub>
      <ActionsMenuSubTrigger>
        <Globe aria-hidden="true" />
        Publicação
        <span className="ml-auto pl-4 text-muted">
          {PUBLICATION_LABELS[props.value]}
        </span>
      </ActionsMenuSubTrigger>
      <ActionsMenuSubContent>{choices}</ActionsMenuSubContent>
    </ActionsMenuSub>
  );
}

const menuHeading = "py-1 text-xs font-medium text-muted";

const hasSale = (listing: AdminListingSummary) =>
  listing.availability !== "available" ? listing.sale : null;

/**
 * Where a listing stands, read-only: availability and, once someone reserved
 * or bought it, whether they paid. Publication shows only when the listing is
 * out of the store (draft or archived). Changes go through the actions menu.
 */
export function ListingStatusSummary({
  listing,
}: {
  listing: AdminListingSummary;
}) {
  const sale = hasSale(listing);
  // Unpaid is the normal state of a reservation; after handing an item over
  // it is money owed.
  const owed = sale && !sale.paid && listing.availability === "sold";
  return (
    <div className="text-sm lg:whitespace-nowrap">
      <p className="flex flex-wrap items-center gap-x-2 font-medium text-ink">
        <StatusDot status={listing.availability} />
        {AVAILABILITY_LABELS[listing.availability]}
        {sale && (
          <span
            className={owed ? "ml-1 text-stamp" : "ml-1 font-normal text-muted"}
          >
            {sale.paid ? PAYMENT_LABELS.paid : PAYMENT_LABELS.unpaid}
          </span>
        )}
      </p>
      {listing.publication !== "published" && (
        <p className="mt-0.5 pl-3.5 text-muted">
          {PUBLICATION_LABELS[listing.publication]}
        </p>
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
      <span className="truncate" title={name}>
        {name}
      </span>
    </p>
  );
}

/** What deleting costs when the buyer has not paid: the debt stops counting. */
function unpaidDebtNote({ sale }: AdminListingSummary): string {
  if (!sale || sale.paid) return "";
  const owed =
    sale.agreedPriceCents === null
      ? ""
      : ` (${formatMoney(sale.agreedPriceCents)})`;
  return ` ${sale.buyer.name} ainda não pagou${owed}, e esse valor deixa de contar como dívida.`;
}

/**
 * The actions menu of one listing, where everything about it changes:
 * availability and publication, the sale (buyer details and payment), then
 * edit, view in the store (or preview), duplicate and delete. Reserving or
 * selling asks for the buyer first; releasing an item that has one, duplicating
 * and deleting confirm first.
 */
export function ListingRowActions({
  storeId,
  storeSlug,
  listing,
  onStatusChange,
}: {
  storeId: string;
  storeSlug: string;
  listing: AdminListingSummary;
  /** Called when the status is changed, so the caller can keep the row in view. */
  onStatusChange?: (id: string) => void;
}) {
  const router = useRouter();
  const base = listingsPath(storeId);
  const published = listing.publication === "published";
  const sale = hasSale(listing);
  const change = useListingChange(storeId);
  const changing = useIsListingChanging(storeId, listing.id);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const compact = useMediaQuery(COMPACT_MENU);
  // Reserving or selling (with that availability), or editing the sale (null).
  const [buyerFor, setBuyerFor] = useState<
    "reserved" | "sold" | null | undefined
  >(undefined);
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
      setBuyerFor(next);
      return;
    }
    if (listing.sale) {
      confirmRelease();
      return;
    }
    setStatus({ availability: next, sale: null }, { availability: next }).catch(
      () => {},
    );
  }

  function choosePublication(next: Publication) {
    setStatus({ publication: next }).catch(() => {});
  }

  function togglePaid() {
    if (!sale || changing) return;
    const paid = !sale.paid;
    change.mutate({
      id: listing.id,
      title: listing.title,
      patch: { sale: { ...sale, paid } },
      body: { paid },
      route: "sale",
    });
  }

  async function copy() {
    const result = await duplicate.mutateAsync();
    if (result.parsed) {
      router.push(listingEditHref(result.data.id, "copied"));
      return;
    }
    notify.success(LISTING_NOTICES.copied.message);
  }

  const menu = (
    confirmRelease: () => void,
    confirmCopy: () => void,
    confirmDelete: () => void,
  ) => (
    <ActionsMenu label={`Ações para ${listing.title}`} triggerRef={triggerRef}>
      {!compact && (
        <ActionsMenuLabel className={menuHeading}>
          Disponibilidade
        </ActionsMenuLabel>
      )}
      <StatusChoices
        label="Disponibilidade"
        value={listing.availability}
        options={AVAILABILITIES}
        labels={AVAILABILITY_LABELS}
        disabled={changing}
        onChoose={(a) => chooseAvailability(a, confirmRelease)}
      />
      {listing.availability !== "available" && (
        <>
          <ActionsMenuSeparator />
          {!compact && (
            <ActionsMenuLabel className={menuHeading}>Venda</ActionsMenuLabel>
          )}
        </>
      )}
      {sale && (
        <ActionsMenuCheckboxItem
          checked={sale.paid}
          disabled={changing}
          onCheckedChange={togglePaid}
        >
          <Banknote aria-hidden="true" />
          {PAYMENT_LABELS.paid}
        </ActionsMenuCheckboxItem>
      )}
      {listing.availability !== "available" && (
        <ActionsMenuItem disabled={changing} onSelect={() => setBuyerFor(null)}>
          {sale ? (
            <UserRound aria-hidden="true" />
          ) : (
            <UserPlus aria-hidden="true" />
          )}
          {sale ? "Dados da venda" : "Adicionar comprador"}
        </ActionsMenuItem>
      )}
      <ActionsMenuSeparator />
      <ActionsMenuItem asChild>
        <Link href={`/admin/listings/${listing.id}`}>
          <Pencil aria-hidden="true" />
          Editar anúncio
        </Link>
      </ActionsMenuItem>
      <ActionsMenuItem asChild>
        <a
          href={
            published
              ? itemPath(storeSlug, listing.slug)
              : `/admin/listings/${listing.id}/preview`
          }
          target="_blank"
          rel="noopener noreferrer"
        >
          <Eye aria-hidden="true" />
          {published ? "Ver na loja" : "Pré-visualizar"}
        </a>
      </ActionsMenuItem>
      <ActionsMenuItem
        onSelect={confirmCopy}
        disabled={changing || duplicate.isPending}
      >
        <Copy aria-hidden="true" />
        Duplicar
      </ActionsMenuItem>
      <PublicationChoices
        compact={compact}
        value={listing.publication}
        disabled={changing}
        onChoose={choosePublication}
      />
      <ActionsMenuSeparator />
      <ActionsMenuItem
        onSelect={confirmDelete}
        className="text-stamp focus:bg-stamp/10 focus:text-stamp"
      >
        <Trash2 aria-hidden="true" />
        Excluir
      </ActionsMenuItem>
    </ActionsMenu>
  );

  return (
    <>
      <ConfirmDialog
        title={`Voltar "${listing.title}" para disponível?`}
        description={
          listing.sale
            ? `${listing.sale.buyer.name} deixa de ser o comprador e o valor combinado, o pagamento e as observações são apagados.`
            : ""
        }
        confirmLabel="Voltar para disponível"
        pendingLabel="Salvando..."
        onConfirm={release}
        trigger={(confirmRelease) => (
          <ConfirmDialog
            title={`Duplicar "${listing.title}"?`}
            description="A cópia vira um rascunho com o mesmo texto, preço e vendedores. As fotos não são copiadas."
            confirmLabel="Duplicar anúncio"
            pendingLabel="Duplicando..."
            destructive={false}
            onConfirm={copy}
            trigger={(confirmCopy) => (
              <ConfirmDialog
                title={`Excluir "${listing.title}"?`}
                description={`O anúncio e as fotos são apagados de vez, e o link compartilhado deixa de funcionar. Para só tirar da loja, mude a publicação para Arquivado.${unpaidDebtNote(listing)}`}
                confirmLabel="Excluir anúncio"
                pendingLabel="Excluindo..."
                onSuccess={() =>
                  document.getElementById("listings-heading")?.focus()
                }
                onConfirm={() => remove.mutateAsync()}
                trigger={(confirmDelete) =>
                  menu(confirmRelease, confirmCopy, confirmDelete)
                }
              />
            )}
          />
        )}
      />
      {buyerFor !== undefined && (
        <BuyerDialog
          storeId={storeId}
          listing={listing}
          availability={buyerFor ?? undefined}
          returnFocusTo={triggerRef}
          onClose={() => setBuyerFor(undefined)}
        />
      )}
    </>
  );
}
