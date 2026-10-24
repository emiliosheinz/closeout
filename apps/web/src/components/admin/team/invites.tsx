"use client";

import { RefreshCw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiError, api } from "@/lib/admin/client-api";
import type {
  AssignableRole,
  IssuedInvite,
  PendingInvite,
} from "@/lib/admin/types";
import { formatDate, ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/format";
import { ConfirmDialog } from "../confirm-dialog";
import { Field, inputClass } from "../field";
import { InviteLinkDialog, type ShownInvite } from "./invite-link-dialog";

const ROLES: AssignableRole[] = ["seller", "admin"];

function InviteForm({
  storeId,
  onIssued,
}: {
  storeId: string;
  onIssued: (issued: IssuedInvite) => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AssignableRole>("seller");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const issued = await api<IssuedInvite>(
        "POST",
        `/stores/${storeId}/invites`,
        { email, role },
      );
      setEmail("");
      onIssued(issued);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Não foi possível convidar.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-5 rounded-xl border border-line bg-surface p-5"
    >
      <Field label="E-mail da pessoa" htmlFor="invite-email" error={error}>
        <input
          id="invite-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="off"
          placeholder="nome@exemplo.com"
          aria-invalid={Boolean(error)}
          className={inputClass}
        />
      </Field>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Papel</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {ROLES.map((value) => (
            <label
              key={value}
              className="flex min-h-11 cursor-pointer flex-col gap-0.5 rounded-lg border border-line bg-surface px-3.5 py-2.5 has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-surface has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-focus"
            >
              <input
                type="radio"
                name="invite-role"
                value={value}
                checked={role === value}
                onChange={() => setRole(value)}
                className="sr-only"
              />
              <span className="text-sm font-semibold">
                {ROLE_LABELS[value]}
              </span>
              <span className="text-xs opacity-80">
                {ROLE_DESCRIPTIONS[value]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Criando convite..." : "Criar convite"}
        </Button>
      </div>
    </form>
  );
}

function InviteRow({
  storeId,
  invite,
  onIssued,
}: {
  storeId: string;
  invite: PendingInvite;
  onIssued: (issued: IssuedInvite) => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const base = `/stores/${storeId}/invites/${invite.id}`;

  async function regenerate() {
    setPending(true);
    setError(null);
    try {
      onIssued(await api<IssuedInvite>("POST", `${base}/regenerate`));
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Não foi possível gerar.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate font-semibold">{invite.email}</p>
        <p className="mt-0.5 text-sm text-muted">
          {ROLE_LABELS[invite.role]}, vale até {formatDate(invite.expiresAt)}
        </p>
        {error && (
          <p role="alert" className="mt-1 text-sm font-medium text-stamp">
            {error}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={regenerate}
          disabled={pending}
          aria-label={`Gerar novo link para ${invite.email}`}
        >
          <RefreshCw aria-hidden="true" />
          {pending ? "Gerando..." : "Gerar novo link"}
        </Button>
        <ConfirmDialog
          title={`Revogar o convite de ${invite.email}?`}
          description="O link para de funcionar na hora. Dá para convidar de novo quando quiser."
          confirmLabel="Revogar convite"
          pendingLabel="Revogando..."
          onConfirm={async () => {
            await api("DELETE", base);
            router.refresh();
          }}
          trigger={(open) => (
            <Button
              type="button"
              variant="ghost"
              onClick={open}
              className="text-stamp"
              aria-label={`Revogar convite de ${invite.email}`}
            >
              <X aria-hidden="true" />
              Revogar
            </Button>
          )}
        />
      </div>
    </li>
  );
}

/** Invite form, pending invites, and the one-time link dialog. Managers only. */
export function Invites({
  storeId,
  invites,
}: {
  storeId: string;
  invites: PendingInvite[];
}) {
  const router = useRouter();
  const [shown, setShown] = useState<ShownInvite | null>(null);

  function show(issued: IssuedInvite) {
    setShown({ email: issued.invite.email, link: issued.link });
    router.refresh();
  }

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
        <InviteForm storeId={storeId} onIssued={show} />
        <div>
          <h3 className="text-sm font-semibold">Convites pendentes</h3>
          {invites.length === 0 ? (
            <p className="mt-2 rounded-xl border border-dashed border-line px-5 py-8 text-center text-ink-soft">
              Nenhum convite pendente. Quem você convidar aparece aqui até
              aceitar.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-line rounded-xl border border-line bg-surface">
              {invites.map((invite) => (
                <InviteRow
                  key={invite.id}
                  storeId={storeId}
                  invite={invite}
                  onIssued={show}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
      <InviteLinkDialog invite={shown} onClose={() => setShown(null)} />
    </>
  );
}
