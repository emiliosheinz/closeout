"use client";

import { GitMerge, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import type { BuyerSummary } from "@/entities/buyer";
import { ActionsMenu, ActionsMenuItem } from "@/shared/ui/actions-menu";
import { DeleteBuyerDialog } from "./delete-buyer-dialog";
import { EditBuyerDialog } from "./edit-buyer-dialog";
import { MergeBuyerDialog } from "./merge-buyer-dialog";

type Dialog = "edit" | "delete" | "merge";

/**
 * The actions menu of one buyer row: edit, merge into another buyer, delete.
 * `onGone` runs when the buyer disappears (deleted or merged), so the page can
 * place focus once the row is gone.
 */
export function BuyerActions({
  storeId,
  buyer,
  onGone,
}: {
  storeId: string;
  buyer: BuyerSummary;
  onGone?: () => void;
}) {
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const close = () => setDialog(null);
  return (
    <>
      <ActionsMenu label={`Ações para ${buyer.name}`}>
        <ActionsMenuItem onSelect={() => setDialog("edit")}>
          <Pencil aria-hidden="true" />
          Editar
        </ActionsMenuItem>
        <ActionsMenuItem onSelect={() => setDialog("merge")}>
          <GitMerge aria-hidden="true" />
          Juntar com...
        </ActionsMenuItem>
        <ActionsMenuItem
          onSelect={() => setDialog("delete")}
          className="text-stamp focus:bg-stamp/10 focus:text-stamp"
        >
          <Trash2 aria-hidden="true" />
          Excluir
        </ActionsMenuItem>
      </ActionsMenu>
      {dialog === "edit" && (
        <EditBuyerDialog
          storeId={storeId}
          buyer={buyer}
          onClose={close}
          onMerge={() => setDialog("merge")}
        />
      )}
      {dialog === "delete" && (
        <DeleteBuyerDialog
          storeId={storeId}
          buyer={buyer}
          onClose={close}
          onMerge={() => setDialog("merge")}
          onDeleted={onGone}
        />
      )}
      {dialog === "merge" && (
        <MergeBuyerDialog
          storeId={storeId}
          source={buyer}
          onClose={close}
          onMerged={onGone}
        />
      )}
    </>
  );
}
