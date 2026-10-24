"use client";

import { Mail, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { IssuedInvite, PendingInvite } from "@/entities/invite";
import { ApiError, api } from "@/shared/api";
import type { AssignableRole } from "@/shared/config/enums";
import {
  formatDate,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
} from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/shared/ui/dialog";
import { ConfirmDialog } from "../confirm-dialog";
import { Field, inputClass } from "../field";
import { InviteLinkDialog, type ShownInvite } from "./invite-link-dialog";
import { RoleToggle } from "./role-toggle";
import { RowMenu } from "./row-menu";

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
            setShown(toShown(issued));
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
      onIssued(
        await api<IssuedInvite>("POST", `/stores/${storeId}/invites`, {
          email,
          role,
        }),
      );
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
      setShown(toShown(await api<IssuedInvite>("POST", `${base}/regenerate`)));
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
          onConfirm={async () => {
            await api("DELETE", base);
            router.refresh();
          }}
          trigger={(revoke) => (
            <RowMenu
              label={`Ações para o convite de ${invite.email}`}
              items={[
                { label: "Gerar novo link", onSelect: regenerate },
                { label: "Revogar", onSelect: revoke, destructive: true },
              ]}
            />
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
