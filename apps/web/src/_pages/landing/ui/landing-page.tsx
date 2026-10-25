import type { Metadata } from "next";
import Link from "next/link";

const DESCRIPTION =
  "Uma vitrine própria para vender o que você não usa mais. Fotografe, compartilhe o link e receba os interessados no WhatsApp.";

export const metadata: Metadata = {
  title: "closeout",
  description: DESCRIPTION,
};

const STEPS = [
  "Fotografe o item e dê um preço.",
  "Compartilhe o link da sua loja com quem pode comprar.",
  "Quem gostou chama você no WhatsApp, já com o item na mensagem.",
];

/** Site root: what closeout is, for people who manage a store. Lists no stores. */
export function LandingPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col px-4 pt-12 pb-10 sm:px-8 sm:pt-20">
      <div className="relative w-fit">
        <h1 className="text-[clamp(3.5rem,19vw,11rem)] leading-[0.85] font-extrabold tracking-[-0.055em]">
          closeout
        </h1>
        <span
          aria-hidden="true"
          className="absolute -top-10 -right-16 inline-flex size-20 rotate-12 items-center justify-center rounded-full bg-sticker p-2 text-center font-marker text-[0.8rem] leading-tight text-sticker-ink shadow-[0_1px_0_rgba(0,0,0,0.12),0_10px_22px_-10px_rgba(23,32,43,0.55)] ring-1 ring-black/5 motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:spin-in-12 motion-safe:duration-500 sm:-top-14 sm:-right-24 sm:size-32 sm:text-xl"
        >
          Desapegou, vendeu
        </span>
      </div>

      <p className="mt-10 max-w-[34ch] text-[1.35rem] leading-snug font-semibold text-balance sm:mt-14 sm:text-3xl">
        Uma vitrine própria para vender o que você não usa mais, direto pelo
        WhatsApp.
      </p>
      <p className="mt-4 max-w-[52ch] leading-relaxed text-ink-soft">
        Para quem está de mudança, esvaziando a casa ou vendendo junto com a
        família ou os colegas: cada pessoa anuncia os próprios itens, e a loja
        mostra o que está disponível, reservado ou vendido.
      </p>

      <ol className="mt-10 grid max-w-3xl gap-6 sm:grid-cols-3 sm:gap-8">
        {STEPS.map((step, index) => (
          <li key={step} className="flex gap-3 sm:flex-col">
            <span
              aria-hidden="true"
              className="w-6 shrink-0 font-marker text-3xl leading-none text-tape"
            >
              {index + 1}
            </span>
            <span className="leading-snug">{step}</span>
          </li>
        ))}
      </ol>

      <div className="mt-12 flex flex-col items-start gap-3">
        <Link
          href="/admin/entrar"
          className="inline-flex h-12 items-center rounded-full bg-ink px-6 text-base font-semibold text-surface hover:bg-ink-soft"
        >
          Entrar para gerenciar sua loja
        </Link>
        <p className="text-sm text-muted">
          Quer comprar? Peça o link da loja a quem está vendendo.
        </p>
      </div>
    </main>
  );
}
