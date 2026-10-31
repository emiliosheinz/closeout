"use client";

import { useEffect } from "react";
import { NO_ACCESS_ERROR, SESSION_EXPIRED_ERROR } from "@/entities/session";
import { notify } from "@/shared/ui/sonner";

const TOAST_ID = "login-notice";

/**
 * Toasts why the visitor landed on the login page. The URL keeps the flag:
 * the page skips its session check on no-access, and dropping the flag would
 * bounce a signed-in member without access back to the admin. The fixed id
 * keeps a repeated effect (StrictMode) to one toast.
 */
export function LoginNoticeToast({ error }: { error?: string }) {
  useEffect(() => {
    if (error === SESSION_EXPIRED_ERROR)
      notify.info("Sua sessão expirou. Entre de novo.", { id: TOAST_ID });
    if (error === NO_ACCESS_ERROR)
      notify.error("Esta conta não administra esta loja.", { id: TOAST_ID });
  }, [error]);
  return null;
}
