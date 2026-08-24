import "dotenv/config";
import { prisma } from "../lib/db";

async function main() {
  await prisma.appointment.deleteMany({});
  await prisma.client.deleteMany({});
  const b = await prisma.business.findFirst({ where: { slug: "biz-b-audit" } });
  if (b) {
    await prisma.businessSettings.deleteMany({ where: { businessId: b.id } });
    await prisma.appointment.deleteMany({ where: { businessId: b.id } });
    await prisma.client.deleteMany({ where: { businessId: b.id } });
    await prisma.serviceStaff.deleteMany({ where: { staff: { businessId: b.id } } });
    await prisma.workSchedule.deleteMany({ where: { staff: { businessId: b.id } } });
    await prisma.staff.deleteMany({ where: { businessId: b.id } });
    await prisma.service.deleteMany({ where: { businessId: b.id } });
    await prisma.serviceCategory.deleteMany({ where: { businessId: b.id } });
    await prisma.user.deleteMany({ where: { businessId: b.id } });
    await prisma.business.delete({ where: { id: b.id } });
  }
  const auditUsers = await prisma.user.findMany({
    where: { email: { contains: "audit.local" } },
  });
  for (const u of auditUsers) {
    await prisma.staff.deleteMany({ where: { userId: u.id } });
    await prisma.user.delete({ where: { id: u.id } }).catch(() => {});
  }
  console.log("fixtures de auditoria removidas");
}

main()
  .catch((e) => console.error("ERR", e.message))
  .finally(() => prisma.$disconnect());
