"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

interface PublicHeaderProps {
  name: string;
  logoUrl?: string | null;
}

export function PublicHeader({ name, logoUrl }: PublicHeaderProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex min-w-0 items-center gap-2 font-heading text-xl font-semibold tracking-tight text-foreground">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              className="h-8 w-8 shrink-0 rounded-lg object-contain"
            />
          )}
          <span className="truncate">{name}</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-4 sm:flex">
          <Link href="/servicos" className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
            Serviços
          </Link>
          <Link href="/pontos" className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
            Pontos
          </Link>
          <Link href="/marcar" className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:brightness-110 active:scale-[0.98]">
            Marcar
          </Link>
        </nav>

        {/* Hamburger button */}
        <button
          onClick={() => setOpen((o) => !o)}
          className="relative z-50 flex h-10 w-10 items-center justify-center rounded-lg transition-colors hover:bg-muted sm:hidden"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
        >
          <span className="relative h-5 w-5">
            <span
              className={`absolute left-0 h-0.5 w-5 rounded-full bg-foreground transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                open ? "top-2 rotate-45" : "top-0 rotate-0"
              }`}
            />
            <span
              className={`absolute left-0 top-2 h-0.5 w-5 rounded-full bg-foreground transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                open ? "opacity-0 scale-x-0" : "opacity-100 scale-x-100"
              }`}
            />
            <span
              className={`absolute left-0 h-0.5 w-5 rounded-full bg-foreground transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                open ? "top-2 -rotate-45" : "top-4 rotate-0"
              }`}
            />
          </span>
        </button>
      </div>

      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 z-40 bg-background/60 backdrop-blur-sm transition-opacity duration-300 sm:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setOpen(false)}
      />

      {/* Mobile menu */}
      <nav
        className={`fixed left-0 right-0 top-16 z-40 border-b border-border/60 bg-background/95 backdrop-blur-lg transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] sm:hidden ${
          open
            ? "translate-y-0 opacity-100"
            : "-translate-y-4 pointer-events-none opacity-0"
        }`}
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-1 p-4">
          {[
            { href: "/servicos", label: "Serviços" },
            { href: "/pontos", label: "Pontos" },
            { href: "/marcar", label: "Marcar" },
          ].map((item, i) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`rounded-xl px-4 py-3 text-base font-medium transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                item.href === "/marcar"
                  ? "bg-primary text-center text-primary-foreground"
                  : "text-foreground hover:bg-muted"
              } ${
                open
                  ? "translate-x-0 opacity-100"
                  : "-translate-x-4 opacity-0"
              }`}
              style={{ transitionDelay: open ? `${75 + i * 50}ms` : "0ms" }}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
