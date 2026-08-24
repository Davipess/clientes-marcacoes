import "dotenv/config";
import { prisma } from "../lib/db";
import { getAvailableSlots } from "../lib/booking/availability";
import { createAppointment } from "../lib/booking/create-appointment";
import {
  cancelAppointment,
  rescheduleAppointment,
} from "../lib/booking/modify-appointment";

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    passed++;
    console.log(`  ✔ ${label}`);
  } else {
    failed++;
    console.error(`  ✘ FALHOU: ${label}`);
  }
}

async function main() {
  const business = await prisma.business.findFirstOrThrow();
  const services = await prisma.service.findMany({
    where: { businessId: business.id },
    orderBy: { name: "asc" },
  });
  const manicure = services.find((s) => s.name === "Manicure")!;
  const pedicure = services.find((s) => s.name === "Pedicure")!;

  // ── Clean slate for deterministic tests ──────────────────────
  await prisma.appointment.deleteMany({ where: { businessId: business.id } });

  console.log("\n[1] Disponibilidade base");
  const avail = await getAvailableSlots({
    businessId: business.id,
    serviceIds: [manicure.id],
    days: 7,
  });
  assert(avail.totalDurationMin === manicure.durationMin, "duração total = manicure");
  assert(avail.days.length > 0, "existem dias com slots");
  const firstDay = avail.days[0];
  console.log(`      primeiro dia com slots: ${firstDay.date} (${firstDay.times.length} horários)`);

  // Pick the first slot of the first day.
  const tz = business.timezone;
  const [hh, mm] = firstDay.times[0].split(":").map(Number);
  const [y, m, d] = firstDay.date.split("-").map(Number);
  const zonedToUtc = (wallHour: number, wallMin: number) => {
    const guess = Date.UTC(y, m - 1, d, wallHour, wallMin);
    return new Date(guess - offsetMs(guess));
  };
  function offsetMs(ts: number): number {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    const parts: Record<string, string> = {};
    for (const p of dtf.formatToParts(new Date(ts))) parts[p.type] = p.value;
    const hour = parts.hour === "24" ? 0 : Number(parts.hour);
    const asUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      hour,
      Number(parts.minute),
    );
    return asUtc - ts;
  }
  const slotStart = zonedToUtc(hh, mm);

  console.log("\n[2] Marcação simples");
  const booking = await createAppointment({
    businessId: business.id,
    serviceIds: [manicure.id],
    startAt: slotStart,
    client: {
      name: "Cliente Teste",
      phone: "+351 912 345 678",
      gdprConsent: true,
    },
  });
  assert(booking.ok, "marcação criada");

  console.log("\n[3] Dupla marcação simultânea do mesmo horário");
  // Re-query: the slot raced on must be genuinely free AFTER test [2].
  const availNow = await getAvailableSlots({
    businessId: business.id,
    serviceIds: [manicure.id],
    days: 7,
  });
  const raceDay = availNow.days[0];
  const [rh, rm] = raceDay.times[0].split(":").map(Number);
  const [ry, rmo, rd] = raceDay.date.split("-").map(Number);
  const raceGuess = Date.UTC(ry, rmo - 1, rd, rh, rm);
  const raceOffset = offsetMs(raceGuess);
  const nextSlot = new Date(raceGuess - raceOffset);
  const results = await Promise.all([
    createAppointment({
      businessId: business.id,
      serviceIds: [manicure.id],
      startAt: nextSlot,
      client: { name: "Cliente A", phone: "+351 911 111 111", gdprConsent: true },
    }),
    createAppointment({
      businessId: business.id,
      serviceIds: [manicure.id],
      startAt: nextSlot,
      client: { name: "Cliente B", phone: "+351 922 222 222", gdprConsent: true },
    }),
  ]);
  const wins = results.filter((r) => r.ok).length;
  assert(wins === 1, `exatamente 1 sucesso (obtido ${wins})`);
  assert(
    results.some((r) => !r.ok && r.code === "SLOT_TAKEN"),
    "o perdedor recebe SLOT_TAKEN",
  );

  console.log("\n[4] Marcação de vários serviços num só bloco");
  const multiAvail = await getAvailableSlots({
    businessId: business.id,
    serviceIds: [manicure.id, pedicure.id],
    days: 7,
  });
  assert(multiAvail.days.length > 0, "slots para manicure+pedicure");
  const md = multiAvail.days[0];
  const [mh, mm2] = md.times[0].split(":").map(Number);
  const [my, mmth, mdd] = md.date.split("-").map(Number);
  const multiGuess = Date.UTC(my, mmth - 1, mdd, mh, mm2);
  const multiOffset = (() => {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    const parts: Record<string, string> = {};
    for (const p of dtf.formatToParts(new Date(multiGuess))) parts[p.type] = p.value;
    const hour = parts.hour === "24" ? 0 : Number(parts.hour);
    return (
      Date.UTC(
        Number(parts.year),
        Number(parts.month) - 1,
        Number(parts.day),
        hour,
        Number(parts.minute),
      ) - multiGuess
    );
  })();
  const multiStart = new Date(multiGuess - multiOffset);
  const multiBooking = await createAppointment({
    businessId: business.id,
    serviceIds: [manicure.id, pedicure.id],
    startAt: multiStart,
    client: { name: "Cliente Multi", phone: "+351 933 333 333", gdprConsent: true },
  });
  assert(multiBooking.ok, "marcação multi-serviço criada");
  if (multiBooking.ok) {
    const created = await prisma.appointment.findUniqueOrThrow({
      where: { id: multiBooking.appointmentId },
      include: { items: true },
    });
    const durationMs = created.endAt.getTime() - created.startAt.getTime();
    assert(
      durationMs === (manicure.durationMin + pedicure.durationMin) * 60_000,
      `duração contínua = ${manicure.durationMin + pedicure.durationMin} min`,
    );
    assert(created.items.length === 2, "dois itens registados");
    const pricesOk = created.items.every((item) =>
      item.unitPrice.equals(item.serviceId === manicure.id ? manicure.price : pedicure.price),
    );
    assert(pricesOk, "preços snapshot corretos");
  }

  console.log("\n[5] Cancelamento e política");
  const apptSoon = await prisma.appointment.create({
    data: {
      businessId: business.id,
      clientId: (await prisma.client.findFirstOrThrow()).id,
      staffId: (await prisma.staff.findFirstOrThrow()).id,
      startAt: new Date(Date.now() + 3 * 3_600_000), // dentro da janela
      endAt: new Date(Date.now() + 4 * 3_600_000),
      status: "CONFIRMED",
    },
  });
  const clientCancelSoon = await cancelAppointment(apptSoon.id, undefined, true);
  assert(!clientCancelSoon.ok && clientCancelSoon.code === "POLICY", "cliente NÃO pode cancelar dentro da janela");
  const adminCancel = await cancelAppointment(apptSoon.id, "Walk-in");
  assert(adminCancel.ok, "admin pode sempre cancelar");

  const apptFar = await prisma.appointment.create({
    data: {
      businessId: business.id,
      clientId: (await prisma.client.findFirstOrThrow()).id,
      staffId: (await prisma.staff.findFirstOrThrow()).id,
      startAt: new Date(Date.now() + 72 * 3_600_000),
      endAt: new Date(Date.now() + 73 * 3_600_000),
      status: "CONFIRMED",
    },
  });
  const clientCancelFar = await cancelAppointment(apptFar.id, undefined, true);
  assert(clientCancelFar.ok, "cliente pode cancelar fora da janela");

  console.log("\n[6] Reagendamento");
  const target = results.find((r) => r.ok)! as Extract<typeof results[number], { ok: true }>;
  const targetAppt = await prisma.appointment.findUniqueOrThrow({
    where: { id: target.appointmentId },
  });
  // Move it onto the multi-service appointment's exact start → must fail.
  const clash = await rescheduleAppointment(targetAppt.id, multiStart);
  assert(!clash.ok && clash.code === "SLOT_TAKEN", "reagendar para horário ocupado falha");
  // Move it to a genuinely free slot (re-query after all previous bookings).
  const availAfter = await getAvailableSlots({
    businessId: business.id,
    serviceIds: [manicure.id],
    days: 7,
  });
  const freeDay = availAfter.days[0];
  const [th, tm] = freeDay.times[0].split(":").map(Number);
  const [fy, fmo, fd] = freeDay.date.split("-").map(Number);
  const freeGuess = Date.UTC(fy, fmo - 1, fd, th, tm);
  const freeStart = new Date(freeGuess - offsetMs(freeGuess));
  const move = await rescheduleAppointment(targetAppt.id, freeStart);
  assert(move.ok, "reagendar para horário livre funciona");
  const moved = await prisma.appointment.findUniqueOrThrow({
    where: { id: targetAppt.id },
  });
  assert(moved.startAt.getTime() === freeStart.getTime(), "nova hora persistida");

  console.log(`\n═══ Resultado: ${passed} passaram, ${failed} falharam ═══`);
  process.exitCode = failed > 0 ? 1 : 0;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
