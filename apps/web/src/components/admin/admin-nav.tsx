"use client";

import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin", label: "Anúncios" },
  { href: "/admin/vendedores", label: "Vendedores" },
  { href: "/admin/loja", label: "Loja" },
];

export function AdminNav({ storeName }: { storeName: string }) {
  const pathname = usePathname();

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/admin" className="text-base font-extrabold">
          {storeName}
        </Link>
        <nav
          aria-label="Administração"
          className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto"
        >
          {LINKS.map((link) => {
            const active =
              link.href === "/admin"
                ? pathname === "/admin" ||
                  pathname.startsWith("/admin/anuncios")
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-11 items-center rounded-full px-3.5 text-sm font-semibold",
                  active
                    ? "bg-ink text-surface"
                    : "text-ink-soft hover:bg-ink/5",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-ink-soft hover:bg-ink/5"
          >
            Ver loja
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="inline-flex h-11 items-center rounded-full px-3 text-sm font-semibold text-ink-soft hover:bg-ink/5"
            >
              Sair
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
