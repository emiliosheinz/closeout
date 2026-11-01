"use client";

import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { type BuyerSummary, buyerKeys } from "@/entities/buyer";
import { listingKeys } from "@/entities/listing";
import { ApiError, api } from "@/shared/api";
import { pluralize } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/shared/ui/dialog";

/** The buyer got linked to an item meanwhile (409): deleting is refused. */
class StillLinkedError extends Error {}

const isStillLinked = (error: unknown) => error instanceof StillLinkedError;

/**
 * Deletes a buyer nobody is linked to. A buyer with items cannot go: the
 * dialog says why and offers to merge instead, without sending anything.
 */
export function DeleteBuyerDialog({
  storeId,
  buyer,
  onClose,
  onMerge,
  onDeleted,
}: {
  storeId: string;
  buyer: BuyerSummary;
  onClose: () => void;
  onMerge: () => void;
  /** Called once the buyer is deleted and the dialog has closed, to place focus. */
  onDeleted?: () => void;
}) {
  const [linkedLate, setLinkedLate] = useState(false);
  const blocked = buyer.linkedCount > 0 || linkedLate;
  const remove = useMutation({
    mutationFn: async () => {
      try {
        await api("DELETE", `/stores/${storeId}/buyers/${buyer.id}`);
      } catch (error) {
        if (error instanceof ApiError && error.status === 409)
          throw new StillLinkedError(error.message);
        throw error;
      }
    },
    meta: {
      success: `${buyer.name} foi excluído.`,
      invalidates: [buyerKeys.all(storeId), listingKeys.all(storeId)],
      handlesError: isStillLinked,
    },
  });
  const deleting = remove.isPending;
  const mounted = useRef(true);
  const deleted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reason =
    buyer.linkedCount > 0
      ? `${buyer.name} tem ${pluralize(buyer.linkedCount, "item", "itens")} e não pode ser excluído.`
      : `${buyer.name} acabou de ser ligado a um item e não pode ser excluído.`;

  async function confirm() {
    if (deleting) return;
    try {
      await remove.mutateAsync();
    } catch (error) {
      if (error instanceof StillLinkedError && mounted.current)
        setLinkedLate(true);
      return;
    }
    // The delete can remove the row (and this dialog) before it resolves.
    if (!mounted.current) return onDeleted?.();
    deleted.current = true;
    onClose();
  }

  return (
    <Dialog open onOpenChange={(next) => !next && !deleting && onClose()}>
      <DialogContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (!deleted.current) return;
          deleted.current = false;
          onDeleted?.();
        }}
        onInteractOutside={(event) => deleting && event.preventDefault()}
        onEscapeKeyDown={(event) => deleting && event.preventDefault()}
      >
        <DialogTitle className="text-lg font-bold">
          {blocked
            ? `Não dá para excluir ${buyer.name}`
            : `Excluir ${buyer.name}?`}
        </DialogTitle>
        <DialogDescription className="mt-2 text-ink-soft">
          {blocked
            ? `${reason} Junte com outro comprador para manter os itens.`
            : "O comprador sai da lista. Não dá para desfazer."}
        </DialogDescription>
        <div className="mt-6 flex justify-end gap-2">
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={deleting}>
              Cancelar
            </Button>
          </DialogClose>
          {blocked ? (
            <Button type="button" onClick={onMerge}>
              Juntar com...
            </Button>
          ) : (
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={confirm}
            >
              {deleting ? "Excluindo..." : "Excluir"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
