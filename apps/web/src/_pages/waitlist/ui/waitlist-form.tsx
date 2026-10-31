"use client";

import {
  WAITLIST_CHANNELS,
  type WaitlistChannel,
} from "@closeout/contracts/enums";
import {
  type WaitlistFields,
  waitlistFieldsSchema,
} from "@closeout/contracts/schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { type Resolver, useForm } from "react-hook-form";
import { readProblem } from "@/shared/api";
import { Button } from "@/shared/ui/button";
import { Field, inputClass } from "@/shared/ui/field";
import type { SignupAttribution } from "../model/signup-attribution";

const FALLBACK_MESSAGE = "Não foi possível entrar na lista agora.";
const OFFLINE_MESSAGE = "Sem conexão. Verifique a internet e tente de novo.";

type FormValues = WaitlistFields & { website: string };

const CHANNEL_UI: Record<
  WaitlistChannel,
  { optionLabel: string; label: string; type: "tel" | "email"; initial: string }
> = {
  whatsapp: {
    optionLabel: "WhatsApp",
    label: "Seu WhatsApp",
    type: "tel",
    initial: "+55 ",
  },
  email: {
    optionLabel: "E-mail",
    label: "Seu e-mail",
    type: "email",
    initial: "",
  },
};

const FIELD_BY_POINTER = new Map<string, "name" | "contact">([
  ["/name", "name"],
  ["/contact", "contact"],
]);

async function celebrate() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const { create } = await import("canvas-confetti");
  // The default instance draws from a blob worker, which the site's CSP blocks.
  const confetti = create(null, { resize: true, useWorker: false });
  confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
}

/** Collects one waitlist signup and posts it to the same-origin relay. */
export function WaitlistForm({
  attribution,
  storeHref,
}: {
  attribution: SignupAttribution;
  storeHref?: string;
}) {
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    clearErrors,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    // Raw mode: the schema only validates; the typed values are what we send.
    resolver: zodResolver(waitlistFieldsSchema, undefined, {
      raw: true,
    }) as unknown as Resolver<FormValues>,
    defaultValues: {
      name: "",
      channel: "whatsapp",
      contact: CHANNEL_UI.whatsapp.initial,
      website: "",
    },
  });
  const [done, setDone] = useState(false);
  const thanksRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (done) thanksRef.current?.focus();
  }, [done]);

  const channel = watch("channel");
  const ui = CHANNEL_UI[channel];

  async function submit(values: FormValues) {
    let response: Response;
    try {
      response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          channel: values.channel,
          contact: values.contact,
          website: values.website,
          ...attribution,
        }),
      });
    } catch {
      setError("root", { message: OFFLINE_MESSAGE });
      return;
    }
    if (response.status === 204) {
      setDone(true);
      void celebrate();
      return;
    }
    const { detail, fieldErrors } = await readProblem(
      response,
      FALLBACK_MESSAGE,
    );
    const [pointer, message] = Object.entries(fieldErrors)[0] ?? [];
    const field = pointer ? FIELD_BY_POINTER.get(pointer) : undefined;
    if (field && message) setError(field, { message });
    else setError("root", { message: detail });
  }

  function guarded(event: React.FormEvent<HTMLFormElement>) {
    if (isSubmitting) {
      event.preventDefault();
      return;
    }
    return handleSubmit(submit)(event);
  }

  if (done)
    return (
      <div ref={thanksRef} tabIndex={-1} className="outline-none">
        <h2 className="text-2xl leading-tight font-extrabold tracking-[-0.02em] text-balance">
          Pronto, você está na lista!
        </h2>
        <p className="mt-2 text-ink-soft">Vamos entrar em contato em breve.</p>
        {storeHref && (
          <a
            href={storeHref}
            className="mt-6 inline-flex h-11 items-center rounded-full border border-line bg-surface px-5 text-sm font-semibold hover:border-ink/40"
          >
            Voltar para a loja
          </a>
        )}
      </div>
    );

  return (
    <form onSubmit={guarded} noValidate className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-bold">Entre na lista</h2>
        <p className="mt-1 text-sm text-ink-soft">Leva menos de um minuto.</p>
      </div>
      <Field
        label="Seu nome"
        htmlFor="waitlist-name"
        error={errors.name?.message}
      >
        <input
          id="waitlist-name"
          autoComplete="name"
          autoCapitalize="words"
          spellCheck={false}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? "waitlist-name-error" : undefined}
          className={inputClass}
          {...register("name")}
        />
      </Field>
      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold">
          Como prefere receber o contato?
        </legend>
        <div className="grid h-11 grid-cols-2 rounded-full bg-paper p-1 ring-1 ring-line ring-inset">
          {WAITLIST_CHANNELS.map((value) => (
            <label
              key={value}
              className="flex cursor-pointer items-center justify-center rounded-full px-4 text-sm font-semibold text-ink-soft transition-colors duration-150 ease-out hover:text-ink has-[:checked]:bg-surface has-[:checked]:text-ink has-[:checked]:shadow-sm has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-focus"
            >
              <input
                type="radio"
                className="sr-only"
                value={value}
                {...register("channel", {
                  onChange: (event) => {
                    setValue(
                      "contact",
                      CHANNEL_UI[event.target.value as WaitlistChannel].initial,
                    );
                    clearErrors("contact");
                  },
                })}
              />
              {CHANNEL_UI[value].optionLabel}
            </label>
          ))}
        </div>
      </fieldset>
      <Field
        label={ui.label}
        htmlFor="waitlist-contact"
        error={errors.contact?.message}
      >
        <input
          key={channel}
          id="waitlist-contact"
          defaultValue={ui.initial}
          type={ui.type}
          inputMode={ui.type}
          spellCheck={false}
          autoComplete={ui.type === "tel" ? "tel" : "email"}
          aria-invalid={Boolean(errors.contact)}
          aria-describedby={
            errors.contact ? "waitlist-contact-error" : undefined
          }
          className={inputClass}
          {...register("contact")}
        />
      </Field>
      <div aria-hidden="true" className="absolute -left-[9999px]">
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          {...register("website")}
        />
      </div>
      {errors.root && (
        <p
          role="alert"
          className="rounded-md bg-stamp/10 px-3 py-2 text-sm text-stamp"
        >
          {errors.root.message}
        </p>
      )}
      <div className="mt-1 flex flex-col gap-3">
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? "Enviando..." : "Entrar na lista"}
        </Button>
        <p className="text-xs leading-relaxed text-pretty text-muted">
          Usamos seu nome e contato só para falar com você sobre o lançamento do
          closeout. Ao enviar, você concorda com isso.
        </p>
      </div>
    </form>
  );
}
