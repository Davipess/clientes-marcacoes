import "dotenv/config";
import { prisma } from "../lib/db";

async function main() {
  const businesses = await prisma.business.findMany({ select: { id: true, name: true, slug: true } });
  console.log("Businesses:", JSON.stringify(businesses, null, 2));
  const services = await prisma.service.findMany({ select: { id: true, name: true, businessId: true } });
  console.log("Services:", JSON.stringify(services, null, 2));
  const staff = await prisma.staff.findMany({ select: { id: true, displayName: true, businessId: true, active: true, userId: true } });
  console.log("Staff:", JSON.stringify(staff, null, 2));
  const categories = await prisma.serviceCategory.findMany({ select: { id: true, name: true, businessId: true, archived: true } });
  console.log("Categories:", JSON.stringify(categories, null, 2));
}

main().finally(() => prisma.$disconnect());
