"use client";

import type { AssignableRole } from "@closeout/contracts/enums";
import { issuedInviteSchema } from "@closeout/contracts/schemas";
import { Mail, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { IssuedInvite, PendingInvite } from "@/entities/invite";
import { RoleToggle } from "@/entities/member";
import { ApiError, api, apiParsed } from "@/shared/api";
import {
  formatDate,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
} from "@/shared/lib/format";
import { ActionsMenu, ActionsMenuItem } from "@/shared/ui/actions-menu";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Field, inputClass } from "@/shared/ui/field";
import { notifyFailure } from "@/shared/ui/sonner";
import { InviteLinkDialog, type ShownInvite } from "./invite-link-dialog";

function toShown(issued: IssuedInvite): ShownInvite {
  return { email: issued.invite.email, link: issued.link };
}

/** "Convidar pessoas": the invite form in a dialog, then the one-time link. */
export function InviteButton({ storeId }: { storeId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState<ShownInvite | null>(null);

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus aria-hidden="true" />
        Convidar pessoas
      </Button>
      {open && (
        <InviteDialog
          storeId={storeId}
          onClose={() => setOpen(false)}
          onIssued={(issued) => {
            setOpen(false);
            if (issued) setShown(toShown(issued));
            router.refresh();
          }}
        />
      )}
      <InviteLinkDialog invite={shown} onClose={() => setShown(null)} />
    </>
  );
}

function InviteDialog({
  storeId,
  onClose,
  onIssued,
}: {
  storeId: string;
  onClose: () => void;
  /** Null when the API created the invite but its link could not be read. */
  onIssued: (issued: IssuedInvite | null) => void;
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
      const issued = await apiParsed(
        "POST",
        `/stores/${storeId}/invites`,
        { email, role },
        issuedInviteSchema,
      );
      if (issued.parsed) onIssued(issued.data);
      else onIssued(null);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Não foi possível convidar.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-lg overflow-hidden p-0">
        <div className="border-b border-line px-6 py-4">
          <DialogTitle className="font-bold">Convidar pessoas</DialogTitle>
          <DialogDescription className="text-sm text-muted">
            Gere um link e mande para a pessoa. Ela cria a própria senha e entra
            direto na loja.
          </DialogDescription>
        </div>
        <form onSubmit={submit} noValidate>
          <div className="flex flex-col gap-5 px-6 py-5">
            <Field
              label="E-mail da pessoa"
              htmlFor="invite-email"
              error={error}
            >
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
            <div className="flex flex-col gap-1.5">
              <span aria-hidden="true" className="text-sm font-semibold">
                Papel
              </span>
              <RoleToggle
                name="invite-role"
                label="Papel"
                value={role}
                onChange={setRole}
                className="w-full"
              />
              <p className="text-xs text-muted">{ROLE_DESCRIPTIONS[role]}</p>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-line bg-paper/70 px-6 py-3.5">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Criando convite..." : "Criar convite"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InviteRow({
  storeId,
  invite,
}: {
  storeId: string;
  invite: PendingInvite;
}) {
  const router = useRouter();
  const [shown, setShown] = useState<ShownInvite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const base = `/stores/${storeId}/invites/${invite.id}`;

  async function regenerate() {
    setError(null);
    try {
      const issued = await apiParsed(
        "POST",
        `${base}/regenerate`,
        undefined,
        issuedInviteSchema,
      );
      if (issued.parsed) setShown(toShown(issued.data));
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Não foi possível gerar.",
      );
    }
  }

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 px-4 py-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,1.2fr)_auto] sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-dashed border-line-strong text-muted"
        >
          <Mail className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold">{invite.email}</p>
          <p className="truncate text-sm text-muted sm:hidden">
            {ROLE_LABELS[invite.role]}, vale até {formatDate(invite.expiresAt)}
          </p>
          {error && (
            <p role="alert" className="text-sm font-medium text-stamp">
              {error}
            </p>
          )}
        </div>
      </div>
      <span className="hidden truncate text-sm text-ink-soft sm:block">
        {ROLE_LABELS[invite.role]}
      </span>
      <span className="hidden truncate text-sm text-muted sm:block">
        Vale até {formatDate(invite.expiresAt)}
      </span>
      <div>
        <ConfirmDialog
          title={`Revogar o convite de ${invite.email}?`}
          description="O link para de funcionar na hora. Dá para convidar de novo quando quiser."
          confirmLabel="Revogar convite"
          pendingLabel="Revogando..."
          onSuccess={() => document.getElementById("team-invites")?.focus()}
          onConfirm={async () => {
            await api("DELETE", base).catch(notifyFailure);
            router.refresh();
          }}
          trigger={(revoke) => (
            <ActionsMenu label={`Ações para o convite de ${invite.email}`}>
              <ActionsMenuItem onSelect={regenerate}>
                Gerar novo link
              </ActionsMenuItem>
              <ActionsMenuItem
                onSelect={revoke}
                className="text-stamp focus:bg-stamp/10 focus:text-stamp"
              >
                Revogar
              </ActionsMenuItem>
            </ActionsMenu>
          )}
        />
      </div>
      <InviteLinkDialog invite={shown} onClose={() => setShown(null)} />
    </li>
  );
}

/** Pending invites as rows, or a one-line note when there are none. */
export function PendingInvites({
  storeId,
  invites,
}: {
  storeId: string;
  invites: PendingInvite[];
}) {
  if (invites.length === 0) {
    return (
      <p className="rounded-xl border border-line bg-surface px-5 py-4 text-sm text-muted">
        Nenhum convite pendente. Quem você convidar aparece aqui até aceitar.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
      {invites.map((invite) => (
        <InviteRow key={invite.id} storeId={storeId} invite={invite} />
      ))}
    </ul>
  );
}
