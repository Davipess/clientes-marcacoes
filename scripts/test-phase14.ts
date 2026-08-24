import "dotenv/config";
import { prisma } from "../lib/db";

const BASE = "http://localhost:3000";
const ORIGIN = { Origin: BASE };
const PHONE = "+351 965 000 111";
const PHONE2 = "+351 965 000 222";

let passed = 0;
let failed = 0;
function assert(cond: boolean, label: string) {
  if (cond) {
    passed++;
    console.log(`  ✔ ${label}`);
  } else {
    failed++;
    console.error(`  ✘ FALHOU: ${label}`);
  }
}

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

  // Clean slate.
  await prisma.appointment.deleteMany({});
  await prisma.client.deleteMany({});
  // Generous limits for setup, tightened per-test below via direct settings.
  await prisma.businessSettings.updateMany({
    data: { maxActiveBookingsPerPhone: 3, maxBookingsPerPhonePerDay: 10, noShowFlagThreshold: 2 },
  });

  const adminLogin = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...ORIGIN },
    body: JSON.stringify({ email: "gestor@salaoexemplo.pt", password: "NovaPass123456" }),
  });
  const cookie = (adminLogin.headers.get("set-cookie") ?? "").split(";")[0];

  const svc = await prisma.service.findFirstOrThrow();
  const avail = await (await fetch(`${BASE}/api/disponibilidade?servico=${svc.id}&dias=10`)).json();
  const slots: { date: string; times: string[] }[] = avail.days;
  assert(slots.length >= 3, "dias suficientes para o teste");

  function book(phone: string, dayIdx: number, timeIdx: number) {
    return fetch(`${BASE}/api/marcacoes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...ORIGIN },
      body: JSON.stringify({
        servicos: [svc.id],
        inicio: wallToIso(slots[dayIdx].date, slots[dayIdx].times[timeIdx], "Europe/Lisbon"),
        nome: "Cliente Teste 14",
        telefone: phone,
        consentimentoRGPD: true,
      }),
    });
  }

  console.log("\n[1] Limite de marcações ativas por telefone (3)");
  const b1 = await book(PHONE, 0, 0);
  const b2 = await book(PHONE, 1, 0);
  const b3 = await book(PHONE, 2, 0);
  assert(b1.ok && b2.ok && b3.ok, "3 marcações criadas");
  const b4 = await book(PHONE, 3, 0);
  const b4j = await b4.json();
  assert(b4.status === 400 && b4j.error.includes("marcações ativas"), `4.ª bloqueada: "${b4j.error.slice(0, 50)}..."`);

  console.log("\n[2] Outro telefone não é afetado");
  const other = await book(PHONE2, 3, 0);
  assert(other.ok, "telefone diferente marca normalmente");

  console.log("\n[3] No-show incrementa contador e ativa aviso de risco");
  // Two distinct appointments, each marked once — the counter counts events.
  const client = await prisma.client.findFirstOrThrow({
    where: { phoneHash: { not: { startsWith: "anon-" } }, name: "Cliente Teste 14" },
  });
  const confirmed = await prisma.appointment.findMany({
    where: { clientId: client.id, status: "CONFIRMED" },
    select: { id: true },
  });
  assert(confirmed.length >= 2, "o cliente tem 2 marcações confirmadas");
  for (const a of confirmed.slice(0, 2)) {
    await fetch(`${BASE}/api/admin/marcacoes`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...ORIGIN, Cookie: cookie },
      body: JSON.stringify({ id: a.id, action: "NO_SHOW" }),
    });
  }
  const afterNoShows = await prisma.client.findUniqueOrThrow({
    where: { id: client.id },
    select: { noShowCount: true },
  });
  assert(afterNoShows.noShowCount === 2, `contador = 2 (obtido ${afterNoShows.noShowCount})`);

  console.log("\n[4] Bloqueio manual impede novas marcações; desbloqueio restaura");
  const block = await fetch(`${BASE}/api/admin/clientes`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...ORIGIN, Cookie: cookie },
    body: JSON.stringify({ id: client.id, action: "block", reason: "Faltas repetidas" }),
  });
  assert(block.ok, "bloqueio aplicado");
  const blockedTry = await book(PHONE, 4, 0);
  const blockedJson = await blockedTry.json();
  assert(
    blockedTry.status === 400 && blockedJson.error.includes("Contacte o salão"),
    "marcação online recusada com mensagem clara",
  );
  const unblock = await fetch(`${BASE}/api/admin/clientes`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...ORIGIN, Cookie: cookie },
    body: JSON.stringify({ id: client.id, action: "unblock" }),
  });
  assert(unblock.ok, "desbloqueio aplicado");

  console.log("\n[5] Reset do contador de faltas");
  const reset = await fetch(`${BASE}/api/admin/clientes`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...ORIGIN, Cookie: cookie },
    body: JSON.stringify({ id: client.id, action: "resetNoShows" }),
  });
  const afterReset = await prisma.client.findUniqueOrThrow({
    where: { id: client.id },
    select: { noShowCount: true },
  });
  assert(reset.ok && afterReset.noShowCount === 0, "contador zerado");

  console.log("\n[6] Limite diário por telefone (via engine, sem rate limit HTTP)");
  await prisma.appointment.deleteMany({});
  await prisma.client.deleteMany({});
  await prisma.businessSettings.updateMany({ data: { maxBookingsPerPhonePerDay: 2 } });
  const { createAppointment } = await import("../lib/booking/create-appointment");
  const business = await prisma.business.findFirstOrThrow();
  const direct = async (phone: string, dayIdx: number) =>
    createAppointment({
      businessId: business.id,
      serviceIds: [svc.id],
      startAt: new Date(
        wallToIso(slots[dayIdx].date, slots[dayIdx].times[0], "Europe/Lisbon"),
      ),
      client: { name: "Cliente Diário", phone, gdprConsent: true },
    });
  const e1 = await direct(PHONE2, 0);
  const e2 = await direct(PHONE2, 1);
  const e3 = await direct(PHONE2, 2);
  assert(e1.ok && e2.ok, "2 marcações no mesmo dia OK");
  assert(
    !e3.ok && e3.message.includes("hoje"),
    `3.ª do dia bloqueada: "${e3.ok ? "" : e3.message}"`,
  );

  console.log("\n[7] Retenção: limpeza de marcações antigas mantém o contador");
  const c = await prisma.client.findFirstOrThrow();
  await prisma.appointment.updateMany({
    where: { clientId: c.id },
    data: { status: "COMPLETED", endAt: new Date("2024-01-01T10:00:00Z") },
  });
  const { runRetentionCleanup } = await import("../lib/retention");
  const result = await runRetentionCleanup();
  const apptsAfter = await prisma.appointment.count({ where: { clientId: c.id } });
  const counterAfter = await prisma.client.findUniqueOrThrow({
    where: { id: c.id },
    select: { noShowCount: true },
  });
  assert(result.deletedAppointments >= 2, `marcações antigas removidas (${result.deletedAppointments})`);
  assert(apptsAfter === 0, "histórico antigo apagado");
  void counterAfter;

  console.log(`\n═══ Resultado: ${passed} passaram, ${failed} falharam ═══`);
  process.exitCode = failed > 0 ? 1 : 0;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
