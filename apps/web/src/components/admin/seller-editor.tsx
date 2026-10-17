"use client";

import { Camera, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiError, api } from "@/lib/admin/client-api";
import type { Seller } from "@/lib/admin/types";
import { ConfirmDialog } from "./confirm-dialog";
import { Field, inputClass } from "./field";

/** Shows a stored digits-only number the way people type it back. */
function displayNumber(number: string | null): string {
  return number ? `+${number}` : "";
}

function SellerCard({ storeId, seller }: { storeId: string; seller: Seller }) {
  const router = useRouter();
  const [name, setName] = useState(seller.displayName);
  const [number, setNumber] = useState(displayNumber(seller.whatsappNumber));
  const [status, setStatus] = useState<{ text: string; error: boolean } | null>(
    null,
  );
  const [pending, setPending] = useState(false);
  const base = `/stores/${storeId}/sellers/${seller.id}`;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setStatus(null);
    try {
      const saved = await api<Seller>("PATCH", base, {
        displayName: name,
        whatsappNumber: number,
      });
      setNumber(displayNumber(saved.whatsappNumber));
      setStatus({ text: "Contato salvo.", error: false });
      router.refresh();
    } catch (err) {
      setStatus({
        text:
          err instanceof ApiError ? err.message : "Não foi possível salvar.",
        error: true,
      });
    } finally {
      setPending(false);
    }
  }

  async function uploadAvatar(file: File | undefined) {
    if (!file || pending) return;
    setPending(true);
    const body = new FormData();
    body.append("file", file);
    try {
      await api("POST", `${base}/avatar`, body);
      setStatus({ text: "Foto atualizada.", error: false });
      router.refresh();
    } catch (err) {
      setStatus({
        text:
          err instanceof ApiError ? err.message : "Não foi possível enviar.",
        error: true,
      });
    } finally {
      setPending(false);
    }
  }

  const idPrefix = `seller-${seller.id}`;
  return (
    <li className="rounded-xl border border-line bg-surface p-5">
      <form onSubmit={save} className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <label className="relative inline-flex size-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-paper has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-focus">
            {seller.avatarUrl ? (
              // biome-ignore lint/performance/noImgElement: pre-sized avatar variant.
              <img
                src={seller.avatarUrl}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              <Camera className="size-5 text-muted" aria-hidden="true" />
            )}
            <span className="sr-only">Trocar foto de {seller.displayName}</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => {
                uploadAvatar(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          <div className="min-w-0">
            <p className="text-sm text-muted">
              {seller.listingCount === 1
                ? "1 anúncio"
                : `${seller.listingCount} anúncios`}
            </p>
            {!seller.whatsappNumber && (
              <p className="mt-0.5 text-sm font-semibold text-stamp">
                Sem WhatsApp: os anúncios aparecem sem botão de contato.
              </p>
            )}
          </div>
        </div>
        <Field label="Nome que aparece na loja" htmlFor={`${idPrefix}-name`}>
          <input
            id={`${idPrefix}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            required
            className={inputClass}
          />
        </Field>
        <Field
          label="WhatsApp"
          htmlFor={`${idPrefix}-number`}
          hint="Com + e código do país, por exemplo +55 11 99999-8888. Vazio esconde o botão de contato."
        >
          <input
            id={`${idPrefix}-number`}
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            inputMode="tel"
            autoComplete="tel"
            placeholder="+55 11 99999-8888"
            className={inputClass}
          />
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending}>
            Salvar contato
          </Button>
          <ConfirmDialog
            title={`Excluir ${seller.displayName}?`}
            description="O vendedor some da loja. Só é possível excluir quem não tem anúncios."
            confirmLabel="Excluir vendedor"
            pendingLabel="Excluindo..."
            onConfirm={async () => {
              await api("DELETE", base);
              router.refresh();
            }}
            trigger={(open) => (
              <Button
                type="button"
                variant="ghost"
                onClick={open}
                className="text-stamp"
              >
                <Trash2 aria-hidden="true" />
                Excluir
              </Button>
            )}
          />
          <span
            role="status"
            aria-live="polite"
            className={
              status?.error
                ? "text-sm font-medium text-stamp"
                : "text-sm text-go"
            }
          >
            {status?.text}
          </span>
        </div>
      </form>
    </li>
  );
}

export function SellerEditor({
  storeId,
  sellers,
}: {
  storeId: string;
  sellers: Seller[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setAdding(true);
    setError(null);
    try {
      await api("POST", `/stores/${storeId}/sellers`, {
        displayName: "Novo vendedor",
      });
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Não foi possível adicionar.",
      );
    } finally {
      setAdding(false);
    }
  }

  return (
    <>
      <ul className="grid gap-4 md:grid-cols-2">
        {sellers.map((seller) => (
          <SellerCard key={seller.id} storeId={storeId} seller={seller} />
        ))}
      </ul>
      <Button
        variant="outline"
        className="mt-6"
        onClick={add}
        disabled={adding}
      >
        <Plus aria-hidden="true" />
        Adicionar vendedor
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-stamp">
          {error}
        </p>
      )}
    </>
  );
}
