"use client";

import { useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { buttonVariants } from "@/shared/ui/button";

/** Opened from a menu item, focus belongs back on the menu's trigger. */
function returnTarget(active: Element | null): Element | null {
  const menuId = active
    ?.closest("[role=menu]")
    ?.getAttribute("aria-labelledby");
  return (menuId && document.getElementById(menuId)) || active;
}

/**
 * Explicit confirmation for destructive actions. The dialog stays open when
 * the action rejects; reporting the failure is the action's job (a mutation's
 * error toast). After it succeeds, `onSuccess` places focus where the user
 * continues (the trigger may be gone by then).
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  pendingLabel,
  onConfirm,
  onSuccess,
}: {
  trigger: (open: () => void) => React.ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  pendingLabel: string;
  onConfirm: () => Promise<void>;
  onSuccess?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const succeeded = useRef(false);
  const [opener, setOpener] = useState<Element | null>(null);

  async function confirm(event: React.MouseEvent) {
    event.preventDefault();
    setPending(true);
    const failed = await onConfirm().then(
      () => false,
      () => true,
    );
    setPending(false);
    if (failed) return;
    succeeded.current = true;
    setOpen(false);
  }

  return (
    <>
      {trigger(() => {
        setOpener(returnTarget(document.activeElement));
        setOpen(true);
      })}
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (!succeeded.current) {
              if (opener instanceof HTMLElement) opener.focus();
              return;
            }
            succeeded.current = false;
            onSuccess?.();
          }}
        >
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-ink-soft">
            {description}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              onClick={confirm}
              disabled={pending}
            >
              {pending ? pendingLabel : confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
