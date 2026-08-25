import "dotenv/config";
import { prisma } from "../lib/db";
import { minimizeClientIfNoFuture, runRetentionCleanup } from "../lib/retention";
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
  await prisma.businessSettings.updateMany({ data: { retentionMonths: 1 } });

  const biz = await prisma.business.findFirstOrThrow();
  const staff = await prisma.staff.findFirstOrThrow({ where: { active: true } });

  console.log("[1] Fecho da marcacao -> contacto apagado de imediato");
  const client = await prisma.client.create({
    data: {
      businessId: biz.id,
      name: "Ciclo Teste",
      phoneEnc: "ENC-ciclo",
      phoneHash: piiLookupHash(normalizePhone("967770001")),
    },
  });
  const appt = await prisma.appointment.create({
    data: {
      businessId: biz.id,
      clientId: client.id,
      staffId: staff.id,
      startAt: new Date(Date.now() - 3_600_000),
      endAt: new Date(Date.now() - 15 * 60_000),
      status: "CONFIRMED",
    },
  });

  await minimizeClientIfNoFuture(client.id);
  const after = await prisma.client.findUniqueOrThrow({
    where: { id: client.id },
    select: { name: true, phoneEnc: true, phoneHash: true },
  });
  assert(after.name === "Cliente (histórico)", "nome anonimizado");
  assert(after.phoneEnc === null, "telefone apagado");
  assert(
    after.phoneHash === piiLookupHash(normalizePhone("967770001")),
    "phoneHash mantido (anti-abuso continua a funcionar)",
  );

  console.log("[2] Retencao de 1 mes -> historico apagado (0 trace)");
  // Simular: marcacao com 2 meses, em estado final.
  await prisma.appointment.update({
    where: { id: appt.id },
    data: { status: "COMPLETED", endAt: new Date(Date.now() - 62 * 86_400_000) },
  });
  const result = await runRetentionCleanup();
  const remaining = await prisma.appointment.count({
    where: { clientId: client.id },
  });
  assert(
    result.deletedAppointments >= 1,
    `historico removido (${result.deletedAppointments})`,
  );
  assert(remaining === 0, "0 trace da marcacao na base de dados");
  const clientStill = await prisma.client.findUnique({
    where: { id: client.id },
    select: { noShowCount: true },
  });
  assert(clientStill !== null, "row pseudonima mantida (contador/anti-abuso)");

  console.log("\n[Cleanup]");
  await prisma.client.deleteMany({});

  console.log(`\n=== ${pass} passaram, ${fail} falharam ===`);
  process.exitCode = fail > 0 ? 1 : 0;
}

main()
  .catch((e) => console.error("ERR", e.message))
  .finally(() => prisma.$disconnect());
