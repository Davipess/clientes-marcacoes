"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Início" },
  { href: "/admin/agenda", label: "Agenda" },
  { href: "/admin/servicos", label: "Serviços" },
  { href: "/admin/equipa", label: "Equipa" },
  { href: "/admin/clientes", label: "Clientes" },
  { href: "/admin/relatorios", label: "Relatórios" },
  { href: "/admin/definicoes", label: "Definições" },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-border/60 bg-card">
      <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
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
    </nav>
  );
}
