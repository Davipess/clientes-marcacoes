"use client";

import { useState } from "react";
import { Globe } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="rounded-full p-2 hover:bg-muted transition-colors"
        aria-label="Idioma"
      >
        <Globe className="h-5 w-5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-36 rounded-xl border bg-white shadow-lg">
          <button
            type="button"
            onClick={() => { setLocale("pt"); setOpen(false); }}
            className={`w-full px-4 py-2 text-left text-sm rounded-t-xl ${
              locale === "pt" ? "bg-muted font-medium" : "hover:bg-muted/50"
            }`}
          >
            🇵🇹 Português
          </button>
          <button
            type="button"
            onClick={() => { setLocale("en"); setOpen(false); }}
            className={`w-full px-4 py-2 text-left text-sm rounded-b-xl ${
              locale === "en" ? "bg-muted font-medium" : "hover:bg-muted/50"
            }`}
          >
            🇬🇧 English
          </button>
        </div>
      )}
    </div>
  );
}
