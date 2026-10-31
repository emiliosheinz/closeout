"use client";

import type { Availability } from "@closeout/contracts/enums";
import {
  type BuyerRef,
  buyerNameKey,
  whatsappInputSchema,
} from "@closeout/contracts/schemas";
import { useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { buyerReads } from "@/entities/buyer";
import type { AdminListingSummary } from "@/entities/listing";
import { displayNumber } from "@/entities/member";
import { readQuery } from "@/shared/api";
import { AVAILABILITY_LABELS, BUYER_MATCH_LABELS } from "@/shared/lib/format";
import { centsToInput, parsePriceToCents } from "@/shared/lib/money";
import { matchesSearch } from "@/shared/lib/text";
import { Button } from "@/shared/ui/button";
import { Combobox } from "@/shared/ui/combobox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Field, inputClass } from "@/shared/ui/field";
import { StaleSaleError, useListingChange } from "../model/use-listing-change";

const MAX_SUGGESTIONS = 8;
const NAME_REQUIRED = "Informe o nome do comprador.";
const PRICE_INVALID = "Informe um valor, como 80,00.";

type SoldAvailability = Exclude<Availability, "available">;

/**
 * Collects the buyer and sale details of one listing. With `availability` it
 * saves them together with the move into that state; without it, it edits the
 * sale of a reserved or sold listing and leaves its availability alone.
 */
export function BuyerDialog({
  storeId,
  listing,
  availability,
  onClose,
}: {
  storeId: string;
  listing: AdminListingSummary;
  availability?: SoldAvailability;
  onClose: () => void;
}) {
  const sale = listing.sale;
  const { data } = useQuery(readQuery(buyerReads.list(storeId)));
  const buyers = data?.items ?? [];
  const change = useListingChange(storeId);
  const id = useId();
  const [name, setName] = useState(sale?.buyer.name ?? "");
  const [phone, setPhone] = useState("");
  const [price, setPrice] = useState(
    centsToInput(sale ? sale.agreedPriceCents : listing.priceCents),
  );
  const [paid, setPaid] = useState(sale?.paid ?? false);
  const [notes, setNotes] = useState(sale?.notes ?? "");
  const [errors, setErrors] = useState<
    Partial<Record<"name" | "phone" | "price", string>>
  >({});
  const [saving, setSaving] = useState(false);

  const key = buyerNameKey(name);
  const existing = key
    ? buyers.find((buyer) => buyerNameKey(buyer.name) === key)
    : undefined;
  // Without the buyers list the current buyer is still known by id.
  const knownId =
    existing?.id ??
    (sale && key === buyerNameKey(sale.buyer.name) ? sale.buyer.id : undefined);
  const askPhone =
    key !== "" && (!knownId || (existing && !existing.whatsappNumber));
  const options = key
    ? buyers
        .filter((buyer) => matchesSearch(buyer.name, name))
        .slice(0, MAX_SUGGESTIONS)
        .map((buyer) => ({ id: buyer.id, label: buyer.name }))
    : [];

  const title = availability
    ? `${availability === "sold" ? "Vender" : "Reservar"} "${listing.title}"`
    : sale
      ? `Comprador de "${listing.title}"`
      : `Adicionar comprador a "${listing.title}"`;
  const submitLabel = availability
    ? `Marcar como ${AVAILABILITY_LABELS[availability].toLowerCase()}`
    : "Salvar";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    const next: typeof errors = {};
    if (!key) next.name = NAME_REQUIRED;
    const agreed = price.trim() === "" ? null : parsePriceToCents(price);
    if (price.trim() !== "" && agreed === null) next.price = PRICE_INVALID;
    const typedPhone = askPhone ? phone.trim() : "";
    if (typedPhone) {
      const parsed = whatsappInputSchema.safeParse(typedPhone);
      if (!parsed.success) next.phone = parsed.error.issues[0]?.message;
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const whatsappNumber = typedPhone || undefined;
    const buyer: BuyerRef = knownId
      ? { id: knownId, whatsappNumber }
      : { name: name.trim(), whatsappNumber };
    const body = {
      ...(availability && { availability }),
      buyer,
      agreedPriceCents: agreed,
      paid,
      notes: notes.trim() || null,
    };
    const nextSale = {
      buyer: { id: knownId ?? "", name: existing?.name ?? name.trim() },
      agreedPriceCents: agreed,
      paid,
      notes: body.notes,
    };
    setSaving(true);
    try {
      await change.mutateAsync({
        id: listing.id,
        title: listing.title,
        patch: availability
          ? { availability, sale: nextSale }
          : { sale: nextSale },
        body,
        route: availability ? "status" : "sale",
        inDialog: true,
      });
      onClose();
    } catch (error) {
      if (error instanceof StaleSaleError) {
        setErrors({ name: error.message });
      }
    } finally {
      setSaving(false);
    }
  }

  const nameId = `${id}-name`;
  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        className="flex max-h-[calc(100dvh-2rem)] max-w-lg flex-col overflow-hidden p-0"
        onEscapeKeyDown={(event) => {
          // Escape on an open suggestion list closes the list, not the dialog.
          const target = event.target;
          if (
            target instanceof Element &&
            target.closest("[role=combobox][aria-expanded=true]")
          ) {
            event.preventDefault();
          }
        }}
      >
        <div className="border-b border-line px-6 py-5">
          <DialogTitle className="text-lg font-bold">{title}</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted">
            Quem ficou com o item e o que foi combinado.
          </DialogDescription>
        </div>
        <form
          onSubmit={submit}
          noValidate
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex flex-col gap-5 overflow-y-auto px-6 py-5">
            <Field
              label="Nome do comprador"
              htmlFor={nameId}
              hint={
                key
                  ? BUYER_MATCH_LABELS[knownId ? "existing" : "new"]
                  : undefined
              }
              error={errors.name}
            >
              <Combobox
                id={nameId}
                value={name}
                onValueChange={setName}
                options={options}
                onSelect={(option) => setName(option.label)}
                listboxLabel="Compradores sugeridos"
                maxLength={120}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? `${nameId}-error` : undefined}
              />
            </Field>
            {existing?.whatsappNumber && (
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold">WhatsApp</span>
                <p className="text-base text-ink-soft">
                  {displayNumber(existing.whatsappNumber)}
                </p>
              </div>
            )}
            {askPhone && (
              <Field
                label="WhatsApp (opcional)"
                htmlFor={`${id}-phone`}
                hint="Com + e código do país."
                error={errors.phone}
              >
                <input
                  id={`${id}-phone`}
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  inputMode="tel"
                  autoComplete="off"
                  placeholder="+55 11 99999-8888"
                  aria-invalid={Boolean(errors.phone)}
                  aria-describedby={
                    errors.phone ? `${id}-phone-error` : undefined
                  }
                  className={inputClass}
                />
              </Field>
            )}
            <Field
              label="Valor combinado (R$)"
              htmlFor={`${id}-price`}
              error={errors.price}
            >
              <input
                id={`${id}-price`}
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                inputMode="decimal"
                autoComplete="off"
                placeholder="0,00"
                aria-invalid={Boolean(errors.price)}
                aria-describedby={
                  errors.price ? `${id}-price-error` : undefined
                }
                className={inputClass}
              />
            </Field>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold">
              <input
                type="checkbox"
                checked={paid}
                onChange={(event) => setPaid(event.target.checked)}
                className="size-5 accent-ink"
              />
              Pago
            </label>
            <Field label="Observações" htmlFor={`${id}-notes`}>
              <textarea
                id={`${id}-notes`}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                maxLength={1000}
                rows={3}
                className={`${inputClass} h-auto py-2`}
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2 border-t border-line bg-paper/70 px-6 py-3.5">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : submitLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
