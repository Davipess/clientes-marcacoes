"use client";

import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { setLocale } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

interface PublicHeaderProps {
  name: string;
  logoUrl?: string | null;
}

export function PublicHeader({ name, logoUrl }: PublicHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-heading text-xl font-semibold tracking-tight text-foreground">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              className="h-8 w-8 rounded-lg object-contain"
            />
          )}
          {name}
        </Link>
        <nav className="flex items-center gap-1 sm:gap-4">
          <Link
            href="/servicos"
            className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Serviços
          </Link>
          <Link
            href="/marcar"
            className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:brightness-110 active:scale-[0.98]"
          >
            Marcar
          </Link>
          <LanguageSwitcher onSwitch={(locale: Locale) => setLocale(locale)} />
        </nav>
      </div>
    </header>
  );
}
