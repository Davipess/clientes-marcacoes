export type Locale = "pt" | "en";

const translations = {
  pt: {
    "nav.home": "Início",
    "nav.agenda": "Agenda",
    "nav.services": "Serviços",
    "nav.team": "Equipa",
    "nav.clients": "Clientes",
    "nav.loyalty": "Fidelização",
    "nav.waitlist": "Espera",
    "nav.reports": "Relatórios",
    "nav.settings": "Definições",
    "nav.logout": "Sair",

    "booking.title": "Marcar Serviço",
    "booking.selectService": "Escolha o serviço",
    "booking.selectDate": "Escolha a data",
    "booking.selectTime": "Escolha o horário",
    "booking.yourDetails": "Os seus dados",
    "booking.confirm": "Confirmar",
    "booking.confirmed": "Marcação agendada!",
    "booking.payment": "Pagamento efetuado no local.",
    "booking.saveDate": "Guarde esta data no calendário do seu telemóvel.",

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

    "loyalty.title": "Programa de Fidelização",
    "loyalty.subtitle": "Clientes ganham pontos a cada marcação e trocam por recompensas.",
    "loyalty.yourPoints": "Os seus pontos",
    "loyalty.points": "pontos",
    "loyalty.earned": "ganhos",
    "loyalty.progress": "para",
    "loyalty.noRewards": "Ainda sem recompensas disponíveis.",

    "waitlist.title": "Lista de Espera",
    "waitlist.subtitle": "Clientes que ficaram na fila quando não havia horário disponível.",
    "waitlist.noEntries": "Ninguém na lista de espera.",
    "waitlist.join": "Juntar à lista de espera",
    "waitlist.joined": "Adicionado à lista!",
    "waitlist.notifyText": "Será notificado quando houver uma vaga disponível.",

    "reports.title": "Relatórios",
    "reports.revenue": "Receita",
    "reports.appointments": "Marcações",
    "reports.clients": "Clientes",
    "reports.noShows": "Faltas",
    "reports.thisMonth": "Este mês",
    "reports.lastMonth": "Mês passado",
  },
  en: {
    "nav.home": "Home",
    "nav.agenda": "Schedule",
    "nav.services": "Services",
    "nav.team": "Team",
    "nav.clients": "Clients",
    "nav.loyalty": "Loyalty",
    "nav.waitlist": "Waitlist",
    "nav.reports": "Reports",
    "nav.settings": "Settings",
    "nav.logout": "Logout",

    "booking.title": "Book a Service",
    "booking.selectService": "Choose a service",
    "booking.selectDate": "Choose a date",
    "booking.selectTime": "Choose a time",
    "booking.yourDetails": "Your details",
    "booking.confirm": "Confirm",
    "booking.confirmed": "Appointment booked!",
    "booking.payment": "Payment made on site.",
    "booking.saveDate": "Save this date in your phone calendar.",

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

    "loyalty.title": "Loyalty Program",
    "loyalty.subtitle": "Clients earn points with every booking and redeem rewards.",
    "loyalty.yourPoints": "Your points",
    "loyalty.points": "points",
    "loyalty.earned": "earned",
    "loyalty.progress": "to",
    "loyalty.noRewards": "No rewards available yet.",

    "waitlist.title": "Waitlist",
    "waitlist.subtitle": "Clients who joined the queue when no time slot was available.",
    "waitlist.noEntries": "No one on the waitlist.",
    "waitlist.join": "Join the waitlist",
    "waitlist.joined": "Added to the list!",
    "waitlist.notifyText": "You'll be notified when a slot opens.",

    "reports.title": "Reports",
    "reports.revenue": "Revenue",
    "reports.appointments": "Appointments",
    "reports.clients": "Clients",
    "reports.noShows": "No-shows",
    "reports.thisMonth": "This month",
    "reports.lastMonth": "Last month",
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
