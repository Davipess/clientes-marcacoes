import { prisma } from "@/lib/db";
import { sendPushToBusiness } from "@/lib/push";

/**
 * Join the waitlist for a specific date/time.
 */
export async function joinWaitlist(input: {
  businessId: string;
  clientName: string;
  clientPhone: string;
  serviceId: string;
  preferredDate: Date;
  preferredTime?: string;
  clientId?: string;
}) {
  return prisma.waitlistEntry.create({
    data: {
      businessId: input.businessId,
      clientId: input.clientId ?? null,
      clientName: input.clientName,
      clientPhone: input.clientPhone,
      serviceId: input.serviceId,
      preferredDate: input.preferredDate,
      preferredTime: input.preferredTime ?? null,
    },
  });
}

/**
 * When a slot opens (cancellation/reschedule), notify waitlisted clients.
 */
export async function notifyWaitlist(
  businessId: string,
  serviceId: string,
  date: Date,
) {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const entries = await prisma.waitlistEntry.findMany({
    where: {
      businessId,
      serviceId,
      status: "WAITING",
      preferredDate: { gte: dayStart, lt: dayEnd },
    },
    include: { service: { select: { name: true } } },
  });

  for (const entry of entries) {
    // Mark as notified
    await prisma.waitlistEntry.update({
      where: { id: entry.id },
      data: { status: "NOTIFIED", notifiedAt: new Date() },
    });

    // Push notification to business owner
    await sendPushToBusiness(businessId, {
      title: "Vaga disponível",
      body: `${entry.clientName} — ${entry.service.name} — ${date.toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "numeric" })}`,
      url: "/admin/agenda",
      tag: `waitlist-${entry.id}`,
    }).catch(() => {});
  }

  return entries.length;
}

/**
 * Cancel a waitlist entry.
 */
export async function cancelWaitlistEntry(id: string) {
  return prisma.waitlistEntry.update({
    where: { id },
    data: { status: "CANCELLED" },
  });
}
