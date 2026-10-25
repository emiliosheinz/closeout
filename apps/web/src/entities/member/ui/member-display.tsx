import { cn } from "@/shared/lib/utils";
import type { TeamMember } from "../model/types";

/** Shows a stored digits-only number the way people type it back. */
export function displayNumber(number: string | null): string {
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

export function MemberAvatar({
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

/** Avatar, name and, on phones, the email that has no column there. */
export function MemberIdentity({
  member,
  showSelfBadge,
}: {
  member: TeamMember;
  /** Mark the row as the viewer's own. */
  showSelfBadge: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <MemberAvatar member={member} className="size-9 text-xs" />
      <div className="min-w-0">
        <p className="flex items-center gap-2">
          <span className="truncate font-semibold">{member.displayName}</span>
          {showSelfBadge && (
            <span className="shrink-0 rounded-md bg-paper px-1.5 py-0.5 text-xs font-medium text-ink-soft">
              Você
            </span>
          )}
        </p>
        <p className="truncate text-sm text-muted sm:hidden">{member.email}</p>
      </div>
    </div>
  );
}

/** Email and WhatsApp number, or the flag that there is no number. */
export function MemberContact({ member }: { member: TeamMember }) {
  return (
    <div className="hidden min-w-0 text-sm sm:block">
      <p className="truncate text-ink-soft">{member.email}</p>
      {member.whatsappNumber ? (
        <p className="truncate text-xs text-muted">
          {displayNumber(member.whatsappNumber)}
        </p>
      ) : (
        <p className="inline-flex items-center gap-1 text-xs font-medium text-stamp">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-stamp" />
          Sem WhatsApp
        </p>
      )}
    </div>
  );
}
