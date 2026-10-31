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
  info: (message: string, options?: ExternalToast) =>
    toast.info(message, options),
  error: (message: string, options?: ExternalToast) =>
    toast.error(
      <span role="alert" aria-live="assertive">
        {message}
      </span>,
      options,
    ),
  failure: (error: unknown) =>
    notify.error(error instanceof ApiError ? error.message : GENERIC_ERROR),
};

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      position="bottom-center"
      duration={5000}
      closeButton
      containerAriaLabel="Notificações"
      toastOptions={{
        closeButtonAriaLabel: "Fechar notificação",
        classNames: {
          toast:
            "!rounded-md !border-line !bg-surface !text-ink !shadow-xl !font-sans !pr-10",
          // Sonner hangs the button off the top-left corner; keep it inside.
          closeButton:
            "!left-auto !right-2 !top-2 !transform-none !border-0 !bg-transparent !text-muted hover:!text-ink",
          description: "!text-muted",
          actionButton: "!bg-ink !text-surface",
          cancelButton: "!bg-paper !text-ink",
        },
      }}
      {...props}
    />
  );
}
