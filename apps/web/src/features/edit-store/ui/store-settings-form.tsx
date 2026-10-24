"use client";

import { storeRequestSchema } from "@closeout/contracts/schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { sessionKeys } from "@/entities/session";
import type { StoreSettings } from "@/entities/store";
import { api } from "@/shared/api";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Field, inputClass } from "@/shared/ui/field";

const formSchema = storeRequestSchema.required();
type FormValues = z.infer<typeof formSchema>;

export function StoreSettingsForm({
  store,
  storeUrl,
}: {
  store: StoreSettings;
  storeUrl: string;
}) {
  const [copied, setCopied] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: store.name,
      headline: store.headline,
      intro: store.intro,
    },
  });
  const save = useMutation({
    mutationFn: (values: FormValues) =>
      api("PATCH", `/stores/${store.id}`, values),
    meta: {
      success: "Loja atualizada.",
      invalidates: [sessionKeys.me()],
    },
  });

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

      <form
        onSubmit={handleSubmit((values) => save.mutate(values))}
        noValidate
        className="flex flex-col gap-5"
      >
        <Field
          label="Nome da loja"
          htmlFor="store-name"
          error={errors.name?.message}
        >
          <input
            id="store-name"
            maxLength={80}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "store-name-error" : undefined}
            className={inputClass}
            {...register("name")}
          />
        </Field>
        <Field
          label="Chamada principal"
          htmlFor="store-headline"
          hint="A frase grande no topo da loja."
        >
          <input
            id="store-headline"
            maxLength={160}
            className={inputClass}
            {...register("headline")}
          />
        </Field>
        <Field
          label="Apresentação"
          htmlFor="store-intro"
          hint="Algumas linhas contando por que vocês estão vendendo."
        >
          <textarea
            id="store-intro"
            maxLength={1200}
            rows={5}
            className={cn(inputClass, "h-auto py-2 leading-relaxed")}
            {...register("intro")}
          />
        </Field>
        <div>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Salvando..." : "Salvar loja"}
          </Button>
        </div>
      </form>
    </div>
  );
}
