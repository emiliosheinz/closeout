import { Mail } from "lucide-react";
import { formatDate, ROLE_LABELS } from "@/shared/lib/format";
import type { PendingInvite } from "../model/types";

/** The invite's email with a mail icon and, on phones, role and expiry. */
export function InviteIdentity({ invite }: { invite: PendingInvite }) {
  return (
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
  );
}
