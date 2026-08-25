import "dotenv/config";
import { prisma } from "../lib/db";

async function main() {
  console.log("=== Corrigir estado da BD ===");

  // 1. Apagar o negocio de teste (o primeiro que findFirst apanha)
  const auditBiz = await prisma.business.findFirst({
    where: { slug: "biz-b-audit" },
    select: { id: true, name: true },
  });
  if (auditBiz) {
    // Apagar tudo associado a este negocio
    await prisma.appointment.deleteMany({ where: { businessId: auditBiz.id } });
    await prisma.client.deleteMany({ where: { businessId: auditBiz.id } });
    await prisma.serviceStaff.deleteMany({ where: { service: { businessId: auditBiz.id } } });
    await prisma.workSchedule.deleteMany({ where: { staff: { businessId: auditBiz.id } } });
    await prisma.timeOff.deleteMany({ where: { staff: { businessId: auditBiz.id } } });
    await prisma.staff.deleteMany({ where: { businessId: auditBiz.id } });
    await prisma.service.deleteMany({ where: { businessId: auditBiz.id } });
    await prisma.serviceCategory.deleteMany({ where: { businessId: auditBiz.id } });
    await prisma.auditLog.deleteMany({ where: { businessId: auditBiz.id } });
    await prisma.notificationLog.deleteMany({ where: { businessId: auditBiz.id } });
    await prisma.image.deleteMany({ where: { businessId: auditBiz.id } });
    await prisma.businessSettings.deleteMany({ where: { businessId: auditBiz.id } });
    await prisma.business.delete({ where: { id: auditBiz.id } });
    console.log(`[1] Negocio de teste "${auditBiz.name}" apagado com todos os dados`);
  } else {
    console.log("[1] Nenhum negocio de teste encontrado");
  }

  // 2. Verificar estado do negocio correto
  const biz = await prisma.business.findFirst({
    where: { slug: "salao-exemplo" },
    select: { id: true, name: true },
  });
  if (!biz) {
    console.error("ERRO: Negocio principal nao encontrado!");
    return;
  }
  console.log(`[2] Negocio principal: "${biz.name}" (${biz.id})`);

  // 3. Corrigir nome do negocio para "Lénia Ferreira Unhas"
  if (biz.name !== "Lénia Ferreira Unhas") {
    await prisma.business.update({ where: { id: biz.id }, data: { name: "Lénia Ferreira Unhas" } });
    console.log(`[3] Nome corrigido para "Lénia Ferreira Unhas"`);
  } else {
    console.log("[3] Nome ja esta correto");
  }

  // 4. Criar Lénia como tecnica (alem de admin)
  const leniaUser = await prisma.user.findFirst({ where: { email: "gestor@salaoexemplo.pt" } });
  if (!leniaUser) {
    console.error("ERRO: User da Lenia nao encontrado!");
    return;
  }

  const leniaStaff = await prisma.staff.findFirst({ where: { userId: leniaUser.id } });
  if (!leniaStaff) {
    const staff = await prisma.staff.create({
      data: {
        businessId: biz.id,
        userId: leniaUser.id,
        displayName: "Lénia",
        bio: "Proprietária e especialista em unhas.",
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
    const servicos = await prisma.service.findMany({ where: { businessId: biz.id } });
    await prisma.serviceStaff.createMany({
      data: servicos.map((s) => ({ serviceId: s.id, staffId: staff.id })),
    });

    console.log(`[4] Staff Lénia criada: ${staff.id}, horario Seg-Sex 09:00-18:00, ${servicos.length} servicos`);
  } else {
    console.log("[4] Staff Lénia ja existe");
  }

  // 5. Verificar estado final
  const finalBiz = await prisma.business.findMany({ select: { id: true, name: true, slug: true } });
  const finalStaff = await prisma.staff.findMany({ select: { id: true, displayName: true, active: true } });
  const finalServices = await prisma.service.findMany({ select: { id: true, name: true } });
  const finalUsers = await prisma.user.findMany({ select: { email: true, role: true, name: true } });
  console.log("\n=== Estado final ===");
  console.log("Negocios:", JSON.stringify(finalBiz));
  console.log("Staff:", JSON.stringify(finalStaff));
  console.log("Servicos:", JSON.stringify(finalServices));
  console.log("Users:", JSON.stringify(finalUsers));
}

main()
  .catch((e) => { console.error("ERR", e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
