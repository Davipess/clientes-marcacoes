"use client";

import { useState } from "react";
import { Globe } from "lucide-react";
import type { Locale } from "@/lib/i18n";

export function LanguageSwitcher({ onSwitch }: { onSwitch: (locale: Locale) => void }) {
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
        <div className="absolute right-0 top-full z-50 mt-2 w-32 rounded-xl border bg-white shadow-lg">
          <button
            type="button"
            onClick={() => { onSwitch("pt"); setOpen(false); }}
            className="w-full px-4 py-2 text-left text-sm hover:bg-muted/50 rounded-t-xl"
          >
            🇵🇹 Português
          </button>
          <button
            type="button"
            onClick={() => { onSwitch("en"); setOpen(false); }}
            className="w-full px-4 py-2 text-left text-sm hover:bg-muted/50 rounded-b-xl"
          >
            🇬🇧 English
          </button>
        </div>
      )}
    </div>
  );
}
