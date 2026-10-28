"use client";

import {
  acceptInviteRequestSchema,
  problemDocumentSchema,
} from "@closeout/contracts/schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/shared/ui/button";
import { Field, inputClass } from "@/shared/ui/field";

const FALLBACK_MESSAGE = "Não foi possível aceitar o convite agora.";

const formSchema = acceptInviteRequestSchema.extend({
  whatsappNumber: z.string(),
});
type FormValues = z.infer<typeof formSchema>;

type FieldName = "name" | "password" | "whatsappNumber";

const FIELD_BY_POINTER = new Map<string, FieldName>([
  ["/name", "name"],
  ["/password", "password"],
  ["/whatsappNumber", "whatsappNumber"],
]);

/** Creates the invitee's account; on success the new session opens the admin. */
export function InviteForm({ token, email }: { token: string; email: string }) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", password: "", whatsappNumber: "" },
  });

  const pending = isSubmitting || isSubmitSuccessful;

  async function submit(values: FormValues) {
    let response: Response;
    try {
      response = await fetch("/api/auth/invite", {
        method: "POST",
        // The page sends no referrer, which would also blank the Origin the
        // handler checks; same-origin keeps both private to this site.
        referrerPolicy: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...values }),
      });
    } catch {
      setError("root", {
        message: "Sem conexão. Verifique a internet e tente de novo.",
      });
      return;
    }
    if (response.ok) {
      // A full navigation drops any cache left by a previous session.
      window.location.assign("/admin");
      return;
    }
    const problem = problemDocumentSchema.safeParse(
      await response.json().catch(() => undefined),
    );
    if (!problem.success) {
      setError("root", { message: FALLBACK_MESSAGE });
      return;
    }
    const { detail, errors = [] } = problem.data;
    const placed = new Set<FieldName>();
    const unplaced: string[] = [];
    for (const error of errors) {
      const field = FIELD_BY_POINTER.get(error.pointer);
      if (!field) unplaced.push(error.detail);
      else if (!placed.has(field)) {
        placed.add(field);
        setError(field, { message: error.detail });
      }
    }
    if (errors.length === 0) setError("root", { message: detail });
    else if (unplaced.length > 0)
      setError("root", { message: unplaced.join(" ") });
  }

  function guarded(event: React.FormEvent<HTMLFormElement>) {
    if (pending) {
      event.preventDefault();
      return;
    }
    return handleSubmit(submit)(event);
  }

  return (
    <form onSubmit={guarded} noValidate className="flex flex-col gap-5">
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
        error={errors.name?.message}
        hint="Aparece nos seus anúncios, para quem compra."
      >
        <input
          id="invite-name"
          autoComplete="name"
          maxLength={60}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? "invite-name-error" : undefined}
          className={inputClass}
          {...register("name")}
        />
      </Field>
      <Field
        label="Senha"
        htmlFor="invite-password"
        error={errors.password?.message}
        hint="Pelo menos 10 caracteres."
      >
        <input
          id="invite-password"
          type="password"
          autoComplete="new-password"
          maxLength={200}
          aria-invalid={Boolean(errors.password)}
          aria-describedby={
            errors.password ? "invite-password-error" : undefined
          }
          className={inputClass}
          {...register("password")}
        />
      </Field>
      <Field
        label="WhatsApp (opcional)"
        htmlFor="invite-whatsapp"
        error={errors.whatsappNumber?.message}
        hint="Com + e código do país, por exemplo +55 11 99999-8888. Sem ele, seus anúncios aparecem sem botão de contato."
      >
        <input
          id="invite-whatsapp"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+55 11 99999-8888"
          aria-invalid={Boolean(errors.whatsappNumber)}
          aria-describedby={
            errors.whatsappNumber ? "invite-whatsapp-error" : undefined
          }
          className={inputClass}
          {...register("whatsappNumber")}
        />
      </Field>
      {errors.root && (
        <p
          role="alert"
          className="rounded-md bg-stamp/10 px-3 py-2 text-sm text-stamp"
        >
          {errors.root.message}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending} className="mt-1">
        {pending ? "Criando sua conta..." : "Criar conta e entrar"}
      </Button>
    </form>
  );
}
