"use client";

import {
  LOGIN_FAILED,
  type LoginRequest,
  loginRequestSchema,
} from "@closeout/contracts/schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { readProblem } from "@/shared/api";
import { Button } from "@/shared/ui/button";
import { Field, inputClass } from "@/shared/ui/field";

const NETWORK_MESSAGE = "Sem conexão. Verifique a internet e tente de novo.";

export function LoginForm() {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<LoginRequest>({
    resolver: zodResolver(loginRequestSchema),
    defaultValues: { email: "", password: "" },
  });

  const pending = isSubmitting || isSubmitSuccessful;

  async function submit(values: LoginRequest) {
    let response: Response;
    try {
      response = await fetch("/api/auth/login", {
        method: "POST",
        // Keeps the Origin the handler checks even if the document arrived
        // with a no-referrer policy (the invite page sets one).
        referrerPolicy: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
    } catch {
      setError("root", { message: NETWORK_MESSAGE });
      return;
    }
    if (response.ok) {
      // A full navigation drops any cache left by a previous session.
      window.location.assign("/admin");
      return;
    }
    const { detail } = await readProblem(response, LOGIN_FAILED);
    setError("root", { message: detail });
  }

  function guarded(event: React.FormEvent<HTMLFormElement>) {
    if (pending) {
      event.preventDefault();
      return;
    }
    return handleSubmit(submit)(event);
  }

  return (
    <form onSubmit={guarded} noValidate className="mt-8 flex flex-col gap-4">
      <Field label="E-mail" htmlFor="email" error={errors.email?.message}>
        <input
          id="email"
          type="email"
          autoComplete="username"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "email-error" : undefined}
          className={inputClass}
          {...register("email")}
        />
      </Field>
      <Field label="Senha" htmlFor="password" error={errors.password?.message}>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? "password-error" : undefined}
          className={inputClass}
          {...register("password")}
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
      <Button type="submit" disabled={pending} className="mt-2">
        {pending ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  );
}
