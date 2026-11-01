"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";
import { type BuyerSummary, buyerKeys, buyerReads } from "@/entities/buyer";
import { listingKeys } from "@/entities/listing";
import { api, readQuery, successFor } from "@/shared/api";
import { pluralize } from "@/shared/lib/format";
import { matchesSearch } from "@/shared/lib/text";
import { displayNumber } from "@/shared/lib/whatsapp";
import { Button } from "@/shared/ui/button";
import { Combobox, isExpandedCombobox } from "@/shared/ui/combobox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Field } from "@/shared/ui/field";

const MAX_SUGGESTIONS = 8;

/** What the merge does with the items and the phone, for the confirmation line. */
function mergeSummary(source: BuyerSummary, target: BuyerSummary): string {
  const items =
    source.linkedCount === 0
      ? `${source.name} não tem itens ligados.`
      : `${pluralize(source.linkedCount, "item", "itens")} de ${source.name} ${
          source.linkedCount === 1 ? "passa" : "passam"
        } para ${target.name}.`;
  let phone = "";
  if (target.whatsappNumber) {
    phone = ` ${target.name} mantém o WhatsApp ${displayNumber(target.whatsappNumber)}.`;
  } else if (source.whatsappNumber) {
    phone = ` ${target.name} recebe o WhatsApp ${displayNumber(source.whatsappNumber)} de ${source.name}.`;
  }
  return `${items}${phone} ${source.name} deixa de existir.`;
}

/**
 * Moves every item of one buyer to another existing buyer. The target is
 * picked from the store's other buyers; saving stays off until one is picked.
 */
export function MergeBuyerDialog({
  storeId,
  source,
  onClose,
  onMerged,
}: {
  storeId: string;
  source: BuyerSummary;
  onClose: () => void;
  /** Called once the merge is saved and the dialog has closed, to place focus. */
  onMerged?: () => void;
}) {
  const id = useId();
  const { data, isError } = useQuery(readQuery(buyerReads.list(storeId)));
  const others = (data?.items ?? []).filter((buyer) => buyer.id !== source.id);
  const [search, setSearch] = useState("");
  const [targetId, setTargetId] = useState<string | null>(null);
  const target = others.find((buyer) => buyer.id === targetId);

  const merge = useMutation({
    mutationFn: (picked: BuyerSummary) =>
      api("POST", `/stores/${storeId}/buyers/${source.id}/merge`, {
        targetId: picked.id,
      }),
    meta: {
      success: successFor<BuyerSummary>(
        (picked) => `${source.name} foi juntado com ${picked.name}.`,
      ),
      invalidates: [buyerKeys.all(storeId), listingKeys.all(storeId)],
    },
  });
  const saving = merge.isPending;
  const mounted = useRef(true);
  const merged = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const options = search
    ? others
        .filter((buyer) => matchesSearch(buyer.name, search))
        .slice(0, MAX_SUGGESTIONS)
        .map((buyer) => ({ id: buyer.id, label: buyer.name }))
    : [];

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!target || saving) return;
    const failed = await merge.mutateAsync(target).then(
      () => false,
      () => true,
    );
    if (failed) return;
    // The merge can remove the row (and this dialog) before it resolves.
    if (!mounted.current) return onMerged?.();
    merged.current = true;
    onClose();
  }

  const searchId = `${id}-target`;
  return (
    <Dialog open onOpenChange={(next) => !next && !saving && onClose()}>
      <DialogContent
        className="max-w-lg overflow-hidden p-0"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (!merged.current) return;
          merged.current = false;
          onMerged?.();
        }}
        onInteractOutside={(event) => saving && event.preventDefault()}
        onEscapeKeyDown={(event) => {
          if (saving) {
            event.preventDefault();
            return;
          }
          // Escape on an open suggestion list closes the list, not the dialog.
          if (isExpandedCombobox(event.target)) event.preventDefault();
        }}
      >
        <div className="border-b border-line px-6 py-5">
          <DialogTitle className="text-lg font-bold">
            {`Juntar ${source.name} com outro comprador`}
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted">
            Os itens vão para o comprador que você escolher.
          </DialogDescription>
        </div>
        <form onSubmit={submit} noValidate>
          <div className="flex flex-col gap-4 px-6 py-5">
            <Field label="Juntar com" htmlFor={searchId}>
              <Combobox
                id={searchId}
                value={search}
                onValueChange={(value) => {
                  setSearch(value);
                  setTargetId(null);
                }}
                options={options}
                onSelect={(option) => {
                  setSearch(option.label);
                  setTargetId(option.id);
                }}
                listboxLabel="Compradores"
                placeholder="Busque pelo nome"
                maxLength={120}
              />
            </Field>
            <p
              aria-live="polite"
              className="text-sm text-ink-soft empty:hidden"
            >
              {target && mergeSummary(source, target)}
            </p>
            {isError && (
              <p role="alert" className="text-sm font-medium text-stamp">
                Não foi possível carregar os compradores. Feche e tente de novo.
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t border-line bg-paper/70 px-6 py-3.5">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={saving}>
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!target || saving}>
              {saving ? "Juntando..." : "Juntar compradores"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
