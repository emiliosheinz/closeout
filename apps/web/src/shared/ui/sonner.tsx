"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
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
