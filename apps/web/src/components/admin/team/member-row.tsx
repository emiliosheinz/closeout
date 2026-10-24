"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, api } from "@/lib/admin/client-api";
import type { TeamMember } from "@/lib/admin/types";
import type { AssignableRole } from "@/shared/config/enums";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
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
import { RoleToggle } from "./role-toggle";
import { RowMenu } from "./row-menu";

/** Shows a stored digits-only number the way people type it back. */
function displayNumber(number: string | null): string {
  return number ? `+${number}` : "";
}

/** Up to two initials for the avatar placeholder. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0], parts.at(-1)] : parts;
  return letters
    .map((part) => part?.[0] ?? "")
    .join("")
    .toUpperCase();
}

function Avatar({
  member,
  className,
}: {
  member: TeamMember;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink font-bold text-surface",
        className,
      )}
    >
      {member.avatarUrl ? (
        // biome-ignore lint/performance/noImgElement: pre-sized avatar variant.
        <img src={member.avatarUrl} alt="" className="size-full object-cover" />
      ) : (
        <span aria-hidden="true">{initials(member.displayName)}</span>
      )}
    </span>
  );
}

/**
 * One team member as a list row. Everyone on the team can open their own
 * contact profile; a manager can open anyone's, and for others who are not
 * the owner also change the role or remove them.
 */
export function MemberRow({
  storeId,
  member,
  isSelf,
  canManageTeam,
}: {
  storeId: string;
  member: TeamMember;
  isSelf: boolean;
  /** The viewer is a manager: others who are not the owner get controls. */
  canManageTeam: boolean;
}) {
  const canManage = canManageTeam && !isSelf && member.role !== "owner";
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const edit = { label: "Editar", onSelect: () => setEditing(true) };
  const menuLabel = `Ações para ${member.displayName}`;

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 px-4 py-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,1.2fr)_auto] sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar member={member} className="size-9 text-xs" />
        <div className="min-w-0">
          <p className="flex items-center gap-2">
            <span className="truncate font-semibold">{member.displayName}</span>
            {isSelf && canManageTeam && (
              <span className="shrink-0 rounded-md bg-paper px-1.5 py-0.5 text-xs font-medium text-ink-soft">
                Você
              </span>
            )}
          </p>
          <p className="truncate text-sm text-muted sm:hidden">
            {ROLE_LABELS[member.role]} · {member.email}
          </p>
        </div>
      </div>
      <span className="hidden truncate text-sm text-ink-soft sm:block">
        {ROLE_LABELS[member.role]}
      </span>
      <div className="hidden min-w-0 text-sm sm:block">
        <p className="truncate text-ink-soft">{member.email}</p>
        {member.whatsappNumber ? (
          <p className="truncate text-xs text-muted">
            {displayNumber(member.whatsappNumber)}
          </p>
        ) : (
          <p className="inline-flex items-center gap-1 text-xs font-medium text-stamp">
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full bg-stamp"
            />
            Sem WhatsApp
          </p>
        )}
      </div>
      {canManage ? (
        <ConfirmDialog
          title={`Remover ${member.displayName} da equipe?`}
          description="A conta é apagada e a pessoa perde o acesso na hora. Nos anúncios divididos com outra pessoa, fica quem continua na equipe."
          confirmLabel="Remover da equipe"
          pendingLabel="Removendo..."
          onConfirm={async () => {
            await api("DELETE", `/stores/${storeId}/members/${member.userId}`);
            router.refresh();
          }}
          trigger={(remove) => (
            <RowMenu
              label={menuLabel}
              items={[
                edit,
                { label: "Remover", onSelect: remove, destructive: true },
              ]}
            />
          )}
        />
      ) : (
        <RowMenu label={menuLabel} items={[edit]} />
      )}
      {editing && (
        <MemberDialog
          storeId={storeId}
          member={member}
          canChangeRole={canManage}
          onClose={() => setEditing(false)}
        />
      )}
    </li>
  );
}

function MemberDialog({
  storeId,
  member,
  canChangeRole,
  onClose,
}: {
  storeId: string;
  member: TeamMember;
  canChangeRole: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const initialRole: AssignableRole =
    member.role === "admin" ? "admin" : "seller";
  const [name, setName] = useState(member.displayName);
  const [number, setNumber] = useState(displayNumber(member.whatsappNumber));
  const [role, setRole] = useState(initialRole);
  const [error, setError] = useState<string | null>(null);
  const [photoStatus, setPhotoStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const profile = `/stores/${storeId}/sellers/${member.sellerId}`;
  const idPrefix = `member-${member.userId}`;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await api("PATCH", profile, {
        displayName: name,
        whatsappNumber: number,
      });
      if (canChangeRole && role !== initialRole) {
        await api("PATCH", `/stores/${storeId}/members/${member.userId}`, {
          role,
        });
      }
      onClose();
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Não foi possível salvar.",
      );
    } finally {
      setPending(false);
    }
  }

  async function uploadPhoto(file: File | undefined) {
    if (!file || pending) return;
    const body = new FormData();
    body.append("file", file);
    setPending(true);
    setPhotoStatus(null);
    try {
      await api("POST", `${profile}/avatar`, body);
      setPhotoStatus("Foto atualizada.");
      router.refresh();
    } catch (err) {
      setPhotoStatus(
        err instanceof ApiError ? err.message : "Não foi possível enviar.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-lg overflow-hidden p-0">
        <div className="flex items-start gap-4 border-b border-line px-6 py-5">
          <Avatar member={member} className="size-14 text-base" />
          <div className="min-w-0">
            <DialogTitle className="truncate text-lg font-bold">
              {member.displayName}
            </DialogTitle>
            <DialogDescription className="truncate text-sm text-muted">
              {member.email}
            </DialogDescription>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <label className="cursor-pointer rounded-sm text-sm font-semibold text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-focus">
                {member.avatarUrl ? "Trocar foto" : "Adicionar foto"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  disabled={pending}
                  onChange={(e) => {
                    uploadPhoto(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
              <span
                role="status"
                aria-live="polite"
                className="text-xs text-muted"
              >
                {photoStatus}
              </span>
            </div>
          </div>
        </div>
        <form onSubmit={save} noValidate>
          <div className="flex flex-col gap-5 px-6 py-5">
            <Field label="Nome na loja" htmlFor={`${idPrefix}-name`}>
              <input
                id={`${idPrefix}-name`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                required
                className={inputClass}
              />
            </Field>
            <Field
              label="WhatsApp"
              htmlFor={`${idPrefix}-number`}
              hint="Com + e código do país. Sem número, os anúncios só desta pessoa ficam sem botão de contato."
            >
              <input
                id={`${idPrefix}-number`}
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                inputMode="tel"
                autoComplete="off"
                placeholder="+55 11 99999-8888"
                className={inputClass}
              />
            </Field>
            {canChangeRole && (
              <div className="flex flex-col gap-1.5">
                <span aria-hidden="true" className="text-sm font-semibold">
                  Papel
                </span>
                <RoleToggle
                  name={`${idPrefix}-role`}
                  label={`Papel de ${member.displayName}`}
                  value={role}
                  onChange={setRole}
                  className="w-full"
                />
                <p className="text-xs text-muted">{ROLE_DESCRIPTIONS[role]}</p>
              </div>
            )}
            {error && (
              <p role="alert" className="text-sm font-medium text-stamp">
                {error}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t border-line bg-paper/70 px-6 py-3.5">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
