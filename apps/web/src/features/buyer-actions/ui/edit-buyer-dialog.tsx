"use client";

import {
  buyerNameSchema,
  whatsappInputSchema,
} from "@closeout/contracts/schemas";
import { useMutation } from "@tanstack/react-query";
import { useId, useState } from "react";
import { type BuyerSummary, buyerKeys } from "@/entities/buyer";
import { listingKeys } from "@/entities/listing";
import { displayNumber } from "@/entities/member";
import { ApiError, api } from "@/shared/api";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Field, inputClass } from "@/shared/ui/field";

/** Another buyer already has the name (409); the dialog shows it and offers a merge. */
class NameTakenError extends Error {}

const isNameTaken = (error: unknown) => error instanceof NameTakenError;

/** Changes a buyer's name and WhatsApp number; clearing the number removes it. */
export function EditBuyerDialog({
  storeId,
  buyer,
  onClose,
  onMerge,
}: {
  storeId: string;
  buyer: BuyerSummary;
  onClose: () => void;
  /** Swaps this dialog for the merge dialog, when the new name is taken. */
  onMerge: () => void;
}) {
  const id = useId();
  const [name, setName] = useState(buyer.name);
  const [phone, setPhone] = useState(displayNumber(buyer.whatsappNumber));
  const [errors, setErrors] = useState<
    Partial<Record<"name" | "phone", string>>
  >({});
  const [taken, setTaken] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async (body: { name: string; whatsappNumber: string }) => {
      try {
        await api("PATCH", `/stores/${storeId}/buyers/${buyer.id}`, body);
      } catch (error) {
        if (error instanceof ApiError && error.status === 409)
          throw new NameTakenError(error.message);
        throw error;
      }
    },
    meta: {
      success: "Alterações salvas.",
      invalidates: [buyerKeys.all(storeId), listingKeys.all(storeId)],
      handlesError: isNameTaken,
    },
  });
  const saving = save.isPending;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    const next: typeof errors = {};
    const parsedName = buyerNameSchema.safeParse(name);
    if (!parsedName.success) next.name = parsedName.error.issues[0]?.message;
    const typedPhone = phone.trim();
    if (typedPhone) {
      const parsed = whatsappInputSchema.safeParse(typedPhone);
      if (!parsed.success) next.phone = parsed.error.issues[0]?.message;
    }
    setErrors(next);
    setTaken(null);
    if (!parsedName.success) return;
    if (Object.keys(next).length > 0) return;
    save.mutate(
      { name: parsedName.data, whatsappNumber: typedPhone },
      {
        onSuccess: onClose,
        onError: (error) => {
          if (error instanceof NameTakenError) setTaken(error.message);
        },
      },
    );
  }

  const nameId = `${id}-name`;
  const phoneId = `${id}-phone`;
  return (
    <Dialog open onOpenChange={(next) => !next && !saving && onClose()}>
      <DialogContent
        className="max-w-lg overflow-hidden p-0"
        onInteractOutside={(event) => saving && event.preventDefault()}
        onEscapeKeyDown={(event) => saving && event.preventDefault()}
      >
        <div className="border-b border-line px-6 py-5">
          <DialogTitle className="text-lg font-bold">
            {`Editar ${buyer.name}`}
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted">
            O nome aparece nos anúncios reservados ou vendidos para esta pessoa.
          </DialogDescription>
        </div>
        <form onSubmit={submit} noValidate>
          <div className="flex flex-col gap-5 px-6 py-5">
            <Field
              label="Nome do comprador"
              htmlFor={nameId}
              error={errors.name}
            >
              <input
                id={nameId}
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={120}
                autoComplete="off"
                aria-invalid={Boolean(errors.name || taken)}
                aria-describedby={
                  errors.name
                    ? `${nameId}-error`
                    : taken
                      ? `${id}-taken`
                      : undefined
                }
                className={inputClass}
              />
            </Field>
            {taken && (
              <div
                id={`${id}-taken`}
                role="alert"
                className="flex flex-col items-start gap-2 rounded-md bg-stamp/10 px-3 py-2.5 text-sm text-stamp"
              >
                <p>{taken}</p>
                <Button type="button" variant="outline" onClick={onMerge}>
                  Juntar com...
                </Button>
              </div>
            )}
            <Field
              label="WhatsApp"
              htmlFor={phoneId}
              hint="Com + e código do país. Deixe vazio para remover."
              error={errors.phone}
            >
              <input
                id={phoneId}
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                inputMode="tel"
                autoComplete="off"
                placeholder="+55 11 99999-8888"
                aria-invalid={Boolean(errors.phone)}
                aria-describedby={errors.phone ? `${phoneId}-error` : undefined}
                className={inputClass}
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2 border-t border-line bg-paper/70 px-6 py-3.5">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={saving}>
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
