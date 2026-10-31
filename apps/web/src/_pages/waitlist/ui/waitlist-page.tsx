import type { Metadata } from "next";
import { getStore } from "@/entities/listing/index.server";
import { storePath } from "@/shared/lib/site";
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
      <div className="mt-10 max-w-xl sm:mt-16">
        <h1 className="text-4xl font-extrabold tracking-[-0.03em] text-balance sm:text-5xl">
          Quer vender seus desapegos?
        </h1>
        <p className="mt-3 mb-8 text-lg text-ink-soft">
          Deixe seu nome e um contato. Avisamos quando o closeout abrir para
          novas lojas.
        </p>
        <div className="rounded-xl border border-line bg-surface p-5 sm:p-6">
          <WaitlistForm attribution={attribution} storeHref={storeHref} />
        </div>
      </div>
    </main>
  );
}
