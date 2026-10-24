import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/login-form";
import { getMe } from "@/lib/admin/server-api";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  // An unreachable API must not take the login form down with it.
  const me = erro === "sem-acesso" ? null : await getMe().catch(() => null);
  if (me) redirect("/admin");
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-12">
      <h1 className="text-3xl font-extrabold">Entrar</h1>
      <p className="mt-2 text-ink-soft">
        Área de quem está vendendo. Para comprar não precisa de conta: abra o
        link da loja que recebeu.
      </p>
      {erro === "sem-acesso" && (
        <p
          role="alert"
          className="mt-4 rounded-md bg-stamp/10 px-3 py-2 text-sm text-stamp"
        >
          Esta conta não administra esta loja.
        </p>
      )}
      <LoginForm />
    </main>
  );
}
