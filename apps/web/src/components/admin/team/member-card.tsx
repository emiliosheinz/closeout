"use client";

import { Camera, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiError, api } from "@/lib/admin/client-api";
import type { AssignableRole, Seller, TeamMember } from "@/lib/admin/types";
import { pluralize, ROLE_LABELS } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "../confirm-dialog";
import { Field, inputClass } from "../field";

type Status = { text: string; error: boolean } | null;

/** Shows a stored digits-only number the way people type it back. */
function displayNumber(number: string | null): string {
  return number ? `+${number}` : "";
}

function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

/**
 * One team member: their public contact profile (name, WhatsApp, photo) and,
 * for a manager looking at someone else who is not the owner, role and
 * removal controls.
 */
export function MemberCard({
  storeId,
  member,
  isSelf,
  canManageTeam,
}: {
  storeId: string;
  member: TeamMember;
  isSelf: boolean;
  /** The viewer is a manager: "(você)" marks their card, others get controls. */
  canManageTeam: boolean;
}) {
  const canManage = canManageTeam && !isSelf && member.role !== "owner";
  const router = useRouter();
  const [name, setName] = useState(member.displayName);
  const [number, setNumber] = useState(displayNumber(member.whatsappNumber));
  const [status, setStatus] = useState<Status>(null);
  const [pending, setPending] = useState(false);
  const profile = `/stores/${storeId}/sellers/${member.sellerId}`;
  const idPrefix = `member-${member.userId}`;

  async function run(action: () => Promise<string>, fallback: string) {
    setPending(true);
    setStatus(null);
    try {
      setStatus({ text: await action(), error: false });
      router.refresh();
    } catch (err) {
      setStatus({ text: errorText(err, fallback), error: true });
    } finally {
      setPending(false);
    }
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    run(async () => {
      const saved = await api<Seller>("PATCH", profile, {
        displayName: name,
        whatsappNumber: number,
      });
      setNumber(displayNumber(saved.whatsappNumber));
      return "Contato salvo.";
    }, "Não foi possível salvar.");
  }

  function uploadAvatar(file: File | undefined) {
    if (!file || pending) return;
    const body = new FormData();
    body.append("file", file);
    run(async () => {
      await api("POST", `${profile}/avatar`, body);
      return "Foto atualizada.";
    }, "Não foi possível enviar.");
  }

  function changeRole(role: AssignableRole) {
    run(async () => {
      await api("PATCH", `/stores/${storeId}/members/${member.userId}`, {
        role,
      });
      return `Agora é ${ROLE_LABELS[role]}.`;
    }, "Não foi possível mudar o papel.");
  }

  return (
    <li className="flex flex-col rounded-xl border border-line bg-surface">
      <form onSubmit={save} className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start gap-4">
          <label className="relative inline-flex size-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-paper has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-focus">
            {member.avatarUrl ? (
              // biome-ignore lint/performance/noImgElement: pre-sized avatar variant.
              <img
                src={member.avatarUrl}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              <Camera className="size-5 text-muted" aria-hidden="true" />
            )}
            <span className="sr-only">Trocar foto de {member.displayName}</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => {
                uploadAvatar(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="truncate text-lg leading-tight font-bold">
                {member.displayName}
              </h3>
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                  member.role === "owner"
                    ? "bg-ink text-surface"
                    : "border border-line text-ink-soft",
                )}
              >
                {ROLE_LABELS[member.role]}
              </span>
              {isSelf && canManageTeam && (
                <span className="text-xs text-muted">(você)</span>
              )}
            </div>
            <p className="mt-1 truncate text-sm text-ink-soft">
              {member.email}
            </p>
            <p className="mt-0.5 text-sm text-muted">
              {pluralize(member.listingCount, "anúncio", "anúncios")}
            </p>
          </div>
        </div>
        {!member.whatsappNumber && (
          <p className="rounded-md bg-stamp/10 px-3 py-2 text-sm text-stamp">
            Sem WhatsApp: os anúncios só desta pessoa aparecem sem botão de
            contato.
          </p>
        )}
        <Field label="Nome que aparece na loja" htmlFor={`${idPrefix}-name`}>
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
          hint="Com + e código do país, por exemplo +55 11 99999-8888. Vazio esconde o botão de contato."
        >
          <input
            id={`${idPrefix}-number`}
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            inputMode="tel"
            autoComplete={isSelf ? "tel" : "off"}
            placeholder="+55 11 99999-8888"
            className={inputClass}
          />
        </Field>
        <div className="mt-auto flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending}>
            Salvar contato
          </Button>
          <span
            role="status"
            aria-live="polite"
            className={
              status?.error
                ? "text-sm font-medium text-stamp"
                : "text-sm text-go"
            }
          >
            {status?.text}
          </span>
        </div>
      </form>
      {canManage && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
          <label className="flex items-center gap-2 text-sm font-semibold">
            Papel
            <select
              aria-label={`Papel de ${member.displayName}`}
              value={member.role}
              disabled={pending}
              onChange={(e) => changeRole(e.target.value as AssignableRole)}
              className="h-11 rounded-full border border-line-strong bg-surface px-3 text-sm font-semibold"
            >
              <option value="admin">{ROLE_LABELS.admin}</option>
              <option value="seller">{ROLE_LABELS.seller}</option>
            </select>
          </label>
          <ConfirmDialog
            title={`Remover ${member.displayName} da equipe?`}
            description="A conta é apagada e a pessoa perde o acesso na hora. Nos anúncios divididos com outra pessoa, fica quem continua na equipe."
            confirmLabel="Remover da equipe"
            pendingLabel="Removendo..."
            onConfirm={async () => {
              await api(
                "DELETE",
                `/stores/${storeId}/members/${member.userId}`,
              );
              router.refresh();
            }}
            trigger={(open) => (
              <Button
                type="button"
                variant="ghost"
                onClick={open}
                className="text-stamp"
              >
                <Trash2 aria-hidden="true" />
                Remover
              </Button>
            )}
          />
        </div>
      )}
    </li>
  );
}
