"use client";

import { LanguageSwitcher } from "@/components/language-switcher";
import { useI18n } from "@/lib/i18n-context";

export function StaffHeader() {
  const { t } = useI18n();

  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <span className="font-semibold">{t("nav.team")}</span>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              formAction="/api/auth/logout"
              className="text-sm text-neutral-500 hover:text-neutral-900"
            >
              {t("nav.logout")}
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
