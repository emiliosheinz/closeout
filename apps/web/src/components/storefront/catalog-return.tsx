"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const KEY = "closeout:last-catalog-view";

/** Session storage can be unavailable (private mode, blocked site data). */
function read(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Remembers the catalog view (search, filters, page) the visitor is on. */
export function RememberCatalogView({ href }: { href: string }) {
  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, href);
    } catch {}
  }, [href]);
  return null;
}

/**
 * Back to the catalog view the visitor came from in this tab, or to the
 * plain catalog for someone who opened a shared item link directly.
 */
export function BackToCatalog() {
  const [href, setHref] = useState("/");
  useEffect(() => {
    const remembered = read();
    if (remembered?.startsWith("/")) setHref(remembered);
  }, []);
  return (
    <Link
      href={href}
      className="inline-flex h-11 items-center gap-2 text-sm font-semibold text-ink-soft hover:text-ink"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      Voltar ao catálogo
    </Link>
  );
}
