"use client";

import { useEffect, useRef, useState } from "react";
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

/**
 * Opened from a menu item, focus belongs back on the menu's trigger; from a
 * submenu, on the trigger of the menu it opened from.
 */
function returnTarget(active: Element | null): Element | null {
  let target = active;
  for (;;) {
    const menuId = target
      ?.closest("[role=menu]")
      ?.getAttribute("aria-labelledby");
    const trigger = menuId && document.getElementById(menuId);
    if (!trigger) return target;
    target = trigger;
  }
}

/**
 * Explicit confirmation before an action. The dialog stays open when
 * the action rejects; reporting the failure is the action's job (a mutation's
 * error toast). After it succeeds, `onSuccess` places focus where the user
 * continues (the trigger may be gone by then); without it, focus goes back to
 * the trigger. It cannot be dismissed while the action runs.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  pendingLabel,
  onConfirm,
  onSuccess,
  destructive = true,
}: {
  trigger: (open: () => void) => React.ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  pendingLabel: string;
  onConfirm: () => Promise<void>;
  onSuccess?: () => void;
  /** False for a confirmation that creates rather than destroys. */
  destructive?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const succeeded = useRef(false);
  const [opener, setOpener] = useState<Element | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function confirm(event: React.MouseEvent) {
    event.preventDefault();
    setPending(true);
    const failed = await onConfirm().then(
      () => false,
      () => true,
    );
    setPending(false);
    if (failed) return;
    // The action can remove the caller (and this dialog) before it resolves;
    // with no dialog left to close, nothing else would place focus.
    if (!mounted.current) return onSuccess?.();
    succeeded.current = true;
    setOpen(false);
  }

  return (
    <>
      {trigger(() => {
        setOpener(returnTarget(document.activeElement));
        setOpen(true);
      })}
      <AlertDialog
        open={open}
        onOpenChange={(next) => (next || !pending) && setOpen(next)}
      >
        <AlertDialogContent
          onEscapeKeyDown={(event) => pending && event.preventDefault()}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const focusOpener = () =>
              opener instanceof HTMLElement && opener.focus();
            if (!succeeded.current) return focusOpener();
            succeeded.current = false;
            (onSuccess ?? focusOpener)();
          }}
        >
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-ink-soft">
            {description}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({
                variant: destructive ? "destructive" : "default",
              })}
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
