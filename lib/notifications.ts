import { prisma } from "@/lib/db";
import type { NotificationType } from "@/lib/generated/prisma/client";

type Channel = "NONE" | "EMAIL" | "WHATSAPP" | "SMS";

type NotifyInput = {
  businessId: string;
  appointmentId?: string;
  type: NotificationType;
  recipient: string; // phone number (sole client identifier)
  message: string;
};

/**
 * Queues a notification for the client. Delivery channels are pluggable:
 * none is active today because the product is 100% free (no SMS costs,
 * clients have no email on file). When a free channel is adopted — e.g.
 * WhatsApp Business Cloud API service conversations — implement a sender
 * and flip the channel; history and retry logic already live in
 * NotificationLog.
 */
export async function queueNotification(input: NotifyInput): Promise<void> {
  const channel: Channel = "NONE";

  await prisma.notificationLog.create({
    data: {
      businessId: input.businessId,
      appointmentId: input.appointmentId,
      type: input.type,
      // The enum has no NONE; store as EMAIL with explicit status so the
      // log remains queryable without schema churn until a channel exists.
      channel: "EMAIL",
      recipient: input.recipient,
      status: channel === "NONE" ? "NOT_CONFIGURED" : "QUEUED",
      error:
        channel === "NONE"
          ? "Canal de entrega não configurado (produto 100% gratuito)"
          : null,
    },
    select: { id: true },
  });
}

/** Reminder sweep — call from a scheduled job (Netlify Scheduled Function). */
export async function queueDueReminders(): Promise<number> {
  const settingsList = await prisma.businessSettings.findMany({
    select: {
      businessId: true,
      reminderHoursBefore: true,
    },
  });

  let queued = 0;
  for (const settings of settingsList) {
    const windowStart = new Date();
    const windowEnd = new Date(
      Date.now() + settings.reminderHoursBefore * 3_600_000,
    );

    const upcoming = await prisma.appointment.findMany({
      where: {
        businessId: settings.businessId,
        status: "CONFIRMED",
        startAt: { gte: windowStart, lte: windowEnd },
        notifications: { none: { type: "REMINDER" } },
      },
      select: {
        id: true,
        startAt: true,
        client: { select: { phoneHash: true } },
        items: { select: { serviceName: true } },
      },
    });

    for (const appt of upcoming) {
      await queueNotification({
        businessId: settings.businessId,
        appointmentId: appt.id,
        type: "REMINDER",
        recipient: appt.client.phoneHash, // hash only — no PII in logs
        message: `Lembrete: ${appt.items.map((i) => i.serviceName).join(" + ")}`,
      });
      queued++;
    }
  }
  return queued;
}
