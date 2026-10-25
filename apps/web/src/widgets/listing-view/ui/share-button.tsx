"use client";

import { Check, Share2 } from "lucide-react";
import { useState } from "react";

/** Native share sheet where available, otherwise copies the link. */
export function ShareButton({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return;
      } catch (err) {
        if ((err as DOMException).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard needs a secure context and permission; let the person copy by hand.
      window.prompt("Copie o link do item:", url);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={share}
        className="inline-flex h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-semibold hover:border-ink/40"
      >
        {copied ? (
          <Check className="size-4 text-go" aria-hidden="true" />
        ) : (
          <Share2 className="size-4" aria-hidden="true" />
        )}
        {copied ? "Link copiado" : "Compartilhar"}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? "Link do item copiado." : ""}
      </span>
    </>
  );
}
