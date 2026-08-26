import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("DATABASE_URL not set"); return; }
  const adapter = new PrismaPg({ connectionString: url });
  const prisma = new PrismaClient({ adapter });
  const users = await prisma.user.findMany({ select: { email: true, role: true, name: true } });
  console.log("Users in DB:", JSON.stringify(users, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e.message); process.exit(1); });
