import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { NO_ACCESS_ERROR } from "@/entities/session";
import { getMe } from "@/entities/session/index.server";
import { waitlistPath } from "@/shared/lib/site";
import { Toaster } from "@/shared/ui/sonner";
import { LoginForm } from "./login-form";
import { LoginNoticeToast } from "./login-notice-toast";

export const metadata: Metadata = { title: "Entrar" };

export async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  // An unreachable API must not take the login form down with it.
  const me = error === NO_ACCESS_ERROR ? null : await getMe().catch(() => null);
  if (me) redirect("/admin");
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-12">
      <h1 className="text-3xl font-extrabold">Entrar</h1>
      <p className="mt-2 text-ink-soft">
        Área de quem está vendendo. Para comprar não precisa de conta: abra o
        link da loja que recebeu.
      </p>
      <LoginForm />
      <LoginNoticeToast error={error} />
      <Toaster />
      <p className="mt-8 border-t border-line pt-6 text-sm text-muted">
        Ainda não tem uma loja?{" "}
        <Link
          href={waitlistPath({ src: "login" })}
          className="font-semibold text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
        >
          Entre na lista de espera
        </Link>
        .
      </p>
    </main>
  );
}
