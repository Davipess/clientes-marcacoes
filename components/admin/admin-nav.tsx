import Link from "next/link";

const LINKS = [
  { href: "/admin", label: "Início" },
  { href: "/admin/agenda", label: "Agenda" },
  { href: "/admin/servicos", label: "Serviços" },
  { href: "/admin/clientes", label: "Clientes" },
  { href: "/admin/definicoes", label: "Definições" },
];

export default function AdminNav() {
  return (
    <nav className="border-b border-border/60 bg-card">
      <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="whitespace-nowrap border-b-2 border-transparent px-3 py-3 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground aria-[current=page]:border-primary"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
