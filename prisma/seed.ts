import "dotenv/config";
import { hashPassword } from "../lib/crypto";
import { prisma } from "../lib/db";

async function main() {
  let business = await prisma.business.findFirst();
  if (!business) {
    business = await prisma.business.create({
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
  } else {
    console.log(`Business already exists: ${business.name} (${business.id})`);
  }

  const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    const adminExiste = await prisma.user.findFirst({
      where: { role: "ADMIN" },
    });
    if (adminExiste) {
      console.log("Admin already exists, skipping.");
      return;
    }
    const admin = await prisma.user.create({
      data: {
        businessId: business.id,
        role: "ADMIN",
        name: ADMIN_NAME ?? "Administrador",
        email: ADMIN_EMAIL,
        passwordHash: await hashPassword(ADMIN_PASSWORD),
      },
    });
    console.log(`Created admin: ${admin.email}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
