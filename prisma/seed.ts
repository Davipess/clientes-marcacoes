import "dotenv/config";
import { prisma } from "../lib/db";

async function main() {
  const existing = await prisma.business.findFirst();
  if (existing) {
    console.log(`Business already exists: ${existing.name} (${existing.id})`);
    return;
  }

  const business = await prisma.business.create({
    data: {
      slug: "salao-exemplo",
      name: "Salão Exemplo",
      address: "Rua Exemplo, 123, Lisboa",
      phone: "+351 900 000 000",
      email: "geral@salaoexemplo.pt",
      settings: {
        create: {
          openingHours: {
            mon: [{ open: "09:00", close: "18:00" }],
            tue: [{ open: "09:00", close: "18:00" }],
            wed: [{ open: "09:00", close: "18:00" }],
            thu: [{ open: "09:00", close: "18:00" }],
            fri: [{ open: "09:00", close: "19:00" }],
            sat: [{ open: "09:00", close: "13:00" }],
            sun: null,
          },
        },
      },
    },
  });

  console.log(`Created business: ${business.name} (${business.id})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
