import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-xl flex-col justify-center px-4">
      <p className="text-sm font-semibold text-muted">Erro 404</p>
      <h1 className="mt-2 text-4xl font-extrabold">Página não encontrada</h1>
      <p className="mt-3 text-ink-soft">
        O item pode ter saído do catálogo ou o link está incompleto. Os outros
        itens continuam à venda.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-11 w-fit items-center rounded-full bg-ink px-5 text-sm font-semibold text-surface hover:bg-ink-soft"
      >
        Ver o catálogo
      </Link>
    </main>
  );
}
