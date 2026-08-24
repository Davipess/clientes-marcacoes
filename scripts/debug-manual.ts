import "dotenv/config";
import { prisma } from "../lib/db";
import { createAppointment } from "../lib/booking/create-appointment";

async function main() {
  const biz = await prisma.business.findFirstOrThrow();
  const svc = await prisma.service.findFirstOrThrow();

  const inicio = new Date(Date.now() + 9 * 86_400_000);
  console.log("inicio proposto:", inicio.toISOString());

  const r = await createAppointment({
    businessId: biz.id,
    serviceIds: [svc.id],
    startAt: inicio,
    client: {
      name: "<script>alert(1)</script>",
      phone: "913333333",
      notes: "'; DROP TABLE clients; -- <script>x()</script>",
      gdprConsent: true,
    },
  });
  console.log("resultado:", JSON.stringify(r));

  // Também com hora alinhada ao slot (10:00 UTC -> 11:00 Lisboa)?
  const r2 = await createAppointment({
    businessId: biz.id,
    serviceIds: [svc.id],
    startAt: new Date("2026-09-03T10:00:00.000Z"),
    client: { name: "Debug Dois", phone: "914000001", gdprConsent: true },
  });
  console.log("resultado 2 (data fixa):", JSON.stringify(r2));

  await prisma.appointment.deleteMany({});
  await prisma.client.deleteMany({});
}

main()
  .catch((e) => console.error("ERR", e.message))
  .finally(() => prisma.$disconnect());
