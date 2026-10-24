"use client";

import {
  memberRequestSchema,
  sellerRequestSchema,
} from "@closeout/contracts/schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { listingKeys } from "@/entities/listing";
import type { TeamMember } from "@/entities/member";
import { memberKeys, RoleToggle } from "@/entities/member";
import { ApiError, api } from "@/shared/api";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
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
  const [editing, setEditing] = useState(false);
  const remove = useMutation({
    mutationFn: () =>
      api("DELETE", `/stores/${storeId}/members/${member.userId}`),
    meta: {
      success: `${member.displayName} saiu da equipe.`,
      invalidates: [memberKeys.list(storeId), listingKeys.all(storeId)],
    },
  });
  const menuLabel = `Ações para ${member.displayName}`;
  const editItem = (
    <ActionsMenuItem onSelect={() => setEditing(true)}>Editar</ActionsMenuItem>
  );

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
          onSuccess={() => document.getElementById("team-members")?.focus()}
          onConfirm={() => remove.mutateAsync()}
          trigger={(confirmRemoval) => (
            <ActionsMenu label={menuLabel}>
              {editItem}
              <ActionsMenuItem
                onSelect={confirmRemoval}
                className="text-stamp focus:bg-stamp/10 focus:text-stamp"
              >
                Remover
              </ActionsMenuItem>
            </ActionsMenu>
          )}
        />
      ) : (
        <ActionsMenu label={menuLabel}>{editItem}</ActionsMenu>
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

const formSchema = z.object({
  displayName: sellerRequestSchema.shape.displayName.unwrap(),
  whatsappNumber: z.string(),
  role: memberRequestSchema.shape.role,
});
type FormValues = z.infer<typeof formSchema>;

/** The API rejected the profile fields (a bad number); other failures toast. */
class ProfileFieldError extends Error {}

async function patchProfile(path: string, body: unknown): Promise<void> {
  try {
    await api("PATCH", path, body);
  } catch (error) {
    if (error instanceof ApiError && error.status === 400)
      throw new ProfileFieldError(error.message);
    throw error;
  }
}

const isProfileFieldError = (error: unknown) =>
  error instanceof ProfileFieldError;

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
  const initialRole = member.role === "admin" ? "admin" : "seller";
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      displayName: member.displayName,
      whatsappNumber: displayNumber(member.whatsappNumber),
      role: initialRole,
    },
  });
  const profile = `/stores/${storeId}/sellers/${member.sellerId}`;
  const idPrefix = `member-${member.userId}`;
  const invalidates = [memberKeys.list(storeId), listingKeys.all(storeId)];

  const save = useMutation({
    mutationFn: async (values: FormValues) => {
      await patchProfile(profile, {
        displayName: values.displayName,
        whatsappNumber: values.whatsappNumber,
      });
      if (canChangeRole && values.role !== initialRole) {
        await api("PATCH", `/stores/${storeId}/members/${member.userId}`, {
          role: values.role,
        });
      }
    },
    meta: {
      success: "Alterações salvas.",
      invalidates,
      handlesError: isProfileFieldError,
    },
  });
  const uploadPhoto = useMutation({
    mutationFn: (file: File) => {
      const body = new FormData();
      body.append("file", file);
      return api("POST", `${profile}/avatar`, body);
    },
    meta: { success: "Foto atualizada.", invalidates },
  });
  const pending = save.isPending || uploadPhoto.isPending;

  function submit(values: FormValues) {
    save.mutate(values, {
      onSuccess: onClose,
      onError: (error) => {
        if (error instanceof ProfileFieldError)
          setError("whatsappNumber", { message: error.message });
      },
    });
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
                    const file = e.target.files?.[0];
                    if (file && !pending) uploadPhoto.mutate(file);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>
        </div>
        <form onSubmit={handleSubmit(submit)} noValidate>
          <div className="flex flex-col gap-5 px-6 py-5">
            <Field
              label="Nome na loja"
              htmlFor={`${idPrefix}-name`}
              error={errors.displayName?.message}
            >
              <input
                id={`${idPrefix}-name`}
                maxLength={60}
                aria-invalid={Boolean(errors.displayName)}
                aria-describedby={
                  errors.displayName ? `${idPrefix}-name-error` : undefined
                }
                className={inputClass}
                {...register("displayName")}
              />
            </Field>
            <Field
              label="WhatsApp"
              htmlFor={`${idPrefix}-number`}
              hint="Com + e código do país. Sem número, os anúncios só desta pessoa ficam sem botão de contato."
              error={errors.whatsappNumber?.message}
            >
              <input
                id={`${idPrefix}-number`}
                inputMode="tel"
                autoComplete="off"
                placeholder="+55 11 99999-8888"
                aria-invalid={Boolean(errors.whatsappNumber)}
                aria-describedby={
                  errors.whatsappNumber ? `${idPrefix}-number-error` : undefined
                }
                className={inputClass}
                {...register("whatsappNumber")}
              />
            </Field>
            {canChangeRole && (
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
                        name={`${idPrefix}-role`}
                        label={`Papel de ${member.displayName}`}
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
            )}
          </div>
          <div className="flex justify-end gap-2 border-t border-line bg-paper/70 px-6 py-3.5">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {save.isPending ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
