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

  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...ORIGIN },
    body: JSON.stringify({
      email: "gestor@salaoexemplo.pt",
      password: "NovaPass123456",
    }),
  });
  const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0];

  // 1. Settings page renders with team section (no Decimal error).
  const page = await fetch(`${BASE}/admin/definicoes`, {
    headers: { Cookie: cookie },
  });
  const html = await page.text();
  console.log("1. /admin/definicoes:", page.status, "| secao Equipa:", html.includes("Equipa"));

  // 2. List staff.
  const list = await (await fetch(`${BASE}/api/admin/equipa`, {
    headers: { Cookie: cookie },
  })).json();
  console.log(
    "2. equipa:",
    list.staff.map((s: { displayName: string; active: boolean }) => `${s.displayName}(${s.active ? "ativa" : "inativa"})`).join(", "),
  );

  // 3. Toggle Ana: deactivate if active, then back to the original state.
  const ana = list.staff.find(
    (s: { user?: { email?: string } }) => s.user?.email === "ana@salaoexemplo.pt",
  );
  if (ana) {
    const target = !ana.active;
    const off = await fetch(`${BASE}/api/admin/equipa`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...ORIGIN, Cookie: cookie },
      body: JSON.stringify({ staffId: ana.id, active: target }),
    });
    console.log(`3. alternar Ana para ${target ? "ativa" : "inativa"}:`, off.status);
    // restore original state
    await fetch(`${BASE}/api/admin/equipa`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...ORIGIN, Cookie: cookie },
      body: JSON.stringify({ staffId: ana.id, active: ana.active }),
    });
  }

  // 4. Availability still works (only the admin remains).
  const svc = await prisma.service.findFirstOrThrow();
  const avail = await (await fetch(`${BASE}/api/disponibilidade?servico=${svc.id}&dias=7`)).json();
  console.log("4. disponibilidade com so a gestora:", avail.days.length, "dias com slots");

  // 5. Guard: deactivating is allowed while another technician stays active,
  const adminStaff = await prisma.staff.findFirstOrThrow({
    where: { user: { email: "gestor@salaoexemplo.pt" } },
  });
  const block = await fetch(`${BASE}/api/admin/equipa`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...ORIGIN, Cookie: cookie },
    body: JSON.stringify({ staffId: adminStaff.id, active: false }),
  });
  console.log("5. desativar gestora com Ana ativa (200 esperado):", block.status);
}

main()
  .catch((e) => console.error("ERR", e.message))
  .finally(() => prisma.$disconnect());
