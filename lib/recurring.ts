import { prisma } from "@/lib/db";

/**
 * Create a recurring booking rule.
 */
export async function createRecurringRule(input: {
  businessId: string;
  clientId: string;
  staffId: string;
  serviceIds: string[];
  frequency: "weekly" | "biweekly" | "monthly";
  dayOfWeek?: number;
  dayOfMonth?: number;
  timeOfDay: string;
  startDate: Date;
  endDate?: Date;
}) {
  return prisma.recurringRule.create({
    data: {
      businessId: input.businessId,
      clientId: input.clientId,
      staffId: input.staffId,
      serviceIds: input.serviceIds,
      frequency: input.frequency,
      dayOfWeek: input.dayOfWeek ?? null,
      dayOfMonth: input.dayOfMonth ?? null,
      timeOfDay: input.timeOfDay,
      startDate: input.startDate,
      endDate: input.endDate ?? null,
    },
  });
}

/**
 * Generate upcoming appointments from active recurring rules.
 * Called periodically (e.g., daily cron).
 */
export async function generateRecurringAppointments(businessId: string): Promise<number> {
  const now = new Date();
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + 60); // generate 60 days ahead

  const rules = await prisma.recurringRule.findMany({
    where: {
      businessId,
      active: true,
      OR: [
        { endDate: null },
        { endDate: { gte: now } },
      ],
    },
    include: {
      client: { select: { id: true, phoneEnc: true } },
    },
  });

  let created = 0;

  for (const rule of rules) {
    // Skip if client data is minimized
    if (!rule.client.phoneEnc) continue;

    const dates = getNextDates(rule, now, horizon);

    for (const date of dates) {
      // Check if an appointment already exists for this client at this time
      const existing = await prisma.appointment.findFirst({
        where: {
          clientId: rule.clientId,
          startAt: date,
          status: { in: ["PENDING", "CONFIRMED"] },
        },
      });

      if (existing) continue;

      // Calculate end time based on services
      const services = await prisma.service.findMany({
        where: { id: { in: rule.serviceIds } },
        select: { durationMin: true, price: true, name: true },
      });

      const totalDuration = services.reduce((sum, s) => sum + s.durationMin, 0);
      const endAt = new Date(date.getTime() + totalDuration * 60_000);

      // Create the appointment
      await prisma.appointment.create({
        data: {
          businessId,
          clientId: rule.clientId,
          staffId: rule.staffId,
          startAt: date,
          endAt,
          status: "CONFIRMED",
          source: "ONLINE",
          notes: "Marcação recorrente",
          items: {
            create: services.map((s, i) => ({
              serviceId: rule.serviceIds[i],
              serviceName: s.name,
              unitPrice: s.price,
              durationMin: s.durationMin,
              sortOrder: i,
            })),
          },
        },
      });

      created++;
    }

    // Update lastGenerated
    await prisma.recurringRule.update({
      where: { id: rule.id },
      data: { lastGenerated: now },
    });
  }

  return created;
}

function getNextDates(
  rule: { frequency: string; dayOfWeek: number | null; dayOfMonth: number | null; timeOfDay: string; startDate: Date },
  from: Date,
  to: Date,
): Date[] {
  const dates: Date[] = [];
  const [hours, minutes] = rule.timeOfDay.split(":").map(Number);

  if (rule.frequency === "weekly" || rule.frequency === "biweekly") {
    if (rule.dayOfWeek === null) return dates;
    const step = rule.frequency === "biweekly" ? 14 : 7;
    const d = new Date(from);
    // Find first occurrence of the target day
    while (d.getDay() !== rule.dayOfWeek) d.setDate(d.getDate() + 1);
    // If before startDate, jump to startDate's week
    if (d < rule.startDate) {
      const diff = Math.ceil((rule.startDate.getTime() - d.getTime()) / (7 * 86_400_000)) * 7;
      d.setDate(d.getDate() + diff);
    }
    while (d <= to) {
      const appointmentDate = new Date(d);
      appointmentDate.setHours(hours, minutes, 0, 0);
      if (appointmentDate >= from && appointmentDate <= to) {
        dates.push(appointmentDate);
      }
      d.setDate(d.getDate() + step);
    }
  } else if (rule.frequency === "monthly") {
    if (rule.dayOfMonth === null) return dates;
    const d = new Date(from.getFullYear(), from.getMonth(), rule.dayOfMonth);
    if (d < from) d.setMonth(d.getMonth() + 1);
    while (d <= to) {
      const appointmentDate = new Date(d);
      appointmentDate.setHours(hours, minutes, 0, 0);
      if (appointmentDate >= from && appointmentDate <= to) {
        dates.push(appointmentDate);
      }
      d.setMonth(d.getMonth() + 1);
    }
  }

  return dates;
}

/**
 * Cancel a recurring rule.
 */
export async function cancelRecurringRule(id: string) {
  return prisma.recurringRule.update({
    where: { id },
    data: { active: false },
  });
}
