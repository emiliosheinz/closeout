"use client";

import { useEffect } from "react";

export function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60dvh] max-w-xl flex-col justify-center px-4">
      <h1 className="text-3xl font-extrabold">A administração não carregou</h1>
      <p className="mt-3 text-ink-soft">
        O servidor não respondeu. Seus dados continuam salvos; tente de novo em
        alguns segundos.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex h-11 w-fit items-center rounded-full bg-ink px-5 text-sm font-semibold text-surface hover:bg-ink-soft"
      >
        Tentar de novo
      </button>
    </main>
  );
}
