import "dotenv/config";
import { prisma } from "../lib/db";

async function main() {
  console.log("=== Recriar staff Ana ===");

  const business = await prisma.business.findFirstOrThrow();
  const anaUser = await prisma.user.findFirstOrThrow({
    where: { email: "ana@salaoexemplo.pt" },
  });

  // Verificar se staff ja existe
  const existing = await prisma.staff.findFirst({ where: { userId: anaUser.id } });
  if (existing) {
    console.log("Staff Ana ja existe, nada a fazer");
    return;
  }

  const staff = await prisma.staff.create({
    data: {
      businessId: business.id,
      userId: anaUser.id,
      displayName: "Ana",
      bio: "Especialista em manicure e pedicure.",
      active: true,
    },
  });

  // Horario Seg-Sex 09:00-18:00
  await prisma.workSchedule.createMany({
    data: [1, 2, 3, 4, 5].map((weekday) => ({
      staffId: staff.id,
      weekday,
      startTime: "09:00",
      endTime: "18:00",
    })),
  });

  // Associar a todos os servicos
  const servicos = await prisma.service.findMany({
    where: { businessId: business.id },
  });
  await prisma.serviceStaff.createMany({
    data: servicos.map((s) => ({ serviceId: s.id, staffId: staff.id })),
  });

  console.log(`Staff Ana criado: ${staff.id}`);
  console.log(`Horarios: Seg-Sex 09:00-18:00`);
  console.log(`Servicos associados: ${servicos.length}`);
}

main()
  .catch((e) => { console.error("ERR", e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
