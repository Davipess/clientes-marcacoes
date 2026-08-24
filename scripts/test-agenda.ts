import "dotenv/config";
import { prisma } from "../lib/db";

const BASE = "http://localhost:3000";
const ORIGIN = { Origin: BASE };

function wallToIso(date: string, time: string, timeZone: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone, hour12: false, year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(new Date(guess))) parts[p.type] = p.value;
  const hour = parts.hour === "24" ? 0 : Number(parts.hour);
  const offset =
    Date.UTC(+parts.year, +parts.month - 1, +parts.day, hour, +parts.minute) - guess;
  return new Date(guess - offset).toISOString();
}

async function main() {
  for (let i = 0; i < 20; i++) {
    try {
      if ((await fetch(`${BASE}/entrar`)).ok) break;
    } catch { /* wait */ }
    await new Promise((r) => setTimeout(r, 1500));
  }

  // 1. Guest booking through the public API (wizard path, no phone).
  const svc = await prisma.service.findFirstOrThrow();
  const availRes = await fetch(
    `${BASE}/api/disponibilidade?servico=${svc.id}&dias=14`,
  );
  const avail = await availRes.json();
  const day = avail.days[0];
  const inicio = wallToIso(day.date, day.times[0], "Europe/Lisbon");
  const booking = await fetch(`${BASE}/api/marcacoes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...ORIGIN },
    body: JSON.stringify({
      servicos: [svc.id],
      inicio,
      nome: "Ana Costa",
      telefone: "+351 961 234 567",
      consentimentoRGPD: true,
    }),
  });
  const bj = await booking.json();
  console.log("1. marcação online (sem telefone):", booking.status, bj.marcacaoId ?? bj.error);

  // 2. Admin login.
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...ORIGIN },
    body: JSON.stringify({
      email: "gestor@salaoexemplo.pt",
      password: "NovaPass123456",
    }),
  });
  const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0];

  // 3. Agenda pages render.
  for (const p of ["/admin/agenda", `/admin/agenda?data=${day.date}`]) {
    const r = await fetch(`${BASE}${p}`, { headers: { Cookie: cookie } });
    console.log(`2. ${p}:`, r.status);
  }

  // 4. Manual booking (walk-in) — bypasses lead time, tomorrow 17:00.
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const todayIso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Lisbon", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(tomorrow);
  const manual = await fetch(`${BASE}/api/admin/marcacoes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...ORIGIN, Cookie: cookie },
    body: JSON.stringify({
      servicos: [svc.id],
      inicio: wallToIso(todayIso, "17:00", "Europe/Lisbon"),
      nome: "Walk-in Teste",
      telefone: "+351 962 345 678",
    }),
  });
  const mj = await manual.json();
  console.log("3. marcação manual (walk-in hoje):", manual.status, mj.id ?? mj.error);

  // 5. Status transitions.
  const complete = await fetch(`${BASE}/api/admin/marcacoes`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...ORIGIN, Cookie: cookie },
    body: JSON.stringify({ id: mj.id, action: "COMPLETED" }),
  });
  console.log("4. marcar concluída:", complete.status);

  const cancel = await fetch(`${BASE}/api/admin/marcacoes`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...ORIGIN, Cookie: cookie },
    body: JSON.stringify({ id: bj.marcacaoId, action: "CANCEL" }),
  });
  console.log("5. cancelar marcação online:", cancel.status);

  // 6. Revenue reflects the completed appointment.
  const appt = await prisma.appointment.findUniqueOrThrow({
    where: { id: mj.id },
    include: { items: true },
  });
  console.log(
    "6. estado final:",
    appt.status,
    "| receita registada:",
    appt.items.reduce((s, i) => s + Number(i.unitPrice), 0),
    "€",
  );
}

main()
  .catch((e) => console.error("ERR", e.message))
  .finally(() => prisma.$disconnect());
