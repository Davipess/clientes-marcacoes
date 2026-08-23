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

  // 3. Deactivate Ana.
  const ana = list.staff.find(
    (s: { displayName: string; user?: { email?: string } }) =>
      s.user?.email === "ana@salaoexemplo.pt",
  );
  if (ana) {
    const off = await fetch(`${BASE}/api/admin/equipa`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...ORIGIN, Cookie: cookie },
      body: JSON.stringify({ staffId: ana.id, active: false }),
    });
    console.log("3. desativar Ana:", off.status);
  }

  // 4. Availability still works (only the admin remains).
  const svc = await prisma.service.findFirstOrThrow();
  const avail = await (await fetch(`${BASE}/api/disponibilidade?servico=${svc.id}&dias=7`)).json();
  console.log("4. disponibilidade com so a gestora:", avail.days.length, "dias com slots");

  // 5. Cannot deactivate the last active technician.
  const adminStaff = await prisma.staff.findFirstOrThrow({
    where: { user: { email: "gestor@salaoexemplo.pt" } },
  });
  const block = await fetch(`${BASE}/api/admin/equipa`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...ORIGIN, Cookie: cookie },
    body: JSON.stringify({ staffId: adminStaff.id, active: false }),
  });
  console.log("5. desativar a ultima (esperado 400):", block.status);

  // 6. Re-activate Ana (leave state as the user prefers to configure).
  if (ana) {
    await fetch(`${BASE}/api/admin/equipa`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...ORIGIN, Cookie: cookie },
      body: JSON.stringify({ staffId: ana.id, active: true }),
    });
    console.log("6. Ana reativada (decisao fica para a gestora)");
  }
}

main()
  .catch((e) => console.error("ERR", e.message))
  .finally(() => prisma.$disconnect());
