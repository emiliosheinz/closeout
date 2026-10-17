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
  if (erro !== "sem-acesso" && (await getMe())) redirect("/admin");
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-12">
      <h1 className="text-3xl font-extrabold">Entrar</h1>
      <p className="mt-2 text-ink-soft">
        Área de quem está vendendo. Visitantes não precisam de conta.
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
