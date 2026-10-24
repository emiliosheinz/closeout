"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "./field";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        // Keeps the Origin the handler checks even if the document arrived
        // with a no-referrer policy (the invite page sets one).
        referrerPolicy: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      if (response.ok) {
        window.location.assign("/admin");
        return;
      }
      const body = (await response.json().catch(() => ({}))) as {
        message?: string;
      };
      setError(body.message ?? "Não foi possível entrar agora.");
    } catch {
      setError("Sem conexão. Verifique a internet e tente de novo.");
    }
    setPending(false);
  }

  return (
    <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
      <Field label="E-mail" htmlFor="email">
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className={inputClass}
        />
      </Field>
      <Field label="Senha" htmlFor="password">
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </Field>
      {error && (
        <p
          role="alert"
          className="rounded-md bg-stamp/10 px-3 py-2 text-sm text-stamp"
        >
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="mt-2">
        {pending ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  );
}
