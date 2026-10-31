import type { Metadata } from "next";
import { getStore } from "@/entities/listing/index.server";
import { storePath } from "@/shared/lib/site";
import { Toaster } from "@/shared/ui/sonner";
import { parseSignupAttribution } from "../model/signup-attribution";
import { WaitlistForm } from "./waitlist-form";

export const metadata: Metadata = {
  title: "Lista de espera",
  description:
    "Quer vender seus desapegos numa loja como esta? Entre na lista de espera do closeout.",
};

async function findStoreHref(ref: string | undefined) {
  if (!ref) return undefined;
  try {
    return (await getStore(ref)) ? storePath(ref) : undefined;
  } catch (error) {
    console.error(
      "waitlist store check failed:",
      error instanceof Error ? error.message : String(error),
    );
    return undefined;
  }
}

/** Public signup page; `ref` and `src` in the query say where the visitor came from. */
export async function WaitlistPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const attribution = parseSignupAttribution(await searchParams);
  const storeHref = await findStoreHref(attribution.ref);

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col px-4 pt-8 pb-12 sm:px-8 sm:pt-12">
      <a
        href="/"
        className="inline-flex h-11 w-fit items-center text-lg font-extrabold tracking-[-0.04em]"
      >
        closeout
      </a>
      <div className="mt-10 grid gap-10 sm:mt-16 lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-16">
        <div>
          <div className="relative w-fit max-w-full pr-10 sm:pr-14">
            <h1 className="text-[clamp(2.75rem,11vw,3.75rem)] leading-[0.95] font-extrabold tracking-[-0.04em] text-balance">
              <span className="sm:block">Quer vender</span>{" "}
              <span className="sm:block sm:whitespace-nowrap">
                seus desapegos?
              </span>
            </h1>
            <span
              aria-hidden="true"
              className="absolute -top-6 right-0 inline-flex size-16 rotate-12 items-center justify-center rounded-full bg-sticker p-2 text-center font-marker text-sm leading-tight text-sticker-ink shadow-[0_1px_0_rgba(0,0,0,0.12),0_10px_22px_-10px_rgba(23,32,43,0.55)] ring-1 ring-black/5 motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:spin-in-12 motion-safe:duration-500 sm:-top-10 sm:-right-4 sm:size-20 sm:text-base"
            >
              Em breve
            </span>
          </div>
          <p className="mt-6 max-w-[40ch] text-lg leading-relaxed text-pretty text-ink-soft sm:text-xl">
            Deixe seu nome e um contato. Avisamos quando o closeout abrir para
            novas lojas.
          </p>
          <div className="mt-8 max-w-[44ch] border-l-4 border-sticker pl-4">
            <p className="font-semibold">Sem compromisso</p>
            <p className="mt-1 text-ink-soft">
              A gente fala com você pelo canal que escolher, sem mensagens
              automáticas.
            </p>
          </div>
        </div>

        <div className="h-fit rounded-xl border border-line bg-surface p-5 sm:p-6">
          <WaitlistForm attribution={attribution} storeHref={storeHref} />
        </div>
      </div>
      <Toaster />
    </main>
  );
}
