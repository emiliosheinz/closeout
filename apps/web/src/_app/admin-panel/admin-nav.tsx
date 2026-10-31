"use client";

import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isManager, useMember } from "@/entities/session";
import { storePath } from "@/shared/lib/site";
import { cn } from "@/shared/lib/utils";

const LINKS: { href: string; label: string; managersOnly?: boolean }[] = [
  { href: "/admin", label: "Anúncios" },
  { href: "/admin/team", label: "Equipe" },
  { href: "/admin/store", label: "Loja", managersOnly: true },
];

export function AdminNav() {
  const { store, role } = useMember();
  const pathname = usePathname();
  const links = LINKS.filter((link) => !link.managersOnly || isManager(role));

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/admin" className="text-base font-extrabold">
          {store.name}
        </Link>
        <nav
          aria-label="Administração"
          className="order-3 -mx-2.5 -my-1.5 flex w-full gap-1 overflow-x-auto px-1.5 py-1.5 sm:order-none sm:w-auto"
        >
          {links.map((link) => {
            const active =
              link.href === "/admin"
                ? pathname === "/admin" ||
                  pathname.startsWith("/admin/listings")
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
            href={storePath(store.slug)}
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
