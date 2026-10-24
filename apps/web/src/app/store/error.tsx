"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import { storePath } from "@/shared/lib/site";

export default function CatalogError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { slug } = useParams<{ slug: string }>();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60dvh] max-w-xl flex-col justify-center px-4">
      <h1 className="text-3xl font-extrabold">Esta página não carregou</h1>
      <p className="mt-3 text-ink-soft">
        Algo falhou do nosso lado. Tente de novo em alguns segundos.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-11 w-fit items-center rounded-full bg-ink px-5 text-sm font-semibold text-surface hover:bg-ink-soft"
        >
          Tentar de novo
        </button>
        <Link
          href={storePath(slug)}
          className="inline-flex h-11 items-center px-3 text-sm font-medium underline decoration-ink/30 underline-offset-4"
        >
          Voltar ao catálogo
        </Link>
      </div>
    </main>
  );
}
