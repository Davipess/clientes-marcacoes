export type Locale = "pt" | "en";

/**
 * Only fixed UI elements are translated — nav labels, buttons, common actions.
 * Editable content (service names, site text, descriptions) is NOT translated
 * because the business owner can change those freely.
 */
const translations = {
  pt: {
    "nav.home": "Início",
    "nav.agenda": "Agenda",
    "nav.services": "Serviços",
    "nav.team": "Equipa",
    "nav.clients": "Clientes",
    "nav.loyalty": "Pontos",
    "nav.waitlist": "Espera",
    "nav.reports": "Relatórios",
    "nav.settings": "Definições",
    "nav.logout": "Sair",

    "booking.title": "Marcar",
    "booking.confirmed": "Marcação agendada!",

    "common.loading": "A carregar...",
    "common.save": "Guardar",
    "common.cancel": "Cancelar",
    "common.delete": "Eliminar",
    "common.edit": "Editar",
    "common.back": "Voltar",
    "common.next": "Seguinte",
    "common.search": "Pesquisar...",
    "common.active": "Ativa",
    "common.inactive": "Inativa",
  },
  en: {
    "nav.home": "Home",
    "nav.agenda": "Schedule",
    "nav.services": "Services",
    "nav.team": "Team",
    "nav.clients": "Clients",
    "nav.loyalty": "Points",
    "nav.waitlist": "Waitlist",
    "nav.reports": "Reports",
    "nav.settings": "Settings",
    "nav.logout": "Logout",

    "booking.title": "Book",
    "booking.confirmed": "Appointment booked!",

    "common.loading": "Loading...",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.delete": "Delete",
    "common.edit": "Edit",
    "common.back": "Back",
    "common.next": "Next",
    "common.search": "Search...",
    "common.active": "Active",
    "common.inactive": "Inactive",
  },
} as const;

export type TranslationKey = keyof typeof translations.pt;

export function getLocaleFromCookie(cookieHeader: string | null): Locale {
  if (!cookieHeader) return "pt";
  const match = cookieHeader.match(/locale=(pt|en)/);
  return match ? (match[1] as Locale) : "pt";
}

export function t(key: TranslationKey, locale: Locale = "pt"): string {
  return translations[locale][key] ?? key;
}

export function getTranslations(locale: Locale) {
  return translations[locale];
}
