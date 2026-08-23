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
    } else {
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

  // ── Demo categories/services/staff (only if none exist) ──
  const serviceCount = await prisma.service.count({
    where: { businessId: business.id },
  });
  if (serviceCount === 0) {
    const catUnhas = await prisma.serviceCategory.create({
      data: { businessId: business.id, name: "Unhas", sortOrder: 0 },
    });
    await prisma.service.createMany({
      data: [
        {
          businessId: business.id,
          categoryId: catUnhas.id,
          name: "Manicure",
          description: "Limpeza, corte e verniz das unhas das mãos.",
          durationMin: 45,
          price: 15.0,
        },
        {
          businessId: business.id,
          categoryId: catUnhas.id,
          name: "Pedicure",
          description: "Cuidado completo das unhas dos pés.",
          durationMin: 60,
          price: 20.0,
        },
        {
          businessId: business.id,
          categoryId: catUnhas.id,
          name: "Gel semipermanente",
          description: "Verniz gel de longa duração.",
          durationMin: 75,
          price: 25.0,
        },
      ],
    });
  }

  const staffCount = await prisma.staff.count({
    where: { businessId: business.id },
  });
  if (staffCount === 0 && process.env.STAFF_EMAIL && process.env.STAFF_PASSWORD) {
    const staffUser = await prisma.user.create({
      data: {
        businessId: business.id,
        role: "STAFF",
        name: process.env.STAFF_NAME ?? "Colaboradora Exemplo",
        email: process.env.STAFF_EMAIL,
        passwordHash: await hashPassword(process.env.STAFF_PASSWORD),
      },
    });
    const staff = await prisma.staff.create({
      data: {
        businessId: business.id,
        userId: staffUser.id,
        displayName: "Ana",
        bio: "Especialista em manicure e pedicure.",
      },
    });
    // Mon-Fri 09:00-18:00
    await prisma.workSchedule.createMany({
      data: [1, 2, 3, 4, 5].map((weekday) => ({
        staffId: staff.id,
        weekday,
        startTime: "09:00",
        endTime: "18:00",
      })),
    });
    const servicos = await prisma.service.findMany({
      where: { businessId: business.id },
    });
    await prisma.serviceStaff.createMany({
      data: servicos.map((s) => ({ serviceId: s.id, staffId: staff.id })),
    });
    console.log(`Created staff: Ana (${staffUser.email})`);
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
