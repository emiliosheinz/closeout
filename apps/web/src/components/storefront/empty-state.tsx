import { PackageOpen } from "lucide-react";
import Link from "next/link";

export function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-xl border border-dashed border-tape/60 bg-surface/60 px-6 py-12 sm:items-center sm:text-center">
      <PackageOpen
        className="size-10 text-tape"
        strokeWidth={1.5}
        aria-hidden="true"
      />
      {filtered ? (
        <>
          <div>
            <h2 className="text-xl font-bold">
              Nada por aqui com esses filtros
            </h2>
            <p className="mt-1 max-w-[46ch] text-ink-soft">
              Tente outra palavra ou tire alguns filtros. Se procura algo
              específico, pergunte pra gente: pode estar numa caixa ainda.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex h-11 items-center rounded-full bg-ink px-5 text-sm font-semibold text-surface hover:bg-ink-soft"
          >
            Ver todos os itens
          </Link>
        </>
      ) : (
        <div>
          <h2 className="text-xl font-bold">Ainda estamos fotografando tudo</h2>
          <p className="mt-1 max-w-[46ch] text-ink-soft">
            Os primeiros itens aparecem aqui em breve. Volte daqui a pouco.
          </p>
        </div>
      )}
    </div>
  );
}
