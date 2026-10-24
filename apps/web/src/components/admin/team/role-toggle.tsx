"use client";

import type { AssignableRole } from "@/lib/admin/types";
import { ROLE_LABELS } from "@/lib/format";
import { cn } from "@/lib/utils";

const ROLES: AssignableRole[] = ["seller", "admin"];

/** Two-way admin/seller switch built on native radios. */
export function RoleToggle({
  name,
  label,
  value,
  onChange,
  disabled,
  className,
}: {
  name: string;
  label: string;
  value: AssignableRole;
  onChange: (role: AssignableRole) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "inline-grid h-11 grid-cols-2 rounded-full bg-paper p-1 ring-1 ring-line ring-inset",
        disabled && "opacity-60",
        className,
      )}
    >
      {ROLES.map((role) => (
        <label
          key={role}
          className="flex cursor-pointer items-center justify-center rounded-full px-4 text-sm font-semibold whitespace-nowrap text-ink-soft transition-colors hover:text-ink has-[:checked]:bg-surface has-[:checked]:text-ink has-[:checked]:shadow-sm has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-focus"
        >
          <input
            type="radio"
            name={name}
            value={role}
            checked={value === role}
            disabled={disabled}
            onChange={() => onChange(role)}
            className="sr-only"
          />
          {ROLE_LABELS[role]}
        </label>
      ))}
    </div>
  );
}
