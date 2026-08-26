export type Locale = "pt" | "en";

const translations = {
  pt: {
    // Navigation
    "nav.home": "Início",
    "nav.agenda": "Agenda",
    "nav.services": "Serviços",
    "nav.team": "Equipa",
    "nav.clients": "Clientes",
    "nav.loyalty": "Fidelização",
    "nav.waitlist": "Espera",
    "nav.recurring": "Recorrentes",
    "nav.reports": "Relatórios",
    "nav.settings": "Definições",
    "nav.logout": "Sair",

    // Booking
    "booking.title": "Marcar Serviço",
    "booking.selectService": "Escolha o serviço",
    "booking.selectDate": "Escolha a data",
    "booking.selectTime": "Escolha o horário",
    "booking.yourDetails": "Os seus dados",
    "booking.confirm": "Confirmar",
    "booking.confirmed": "Marcação agendada!",
    "booking.reminder": "Quer receber um lembrete 1 hora antes?",
    "booking.activateReminders": "Ativar lembretes",
    "booking.payment": "Pagamento efetuado no local.",
    "booking.saveDate": "Guarde esta data no calendário do seu telemóvel para não se esquecer.",

    // Days
    "day.monday": "Segunda-feira",
    "day.tuesday": "Terça-feira",
    "day.wednesday": "Quarta-feira",
    "day.thursday": "Quinta-feira",
    "day.friday": "Sexta-feira",
    "day.saturday": "Sábado",
    "day.sunday": "Domingo",

    // Common
    "common.loading": "A carregar...",
    "common.save": "Guardar",
    "common.cancel": "Cancelar",
    "common.delete": "Eliminar",
    "common.edit": "Editar",
    "common.back": "Voltar",
    "common.next": "Seguinte",
    "common.previous": "Anterior",
    "common.search": "Pesquisar...",
    "common.noResults": "Sem resultados",
    "common.confirm": "Confirmar",
    "common.active": "Ativa",
    "common.inactive": "Inativa",

    // Loyalty
    "loyalty.title": "Programa de Fidelização",
    "loyalty.subtitle": "Clientes ganham pontos a cada marcação e trocam por recompensas.",
    "loyalty.cards": "Cartões de Fidelização",
    "loyalty.rewards": "Recompensas",
    "loyalty.points": "pontos",
    "loyalty.earned": "ganhos",
    "loyalty.available": "disponíveis",
    "loyalty.noCards": "Ainda nenhum cliente aderiu ao programa.",
    "loyalty.noRewards": "Crie recompensas que os clientes podem trocar com os seus pontos.",

    // Waitlist
    "waitlist.title": "Lista de Espera",
    "waitlist.subtitle": "Clientes que ficaram na fila quando não havia horário disponível.",
    "waitlist.noEntries": "Ninguém na lista de espera.",
    "waitlist.waiting": "Aguardar",
    "waitlist.notified": "Notificado",

    // Recurring
    "recurring.title": "Marcações Recorrentes",
    "recurring.subtitle": "Clientes com marcações automáticas regulares.",
    "recurring.noRules": "Nenhuma marcação recorrente ativa.",
    "recurring.weekly": "Semanal",
    "recurring.biweekly": "Quinzenal",
    "recurring.monthly": "Mensal",

    // Reports
    "reports.title": "Relatórios",
    "reports.revenue": "Receita",
    "reports.appointments": "Marcações",
    "reports.clients": "Clientes",
    "reports.noShows": "Faltas",
    "reports.thisMonth": "Este mês",
    "reports.lastMonth": "Mês passado",
    "reports.thisWeek": "Esta semana",
  },
  en: {
    // Navigation
    "nav.home": "Home",
    "nav.agenda": "Schedule",
    "nav.services": "Services",
    "nav.team": "Team",
    "nav.clients": "Clients",
    "nav.loyalty": "Loyalty",
    "nav.waitlist": "Waitlist",
    "nav.recurring": "Recurring",
    "nav.reports": "Reports",
    "nav.settings": "Settings",
    "nav.logout": "Logout",

    // Booking
    "booking.title": "Book a Service",
    "booking.selectService": "Choose a service",
    "booking.selectDate": "Choose a date",
    "booking.selectTime": "Choose a time",
    "booking.yourDetails": "Your details",
    "booking.confirm": "Confirm",
    "booking.confirmed": "Appointment booked!",
    "booking.reminder": "Would you like a reminder 1 hour before?",
    "booking.activateReminders": "Enable reminders",
    "booking.payment": "Payment made on site.",
    "booking.saveDate": "Save this date in your phone calendar so you don't forget.",

    // Days
    "day.monday": "Monday",
    "day.tuesday": "Tuesday",
    "day.wednesday": "Wednesday",
    "day.thursday": "Thursday",
    "day.friday": "Friday",
    "day.saturday": "Saturday",
    "day.sunday": "Sunday",

    // Common
    "common.loading": "Loading...",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.delete": "Delete",
    "common.edit": "Edit",
    "common.back": "Back",
    "common.next": "Next",
    "common.previous": "Previous",
    "common.search": "Search...",
    "common.noResults": "No results",
    "common.confirm": "Confirm",
    "common.active": "Active",
    "common.inactive": "Inactive",

    // Loyalty
    "loyalty.title": "Loyalty Program",
    "loyalty.subtitle": "Clients earn points with every booking and redeem rewards.",
    "loyalty.cards": "Loyalty Cards",
    "loyalty.rewards": "Rewards",
    "loyalty.points": "points",
    "loyalty.earned": "earned",
    "loyalty.available": "available",
    "loyalty.noCards": "No clients have joined the program yet.",
    "loyalty.noRewards": "Create rewards that clients can redeem with their points.",

    // Waitlist
    "waitlist.title": "Waitlist",
    "waitlist.subtitle": "Clients who joined the queue when no time slot was available.",
    "waitlist.noEntries": "No one on the waitlist.",
    "waitlist.waiting": "Waiting",
    "waitlist.notified": "Notified",

    // Recurring
    "recurring.title": "Recurring Bookings",
    "recurring.subtitle": "Clients with regular automatic appointments.",
    "recurring.noRules": "No active recurring bookings.",
    "recurring.weekly": "Weekly",
    "recurring.biweekly": "Bi-weekly",
    "recurring.monthly": "Monthly",

    // Reports
    "reports.title": "Reports",
    "reports.revenue": "Revenue",
    "reports.appointments": "Appointments",
    "reports.clients": "Clients",
    "reports.noShows": "No-shows",
    "reports.thisMonth": "This month",
    "reports.lastMonth": "Last month",
    "reports.thisWeek": "This week",
  },
} as const;

export type TranslationKey = keyof typeof translations.pt;

let currentLocale: Locale = "pt";

export function setLocale(locale: Locale) {
  currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

export function t(key: TranslationKey): string {
  return translations[currentLocale][key] ?? key;
}

export function getTranslations(locale: Locale) {
  return translations[locale];
}
