"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Signs out and reloads the invite page so its form shows. A fetch rather
 * than a form post: the page's no-referrer policy would send `Origin: null`
 * on a form post, which the logout handler refuses.
 */
export function InviteSignOut() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOut() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        referrerPolicy: "same-origin",
      });
      if (!response.ok) throw new Error(String(response.status));
      window.location.reload();
    } catch {
      setError("Não foi possível sair agora. Tente de novo.");
      setPending(false);
    }
  }

  return (
    <div className="mt-5 flex flex-col items-start gap-2">
      <Button type="button" onClick={signOut} disabled={pending}>
        {pending ? "Saindo..." : "Sair"}
      </Button>
      <p role="status" aria-live="polite" className="text-sm text-stamp">
        {error}
      </p>
    </div>
  );
}
