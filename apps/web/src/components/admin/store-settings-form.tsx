"use client";

import { Check, Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiError, api } from "@/lib/admin/client-api";
import type { StoreSettings } from "@/lib/admin/types";
import { cn } from "@/lib/utils";
import { Field, inputClass } from "./field";

export function StoreSettingsForm({
  store,
  storeUrl,
}: {
  store: StoreSettings;
  storeUrl: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(store.name);
  const [headline, setHeadline] = useState(store.headline);
  const [intro, setIntro] = useState(store.intro);
  const [status, setStatus] = useState<{ text: string; error: boolean } | null>(
    null,
  );
  const [copied, setCopied] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setStatus(null);
    try {
      await api("PATCH", `/stores/${store.id}`, { name, headline, intro });
      setStatus({ text: "Loja atualizada.", error: false });
      router.refresh();
    } catch (err) {
      setStatus({
        text:
          err instanceof ApiError ? err.message : "Não foi possível salvar.",
        error: true,
      });
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(storeUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="flex max-w-2xl flex-col gap-10">
      <section
        aria-labelledby="share-heading"
        className="rounded-xl border border-line bg-surface p-5"
      >
        <h2 id="share-heading" className="font-bold">
          Link para compartilhar
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <code className="rounded-md bg-paper px-3 py-2 text-sm break-all">
            {storeUrl}
          </code>
          <Button type="button" variant="outline" onClick={copyLink}>
            {copied ? (
              <Check aria-hidden="true" />
            ) : (
              <Copy aria-hidden="true" />
            )}
            {copied ? "Copiado" : "Copiar link"}
          </Button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`Estamos vendendo algumas coisas da casa: ${storeUrl}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center rounded-full bg-go px-4 text-sm font-semibold text-white hover:bg-go-strong"
          >
            Enviar no WhatsApp
          </a>
        </div>
      </section>

      <form onSubmit={save} className="flex flex-col gap-5">
        <Field label="Nome da loja" htmlFor="store-name">
          <input
            id="store-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            required
            className={inputClass}
          />
        </Field>
        <Field
          label="Chamada principal"
          htmlFor="store-headline"
          hint="A frase grande no topo da loja."
        >
          <input
            id="store-headline"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            maxLength={160}
            className={inputClass}
          />
        </Field>
        <Field
          label="Apresentação"
          htmlFor="store-intro"
          hint="Algumas linhas contando por que vocês estão vendendo."
        >
          <textarea
            id="store-intro"
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            maxLength={1200}
            rows={5}
            className={cn(inputClass, "h-auto py-2 leading-relaxed")}
          />
        </Field>
        <div className="flex items-center gap-3">
          <Button type="submit">Salvar loja</Button>
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
    </div>
  );
}
