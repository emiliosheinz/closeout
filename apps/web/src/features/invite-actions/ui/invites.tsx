"use client";

import {
  inviteRequestSchema,
  issuedInviteSchema,
} from "@closeout/contracts/schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Mail, Plus } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import {
  type IssuedInvite,
  inviteKeys,
  type PendingInvite,
} from "@/entities/invite";
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
import { InviteLinkDialog, type ShownInvite } from "./invite-link-dialog";

type InviteRequest = z.infer<typeof inviteRequestSchema>;

function toShown(issued: IssuedInvite): ShownInvite {
  return { email: issued.invite.email, link: issued.link };
}

/** "Convidar pessoas": the invite form in a dialog, then the one-time link. */
export function InviteButton({ storeId }: { storeId: string }) {
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
          }}
        />
      )}
      <InviteLinkDialog invite={shown} onClose={() => setShown(null)} />
    </>
  );
}

/** Messages the API writes about the email; anything else is a toast. */
function isFieldError(error: unknown): boolean {
  return (
    error instanceof ApiError && (error.status === 400 || error.status === 409)
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
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm<InviteRequest>({
    resolver: zodResolver(inviteRequestSchema),
    defaultValues: { email: "", role: "seller" },
  });
  const issue = useMutation({
    mutationFn: (values: InviteRequest) =>
      apiParsed(
        "POST",
        `/stores/${storeId}/invites`,
        values,
        issuedInviteSchema,
      ),
    meta: {
      invalidates: [inviteKeys.pending(storeId)],
      handlesError: isFieldError,
    },
  });

  function submit(values: InviteRequest) {
    issue.mutate(values, {
      onSuccess: (issued) => onIssued(issued.parsed ? issued.data : null),
      onError: (error) => {
        if (isFieldError(error)) setError("email", { message: error.message });
      },
    });
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
        <form onSubmit={handleSubmit(submit)} noValidate>
          <div className="flex flex-col gap-5 px-6 py-5">
            <Field
              label="E-mail da pessoa"
              htmlFor="invite-email"
              error={errors.email?.message}
            >
              <input
                id="invite-email"
                type="email"
                autoComplete="off"
                placeholder="nome@exemplo.com"
                aria-invalid={Boolean(errors.email)}
                aria-describedby={
                  errors.email ? "invite-email-error" : undefined
                }
                className={inputClass}
                {...register("email")}
              />
            </Field>
            <div className="flex flex-col gap-1.5">
              <span aria-hidden="true" className="text-sm font-semibold">
                Papel
              </span>
              <Controller
                control={control}
                name="role"
                render={({ field }) => (
                  <>
                    <RoleToggle
                      name="invite-role"
                      label="Papel"
                      value={field.value}
                      onChange={field.onChange}
                      className="w-full"
                    />
                    <p className="text-xs text-muted">
                      {ROLE_DESCRIPTIONS[field.value]}
                    </p>
                  </>
                )}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-line bg-paper/70 px-6 py-3.5">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={issue.isPending}>
              {issue.isPending ? "Criando convite..." : "Criar convite"}
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
  const [shown, setShown] = useState<ShownInvite | null>(null);
  const base = `/stores/${storeId}/invites/${invite.id}`;
  const invalidates = [inviteKeys.pending(storeId)];
  const regenerate = useMutation({
    mutationFn: () =>
      apiParsed("POST", `${base}/regenerate`, undefined, issuedInviteSchema),
    meta: { invalidates },
  });
  const revoke = useMutation({
    mutationFn: () => api("DELETE", base),
    meta: { success: "Convite revogado.", invalidates },
  });

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
          onConfirm={() => revoke.mutateAsync()}
          trigger={(confirmRevoke) => (
            <ActionsMenu label={`Ações para o convite de ${invite.email}`}>
              <ActionsMenuItem
                onSelect={() =>
                  regenerate.mutate(undefined, {
                    onSuccess: (issued) => {
                      if (issued.parsed) setShown(toShown(issued.data));
                    },
                  })
                }
              >
                Gerar novo link
              </ActionsMenuItem>
              <ActionsMenuItem
                onSelect={confirmRevoke}
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
