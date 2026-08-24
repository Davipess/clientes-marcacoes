import "dotenv/config";
import { prisma } from "../lib/db";

async function main() {
  // Cores originais do schema (default de criação).
  const r = await prisma.business.updateMany({
    data: { primaryColor: "#C2185B", secondaryColor: "#F8BBD0" },
  });
  console.log(`cores repostas em ${r.count} negocio(s): #C2185B / #F8BBD0`);
}

main()
  .catch((e) => console.error("ERR", e.message))
  .finally(() => prisma.$disconnect());
