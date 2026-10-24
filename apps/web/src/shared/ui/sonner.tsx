"use client";

import {
  type ExternalToast,
  Toaster as Sonner,
  type ToasterProps,
  toast,
} from "sonner";
import { ApiError, GENERIC_ERROR } from "@/shared/api";

/**
 * Sonner puts every toast in one polite live region. Errors are wrapped in
 * their own assertive one so assistive tech interrupts for them.
 */
export const notify = {
  success: (message: string, options?: ExternalToast) =>
    toast.success(message, options),
  error: (message: string, options?: ExternalToast) =>
    toast.error(
      <span role="alert" aria-live="assertive">
        {message}
      </span>,
      options,
    ),
};

/** Toasts a failed action's message, then rethrows so the caller still sees the failure. */
export function notifyFailure(error: unknown): never {
  notify.error(error instanceof ApiError ? error.message : GENERIC_ERROR);
  throw error;
}

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      position="top-center"
      duration={5000}
      closeButton
      containerAriaLabel="Notificações"
      toastOptions={{
        classNames: {
          toast:
            "!rounded-xl !border-line !bg-surface !text-ink !shadow-xl !font-sans",
          description: "!text-muted",
          actionButton: "!bg-ink !text-surface",
          cancelButton: "!bg-paper !text-ink",
        },
      }}
      {...props}
    />
  );
}
