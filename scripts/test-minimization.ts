import "dotenv/config";
import { prisma } from "../lib/db";
import { minimizeStaleContacts } from "../lib/retention";
import { normalizePhone, piiLookupHash } from "../lib/crypto";

let pass = 0;
let fail = 0;
function assert(cond: boolean, label: string) {
  if (cond) {
    pass++;
    console.log(`  OK ${label}`);
  } else {
    fail++;
    console.error(`  FAIL ${label}`);
  }
}

async function main() {
  await prisma.appointment.deleteMany({});
  await prisma.client.deleteMany({});
  await prisma.businessSettings.updateMany({
    data: { contactRetentionDays: 7 },
  });

  const biz = await prisma.business.findFirstOrThrow();
  const base = new Date();
  const mk = (days: number) => {
    const d = new Date(base.getTime() + days * 86_400_000);
    while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 10, 0));
  };

  console.log("[1] Cliente com visita terminada ha 30 dias -> contacto APAGADO");
  const antiga = await prisma.client.create({
    data: {
      businessId: biz.id,
      name: "Antiga",
      phoneEnc: "ENC-antiga",
      phoneHash: piiLookupHash(normalizePhone("960000001")),
      noShowCount: 2,
      blocked: true,
      blockReason: "faltas",
      gdprConsentAt: new Date(),
      appointments: {
        create: {
          businessId: biz.id,
          staffId: (await prisma.staff.findFirstOrThrow({ where: { active: true } })).id,
          startAt: mk(-32),
          endAt: mk(-31),
          status: "COMPLETED",
        },
      },
    },
  });
  const m1 = await minimizeStaleContacts();
  const after1 = await prisma.client.findUniqueOrThrow({
    where: { id: antiga.id },
    select: { name: true, phoneEnc: true, phoneHash: true, noShowCount: true, blocked: true, blockReason: true },
  });
  assert(m1 >= 1, "minimizacao processou o cliente");
  assert(after1.name === "Cliente (histórico)", "nome substituido");
  assert(after1.phoneEnc === null, "telefone APAGADO");
  assert(
    after1.phoneHash === piiLookupHash(normalizePhone("960000001")),
    "phoneHash mantido (identidade para anti-abuso)",
  );
  assert(after1.noShowCount === 2, "contador de faltas mantido");
  console.log(`    [debug] blocked=${after1.blocked} reason=${JSON.stringify(after1.blockReason)}`);
  assert(after1.blocked && after1.blockReason === "faltas", "bloqueio manual mantido");

  console.log("[2] Cliente com marcacao FUTURA -> contacto MANTIDO");
  const futura = await prisma.client.create({
    data: {
      businessId: biz.id,
      name: "Futura",
      phoneEnc: "ENC-futura",
      phoneHash: piiLookupHash(normalizePhone("960000002")),
      appointments: {
        create: {
          businessId: biz.id,
          staffId: (await prisma.staff.findFirstOrThrow({ where: { active: true } })).id,
          startAt: mk(5),
          endAt: new Date(mk(5).getTime() + 45 * 60_000),
          status: "CONFIRMED",
        },
      },
    },
  });
  await minimizeStaleContacts();
  const after2 = await prisma.client.findUniqueOrThrow({
    where: { id: futura.id },
    select: { name: true, phoneEnc: true },
  });
  assert(after2.name === "Futura" && after2.phoneEnc === "ENC-futura", "contacto intacto (tem marcacao futura)");

  console.log("[3] Visita recente (2 dias) -> contacto MANTIDO");
  const recente = await prisma.client.create({
    data: {
      businessId: biz.id,
      name: "Recente",
      phoneEnc: "ENC-recente",
      phoneHash: piiLookupHash(normalizePhone("960000003")),
      appointments: {
        create: {
          businessId: biz.id,
          staffId: (await prisma.staff.findFirstOrThrow({ where: { active: true } })).id,
          startAt: mk(-1),
          endAt: new Date(mk(-1).getTime() + 45 * 60_000),
          status: "COMPLETED",
        },
      },
    },
  });
  await minimizeStaleContacts();
  const after3 = await prisma.client.findUniqueOrThrow({
    where: { id: recente.id },
    select: { phoneEnc: true },
  });
  assert(after3.phoneEnc === "ENC-recente", "contacto intacto (dentro do prazo de 7 dias)");

  console.log("\n[Cleanup]");
  await prisma.appointment.deleteMany({});
  await prisma.client.deleteMany({});

  console.log(`\n=== ${pass} passaram, ${fail} falharam ===`);
  process.exitCode = fail > 0 ? 1 : 0;
}

main()
  .catch((e) => console.error("ERR", e.message))
  .finally(() => prisma.$disconnect());
