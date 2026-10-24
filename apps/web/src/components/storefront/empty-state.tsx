import { MessageCircle, PackageOpen } from "lucide-react";
import Link from "next/link";
import { storePath } from "@/shared/lib/site";

export function EmptyState({
  storeSlug,
  filtered,
  contactHref = null,
}: {
  storeSlug: string;
  filtered: boolean;
  /** WhatsApp link for "ask us", when the store has a reachable seller. */
  contactHref?: string | null;
}) {
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
          <div className="flex flex-wrap gap-2 sm:justify-center">
            <Link
              href={storePath(storeSlug)}
              className="inline-flex h-11 items-center rounded-full bg-ink px-5 text-sm font-semibold text-surface hover:bg-ink-soft"
            >
              Ver todos os itens
            </Link>
            {contactHref && (
              <a
                href={contactHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center gap-2 rounded-full border border-line bg-surface px-5 text-sm font-semibold hover:border-go/50"
              >
                <MessageCircle className="size-4 text-go" aria-hidden="true" />
                Perguntar no WhatsApp
              </a>
            )}
          </div>
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
