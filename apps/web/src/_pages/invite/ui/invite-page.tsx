import type { Metadata } from "next";
import { headers } from "next/headers";
import { getMe } from "@/entities/session/index.server";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/shared/lib/format";
import { lookupInvite } from "../model/lookup-invite";
import { InviteForm } from "./invite-form";
import { InviteSignOut } from "./invite-sign-out";

export const metadata: Metadata = {
  title: "Convite",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

const INVALID =
  "Este convite é inválido ou expirou. Peça um novo link a quem convidou você.";
const TOO_MANY = "Muitas tentativas. Tente novamente em alguns minutos.";

// Plain anchors, not next/link: a client-side navigation would keep this
// page's no-referrer policy on the next page and blank its POST Origin.
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col px-4 pt-8 pb-12 sm:px-8 sm:pt-12">
      <a
        href="/"
        className="inline-flex h-11 w-fit items-center text-lg font-extrabold tracking-[-0.04em]"
      >
        closeout
      </a>
      {children}
    </main>
  );
}

function Unavailable({ message }: { message: string }) {
  return (
    <Frame>
      <div className="my-auto max-w-xl py-12">
        <h1 className="text-4xl font-extrabold tracking-[-0.03em]">
          Convite indisponível
        </h1>
        <p className="mt-3 text-lg text-ink-soft">{message}</p>
        <a
          href="/admin/entrar"
          className="mt-6 inline-flex h-11 w-fit items-center rounded-full border border-line bg-surface px-5 text-sm font-semibold hover:border-ink/40"
        >
          Já tenho conta: entrar
        </a>
      </div>
    </Frame>
  );
}

/**
 * Where an invite link lands. Reveals the store and the invited email only
 * for a valid link; every invalid reason renders the same page.
 */
export async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const lookup = await lookupInvite(token, (await headers()).get("x-real-ip"));
  if (lookup.state === "invalid") return <Unavailable message={INVALID} />;
  if (lookup.state === "too-many") return <Unavailable message={TOO_MANY} />;

  const { invite } = lookup;
  // A cookie alone is not a session: a removed member's stale cookie answers
  // 401 here and counts as signed out, so they can accept a new invite.
  const me = await getMe();

  return (
    <Frame>
      <div className="mt-10 grid gap-10 sm:mt-16 lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-16">
        <div>
          <p className="text-lg font-semibold text-ink-soft">
            Você foi convidado(a) para a equipe de
          </p>
          <div className="relative mt-2 w-fit max-w-full pr-8 sm:pr-12">
            <h1 className="text-[clamp(2.75rem,11vw,5.5rem)] leading-[0.92] font-extrabold tracking-[-0.045em] text-balance break-words">
              {invite.storeName}
            </h1>
            <span
              aria-hidden="true"
              className="absolute top-1/2 right-0 -translate-y-1/2 sm:-top-10 sm:-right-4 sm:translate-y-0 inline-flex size-16 rotate-12 items-center justify-center rounded-full bg-sticker p-2 text-center font-marker text-sm leading-tight text-sticker-ink shadow-[0_1px_0_rgba(0,0,0,0.12),0_10px_22px_-10px_rgba(23,32,43,0.55)] ring-1 ring-black/5 motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:spin-in-12 motion-safe:duration-500 sm:size-20 sm:text-base"
            >
              Convite
            </span>
          </div>
          <div className="mt-8 max-w-[44ch] border-l-4 border-sticker pl-4">
            <p className="font-semibold">
              Você entra como {ROLE_LABELS[invite.role]}
            </p>
            <p className="mt-1 text-ink-soft">
              {ROLE_DESCRIPTIONS[invite.role]}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-5 sm:p-6">
          {me ? (
            <>
              <p className="font-semibold" role="status">
                Você está conectado como {me.user.email}. Saia para aceitar este
                convite.
              </p>
              <InviteSignOut />
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold">Crie sua conta</h2>
              <p className="mt-1 mb-5 text-sm text-ink-soft">
                Leva um minuto. Depois disso você entra direto na loja.
              </p>
              <InviteForm token={token} email={invite.email} />
            </>
          )}
        </div>
      </div>
    </Frame>
  );
}
