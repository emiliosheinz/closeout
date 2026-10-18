"use client";

import { MessageCircle } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ContactButton } from "./contact-button";

export interface SellerContact {
  name: string;
  avatarUrl: string | null;
  href: string;
}

/**
 * The WhatsApp action for an item. With one reachable seller it opens the
 * chat directly; when several people sell the item, the buyer picks whom to
 * message first.
 */
export function ContactAction({
  contacts,
  className,
}: {
  contacts: SellerContact[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [only] = contacts;
  if (!only) return null;
  if (contacts.length === 1) {
    return (
      <ContactButton
        href={only.href}
        sellerName={only.name}
        className={className}
      />
    );
  }
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="whatsapp-contact"
        className={cn(
          "inline-flex min-h-13 items-center justify-center gap-2 rounded-full bg-go px-6 py-2 text-center text-base font-semibold text-white shadow-[0_8px_20px_-10px_rgba(30,127,85,0.8)] hover:bg-go-strong",
          className,
        )}
      >
        <MessageCircle className="size-5" aria-hidden="true" />
        Chamar no WhatsApp
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle className="text-lg font-bold">
            Com quem você quer falar?
          </DialogTitle>
          <DialogDescription className="mt-1 text-ink-soft">
            Este item é vendido por mais de uma pessoa. Escolha quem vai receber
            sua mensagem.
          </DialogDescription>
          <ul className="mt-5 flex flex-col gap-2">
            {contacts.map((contact) => (
              <li key={`${contact.name}-${contact.href}`}>
                <a
                  href={contact.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  aria-label={`Chamar ${contact.name} no WhatsApp (abre em nova aba)`}
                  className="flex min-h-14 items-center gap-3 rounded-xl border border-line bg-surface px-3 font-semibold hover:border-go/60 hover:bg-go/5"
                >
                  {contact.avatarUrl ? (
                    // biome-ignore lint/performance/noImgElement: small pre-sized avatar variant.
                    <img
                      src={contact.avatarUrl}
                      alt=""
                      width={36}
                      height={36}
                      className="size-9 rounded-full object-cover"
                    />
                  ) : (
                    <span className="inline-flex size-9 items-center justify-center rounded-full bg-go/10 text-go">
                      <MessageCircle className="size-4" aria-hidden="true" />
                    </span>
                  )}
                  <span className="flex-1">{contact.name}</span>
                </a>
              </li>
            ))}
          </ul>
          <DialogClose className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-full text-sm font-semibold text-ink-soft hover:bg-ink/5">
            Agora não
          </DialogClose>
        </DialogContent>
      </Dialog>
    </>
  );
}
