import "dotenv/config";
import { prisma } from "../lib/db";

const BASE = "http://localhost:3000";
const ORIGIN = { Origin: BASE };

async function main() {
  for (let i = 0; i < 20; i++) {
    try {
      if ((await fetch(`${BASE}/entrar`)).ok) break;
    } catch { /* wait */ }
    await new Promise((r) => setTimeout(r, 1500));
  }

  // Admin creates a new staff member.
  const adminLogin = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...ORIGIN },
    body: JSON.stringify({
      email: "gestor@salaoexemplo.pt",
      password: "NovaPass123456",
    }),
  });
  const adminCookie = (adminLogin.headers.get("set-cookie") ?? "").split(";")[0];

  const createRes = await fetch(`${BASE}/api/admin/equipa`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...ORIGIN, Cookie: adminCookie },
    body: JSON.stringify({
      displayName: "Rita",
      email: "rita@salaoexemplo.pt",
      password: "PassRita123456",
    }),
  });
  console.log("1. criar staff (Rita):", createRes.status);

  // Rita logs in and sees her own (empty) agenda.
  const ritaLogin = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...ORIGIN },
    body: JSON.stringify({
      email: "rita@salaoexemplo.pt",
      password: "PassRita123456",
    }),
  });
  const ritaCookie = (ritaLogin.headers.get("set-cookie") ?? "").split(";")[0];
  console.log("2. login da Rita:", ritaLogin.status);

  const ritaPage = await fetch(`${BASE}/staff`, {
    headers: { Cookie: ritaCookie },
  });
  const ritaHtml = await ritaPage.text();
  console.log(
    "3. /staff da Rita:",
    ritaPage.status,
    "| agenda propria:",
    ritaHtml.includes("Bloquear horários"),
  );

  // Rita cannot access the admin panel.
  const ritaAdmin = await fetch(`${BASE}/admin`, { headers: { Cookie: ritaCookie } });
  console.log("4. Rita em /admin (esperado redirect):", ritaAdmin.status);

  // Rita cannot touch another staff member's appointment.
  const otherAppt = await prisma.appointment.findFirst({
    where: { staff: { is: { user: { email: "gestor@salaoexemplo.pt" } } } },
  });
  if (otherAppt) {
    const steal = await fetch(`${BASE}/api/staff/marcacoes`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...ORIGIN, Cookie: ritaCookie },
      body: JSON.stringify({ id: otherAppt.id, action: "COMPLETED" }),
    });
    console.log("5. Rita altera marcacao alheia (esperado 404):", steal.status);
  } else {
    console.log("5. (sem marcações de outras técnicas para testar — OK)");
  }

  // Rita blocks a time slot; it disappears from public availability.
  const svc = await prisma.service.findFirstOrThrow();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 2);
  const dateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Lisbon", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(tomorrow);

  const before = await (
    await fetch(`${BASE}/api/disponibilidade?servico=${svc.id}&colaborador=${(await prisma.staff.findFirstOrThrow({ where: { user: { email: "rita@salaoexemplo.pt" } } })).id}&dias=7`)
  ).json();
  const dayBefore = before.days.find((x: { date: string }) => x.date === dateStr);
  console.log(
    "6. slots da Rita antes do bloqueio:",
    dayBefore ? dayBefore.times.length : 0,
  );

  await fetch(`${BASE}/api/staff/blocos`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...ORIGIN, Cookie: ritaCookie },
    body: JSON.stringify({ data: dateStr, inicio: "09:00", fim: "18:00", motivo: "teste" }),
  });

  const after = await (
    await fetch(`${BASE}/api/disponibilidade?servico=${svc.id}&colaborador=${(await prisma.staff.findFirstOrThrow({ where: { user: { email: "rita@salaoexemplo.pt" } } })).id}&dias=7`)
  ).json();
  const dayAfter = after.days.find((x: { date: string }) => x.date === dateStr);
  console.log(
    "7. slots da Rita depois do bloqueio (esperado 0):",
    dayAfter ? dayAfter.times.length : 0,
  );

  // Cleanup: remove Rita and her blocks (test data).
  const blocks = await prisma.availabilityException.deleteMany({
    where: { reason: "teste" },
  });
  const ritaStaff = await prisma.staff.findFirst({
    where: { user: { email: "rita@salaoexemplo.pt" } },
  });
  if (ritaStaff) {
    await prisma.staff.delete({ where: { id: ritaStaff.id } });
    await prisma.user.delete({ where: { id: ritaStaff.userId } });
  }
  console.log(
    "8. limpeza (Rita removida,",
    blocks.count,
    "bloqueios apagados) — criar de novo é um clique nas Definições",
  );
}

main()
  .catch((e) => console.error("ERR", e.message))
  .finally(() => prisma.$disconnect());
