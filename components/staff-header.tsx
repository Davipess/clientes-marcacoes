"use client";

import { LanguageSwitcher } from "@/components/language-switcher";
import { setLocale } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

export function StaffHeader() {
  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <span className="font-semibold">Área do colaborador</span>
        <div className="flex items-center gap-2">
          <LanguageSwitcher onSwitch={(locale: Locale) => setLocale(locale)} />
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              formAction="/api/auth/logout"
              className="text-sm text-neutral-500 hover:text-neutral-900"
            >
              Sair
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
