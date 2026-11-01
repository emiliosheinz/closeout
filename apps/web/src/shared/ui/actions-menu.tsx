"use client";

import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, MoreVertical } from "lucide-react";
import { forwardRef, useState } from "react";
import { cn } from "@/shared/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

export {
  DropdownMenuItem as ActionsMenuItem,
  DropdownMenuLabel as ActionsMenuLabel,
  DropdownMenuRadioGroup as ActionsMenuRadioGroup,
  DropdownMenuSeparator as ActionsMenuSeparator,
  DropdownMenuSub as ActionsMenuSub,
  DropdownMenuSubContent as ActionsMenuSubContent,
  DropdownMenuSubTrigger as ActionsMenuSubTrigger,
};

const choiceClass =
  "relative flex cursor-default select-none items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-none pointer-coarse:py-2.5 focus:bg-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-50";

/** A choice in a radio group of the menu, checked on the right. */
export const ActionsMenuRadioItem = forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.RadioItem
    ref={ref}
    className={cn(choiceClass, className)}
    {...props}
  >
    {children}
    <DropdownMenuPrimitive.ItemIndicator className="absolute right-2 flex">
      <Check className="size-4" aria-hidden="true" />
    </DropdownMenuPrimitive.ItemIndicator>
  </DropdownMenuPrimitive.RadioItem>
));
ActionsMenuRadioItem.displayName = "ActionsMenuRadioItem";

/**
 * The "⋮" actions menu at the end of a row. Radix cancels Tab inside a menu,
 * so Tab is made to close it. `triggerRef` lets a dialog opened from the menu
 * return focus to the trigger.
 */
export function ActionsMenu({
  label,
  triggerRef,
  children,
}: {
  label: string;
  triggerRef?: React.Ref<HTMLButtonElement>;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        ref={triggerRef}
        aria-label={label}
        className="inline-flex size-10 items-center justify-center rounded-full text-muted hover:bg-ink/5 hover:text-ink aria-expanded:bg-ink/5 aria-expanded:text-ink"
      >
        <MoreVertical className="size-4" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-56"
        onKeyDown={(event) => {
          if (event.key === "Tab") setOpen(false);
        }}
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
