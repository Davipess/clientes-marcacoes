import "dotenv/config";
import { prisma } from "../lib/db";

/**
 * Limpeza de fixtures de teste — remove tecnicas/clientes/marcacoes criados
 * por suítes automatizadas. Preserva: negocio real, admin real (gestor@),
 * perfil Gestora, Ana (demo da seed), servicos e categorias.
 */
async function main() {
  // 1. Tecnicas de teste (perfis Staff com user de teste).
  const auditUsers = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: "audit.local" } },
        { email: { contains: "ratetest" } },
        { email: "sectest@salaoexemplo.pt" },
      ],
    },
    select: { id: true, email: true, role: true },
  });
  for (const u of auditUsers) {
    if (u.role === "ADMIN" && u.email === "adminb@audit.local") {
      // admin do Negocio B — o negocio B ja foi removido; remover utilizador orfao
    }
    await prisma.staff.deleteMany({ where: { userId: u.id } });
    await prisma.user.delete({ where: { id: u.id } }).catch(() => {});
    console.log(`  removido user de teste: ${u.email}`);
  }

  // 2. Perfis Staff de teste sem user (orfos) — nomes de fixture.
  const fixtureStaff = await prisma.staff.findMany({
    where: { displayName: { in: ["C Audit", "D Audit", "Rita", "RateTest", "SecTest", "B"] } },
    select: { id: true, displayName: true, userId: true },
  });
  for (const s of fixtureStaff) {
    await prisma.staff.delete({ where: { id: s.id } });
    if (s.userId) {
      await prisma.user.delete({ where: { id: s.userId } }).catch(() => {});
    }
    console.log(`  removida tecnica fixture: ${s.displayName}`);
  }

  // 3. Clientes de teste.
  const testClientNames = [
    "Cliente Teste 14",
    "Cliente Diário",
    "Cliente Diario",
    "Mass Assign",
    "<script>alert(1)</script>",
    "Vitima Teste",
    "Vitima Secreta",
    "Teste Telefone",
    "Passado",
    "Debug",
    "Debug Dois",
    "Cliente A audit",
    "Cliente B",
    "Spam 0",
    "Spam 1",
    "Spam 2",
    "Spam 3",
    "Spam 4",
    "Spam 5",
    "Spam 6",
    "Spam 7",
    "Spam 8",
    "Spam 9",
    "Spam 10",
    "Spam 11",
    "Cliente A",
    "Cliente B",
  ];
  const clients = await prisma.client.deleteMany({
    where: { name: { in: testClientNames } },
  });
  console.log(`  removidos clientes de teste: ${clients.count}`);

  // 4. Marcações restantes sem cliente válido (orfãs de testes).
  const orphans = await prisma.appointment.deleteMany({
    where: { client: { name: { in: testClientNames } } },
  });
  console.log(`  marcacoes de teste removidas: ${orphans.count}`);

  // 5. Estado final.
  const [staff, clientsTotal, appts] = await Promise.all([
    prisma.staff.findMany({ select: { displayName: true, active: true } }),
    prisma.client.count(),
    prisma.appointment.count(),
  ]);
  console.log(
    `\nEstado final — tecnicas: ${staff.map((s) => `${s.displayName}(${s.active ? "ativa" : "inativa"})`).join(", ")} | clientes: ${clientsTotal} | marcacoes: ${appts}`,
  );
}

main()
  .catch((e) => console.error("ERR", e.message))
  .finally(() => prisma.$disconnect());
