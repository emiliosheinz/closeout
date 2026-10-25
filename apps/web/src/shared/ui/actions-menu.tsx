"use client";

import { MoreVertical } from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

export { DropdownMenuItem as ActionsMenuItem };

/**
 * The "⋮" actions menu at the end of a row. Radix cancels Tab inside a menu,
 * so Tab is made to close it.
 */
export function ActionsMenu({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        aria-label={label}
        className="inline-flex size-10 items-center justify-center rounded-full text-muted hover:bg-ink/5 hover:text-ink aria-expanded:bg-ink/5 aria-expanded:text-ink"
      >
        <MoreVertical className="size-4" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-44"
        onKeyDown={(event) => {
          if (event.key === "Tab") setOpen(false);
        }}
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
