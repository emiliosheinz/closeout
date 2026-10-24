"use client";

import { Check, Copy } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

export interface ShownInvite {
  email: string;
  link: string;
}

/**
 * The only place an invite link is ever shown: the API returns it once, on
 * create and on regenerate, and never lists it again.
 */
export function InviteLinkDialog({
  invite,
  onClose,
}: {
  invite: ShownInvite | null;
  onClose: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [copy, setCopy] = useState<"idle" | "copied" | "manual">("idle");

  async function copyLink() {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.link);
      setCopy("copied");
    } catch {
      // Clipboard access can be denied; leave the link selected to copy by hand.
      input.current?.select();
      setCopy("manual");
    }
  }

  return (
    <Dialog
      open={invite !== null}
      onOpenChange={(open) => {
        if (open) return;
        setCopy("idle");
        onClose();
      }}
    >
      <DialogContent className="max-w-lg overflow-visible">
        <span
          aria-hidden="true"
          className="absolute -top-5 -right-3 inline-flex size-18 rotate-12 items-center justify-center rounded-full bg-sticker p-2 text-center font-marker text-sm leading-tight text-sticker-ink shadow-[0_1px_0_rgba(0,0,0,0.12),0_10px_22px_-10px_rgba(23,32,43,0.55)] ring-1 ring-black/5 sm:-right-6 sm:size-20 sm:text-base"
        >
          Só agora
        </span>
        <DialogTitle className="pr-14 text-lg font-bold">
          Convite para {invite?.email}
        </DialogTitle>
        <DialogDescription className="mt-2 text-ink-soft">
          Mande este link para a pessoa, pelo WhatsApp ou como preferir. Ela
          cria a senha e já entra na loja.
        </DialogDescription>
        <label htmlFor="invite-link" className="sr-only">
          Link do convite
        </label>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <input
            id="invite-link"
            ref={input}
            readOnly
            value={invite?.link ?? ""}
            onFocus={(e) => e.currentTarget.select()}
            className="h-11 min-w-0 flex-1 rounded-md border border-dashed border-line-strong bg-paper px-3 font-medium text-sm text-ink"
          />
          <Button type="button" onClick={copyLink}>
            {copy === "copied" ? (
              <Check aria-hidden="true" />
            ) : (
              <Copy aria-hidden="true" />
            )}
            {copy === "copied" ? "Copiado" : "Copiar link"}
          </Button>
        </div>
        <p role="status" aria-live="polite" className="mt-2 min-h-5 text-sm">
          {copy === "copied" && (
            <span className="font-semibold text-go">
              Link copiado. Agora é só colar na conversa.
            </span>
          )}
          {copy === "manual" && (
            <span className="text-ink-soft">
              Não deu para copiar sozinho. O link está selecionado: copie com o
              teclado ou segurando o dedo nele.
            </span>
          )}
        </p>
        <p className="mt-3 rounded-md bg-sticker/40 px-3 py-2 text-sm text-sticker-ink">
          Este link aparece só agora e vale por 7 dias. Se ele se perder, gere
          um novo em Convites pendentes.
        </p>
        <div className="mt-6 flex justify-end">
          <DialogClose asChild>
            <Button variant="outline">Pronto</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
