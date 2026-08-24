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

  // 1. Solo mode activation.
  const solo = await fetch(`${BASE}/api/admin/equipa/solo`, {
    method: "POST",
    headers: { ...ORIGIN, Cookie: cookie },
  });
  console.log("1. modo individual (201 novo / 409 ja existe):", solo.status);

  // 2. Create a brand-new service.
  const cat = await prisma.serviceCategory.findFirstOrThrow();
  const createRes = await fetch(`${BASE}/api/admin/servicos`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...ORIGIN, Cookie: cookie },
    body: JSON.stringify({
      categoryId: cat.id,
      name: "Servico Novo Teste",
      description: "teste de disponibilidade",
      durationMin: 30,
      price: 18,
    }),
  });
  const created = await createRes.json();
  console.log("2. servico criado:", createRes.status, created.id ?? created.error);

  // 3. Is it immediately available for booking?
  const availRes = await fetch(`${BASE}/api/disponibilidade?servico=${created.id}&dias=14`);
  const avail = await availRes.json();
  const daysCount = avail.days?.length ?? 0;
  console.log("3. disponivel em", daysCount, "dias (esperado > 0):", daysCount > 0 ? "SIM" : "NAO");

  // 4. Staff links created?
  const links = await prisma.serviceStaff.count({
    where: { serviceId: created.id },
  });
  console.log("4. tecnicas associadas:", links);

  // 5. Cleanup — guarded: an undefined id would make Prisma ignore the
  // filter and wipe ALL rows. Never run cleanup on a failed create.
  if (created.id) {
    await prisma.serviceStaff.deleteMany({ where: { serviceId: created.id } });
    await prisma.service.delete({ where: { id: created.id } });
    console.log("5. limpeza ok");
  } else {
    console.log("5. limpeza ignorada (servico nao foi criado)");
  }
}

main()
  .catch((e) => console.error("ERR", e.message))
  .finally(() => prisma.$disconnect());
