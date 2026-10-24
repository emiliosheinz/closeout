"use client";

import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { Field, inputClass } from "@/shared/ui/field";

const NAME_MESSAGE = "Informe seu nome.";
const PASSWORD_MESSAGE = "A senha precisa ter pelo menos 10 caracteres.";
const MIN_PASSWORD_LENGTH = 10;

interface Errors {
  name?: string;
  password?: string;
  whatsappNumber?: string;
  form?: string;
}

/** Sorts the API's messages onto the fields they are about. */
function errorsFrom(message: unknown): Errors {
  const messages = (Array.isArray(message) ? message : [message]).filter(
    (m): m is string => typeof m === "string",
  );
  const errors: Errors = {};
  const rest: string[] = [];
  for (const text of messages) {
    if (text === NAME_MESSAGE) errors.name = text;
    else if (text === PASSWORD_MESSAGE) errors.password = text;
    else if (text.includes("WhatsApp")) errors.whatsappNumber = text;
    else rest.push(text);
  }
  if (rest.length > 0) errors.form = rest.join(" ");
  if (Object.keys(errors).length === 0) {
    errors.form = "Não foi possível aceitar o convite agora.";
  }
  return errors;
}

/** Creates the invitee's account; on success the new session opens the admin. */
export function InviteForm({ token, email }: { token: string; email: string }) {
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "");
    const password = String(form.get("password") ?? "");
    const local: Errors = {};
    if (!name.trim()) local.name = NAME_MESSAGE;
    if (password.length < MIN_PASSWORD_LENGTH)
      local.password = PASSWORD_MESSAGE;
    setErrors(local);
    if (Object.keys(local).length > 0) return;

    setPending(true);
    try {
      const response = await fetch("/api/auth/invite", {
        method: "POST",
        // The page sends no referrer, which would also blank the Origin the
        // handler checks; same-origin keeps both private to this site.
        referrerPolicy: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          name,
          password,
          whatsappNumber: String(form.get("whatsappNumber") ?? ""),
        }),
      });
      if (response.ok) {
        window.location.assign("/admin");
        return;
      }
      const body = (await response.json().catch(() => ({}))) as {
        message?: unknown;
      };
      setErrors(errorsFrom(body.message));
    } catch {
      setErrors({ form: "Sem conexão. Verifique a internet e tente de novo." });
    }
    setPending(false);
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <Field
        label="E-mail"
        htmlFor="invite-email"
        hint="É o e-mail do convite. Você vai usá-lo para entrar."
      >
        <input
          id="invite-email"
          name="email"
          type="email"
          value={email}
          readOnly
          autoComplete="username"
          className={`${inputClass} bg-paper text-ink-soft`}
        />
      </Field>
      <Field
        label="Seu nome"
        htmlFor="invite-name"
        hint="Aparece nos seus anúncios, para quem compra."
        error={errors.name}
      >
        <input
          id="invite-name"
          name="name"
          autoComplete="name"
          maxLength={60}
          aria-invalid={Boolean(errors.name)}
          className={inputClass}
        />
      </Field>
      <Field
        label="Senha"
        htmlFor="invite-password"
        hint="Pelo menos 10 caracteres."
        error={errors.password}
      >
        <input
          id="invite-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          maxLength={200}
          aria-invalid={Boolean(errors.password)}
          className={inputClass}
        />
      </Field>
      <Field
        label="WhatsApp (opcional)"
        htmlFor="invite-whatsapp"
        hint="Com + e código do país, por exemplo +55 11 99999-8888. Sem ele, seus anúncios aparecem sem botão de contato."
        error={errors.whatsappNumber}
      >
        <input
          id="invite-whatsapp"
          name="whatsappNumber"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+55 11 99999-8888"
          aria-invalid={Boolean(errors.whatsappNumber)}
          className={inputClass}
        />
      </Field>
      {errors.form && (
        <p
          role="alert"
          className="rounded-md bg-stamp/10 px-3 py-2 text-sm text-stamp"
        >
          {errors.form}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending} className="mt-1">
        {pending ? "Criando sua conta..." : "Criar conta e entrar"}
      </Button>
    </form>
  );
}
