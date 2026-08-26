"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NotificationBell } from "./notification-bell";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useI18n } from "@/lib/i18n-context";

export default function AdminNav() {
  const pathname = usePathname();
  const { t } = useI18n();

  const LINKS = [
    { href: "/admin", label: t("nav.home") },
    { href: "/admin/agenda", label: t("nav.agenda") },
    { href: "/admin/servicos", label: t("nav.services") },
    { href: "/admin/equipa", label: t("nav.team") },
    { href: "/admin/clientes", label: t("nav.clients") },
    { href: "/admin/fidelizacao", label: t("nav.loyalty") },
    { href: "/admin/lista-espera", label: t("nav.waitlist") },
    { href: "/admin/relatorios", label: t("nav.reports") },
    { href: "/admin/definicoes", label: t("nav.settings") },
  ];

  return (
    <nav className="border-b border-border/60 bg-card">
      <div className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4">
        <div className="flex flex-1 gap-1">
          {LINKS.map((link) => {
            const active =
              link.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm transition-colors ${
                  active
                    ? "border-primary font-medium text-primary"
                    : "border-transparent text-muted-foreground hover:border-primary/50 hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
        <NotificationBell />
        <LanguageSwitcher />
      </div>
    </nav>
  );
}
