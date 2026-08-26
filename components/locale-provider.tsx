"use client";

import { I18nProvider } from "@/lib/i18n-context";
import type { Locale } from "@/lib/i18n";

export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  return <I18nProvider initialLocale={initialLocale}>{children}</I18nProvider>;
}
