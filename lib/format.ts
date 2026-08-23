export function formatEuros(value: number): string {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

const WEEKDAY_LABELS: Record<string, string> = {
  mon: "Segunda-feira",
  tue: "Terça-feira",
  wed: "Quarta-feira",
  thu: "Quinta-feira",
  fri: "Sexta-feira",
  sat: "Sábado",
  sun: "Domingo",
};

export function weekdayLabel(key: string): string {
  return WEEKDAY_LABELS[key] ?? key;
}
